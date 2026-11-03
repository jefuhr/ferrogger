import { createGame, crossingMs, startGame, step } from "./game.js";
import { routeForLevel } from "./data.js";
import { createRenderer } from "./render.js";
import { createInput } from "./input.js";
import { createAudio } from "./audio.js";

const STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 250;
const HIGH_SCORE_KEY = "ferrogger:high-score";
const MUTED_KEY = "ferrogger:muted";

const params = new URLSearchParams(location.search);
const debug = params.has("debug");
const fixedSeed = params.has("seed") ? Number(params.get("seed")) : null;
const calm = debug && params.has("calm");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (selector) => document.querySelector(selector);
const els = {
	stage: $("#stage"),
	canvas: $("#river"),
	score: $("#score"),
	high: $("#high-score"),
	lives: $("#lives"),
	route: $("#route"),
	timer: $("#timer-fill"),
	toast: $("#toast"),
	start: $("#start"),
	paused: $("#paused"),
	over: $("#over"),
	finalScore: $("#final-score"),
	mute: $("#mute"),
	pause: $("#pause"),
};

function readStorage(key) {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStorage(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Private windows and blocked storage just lose the saved value.
	}
}

let highScore = Number(readStorage(HIGH_SCORE_KEY)) || 0;
let state = newGame();
let paused = false;
let pending = [];
let queued = [];
let toastTimer = 0;

const renderer = createRenderer(els.canvas, { reducedMotion });
const audio = createAudio({ muted: readStorage(MUTED_KEY) !== "false" });
const input = createInput({ surface: els.stage, onCommand: runCommand });

function newGame() {
	return createGame({ seed: fixedSeed ?? Date.now(), calm });
}

function runCommand(command) {
	if (command === "pause") setPaused(!paused);
	else if (command === "mute") setMuted(!audio.muted);
}

function setPaused(value) {
	if (state.status !== "playing" && state.status !== "dying") value = false;
	paused = value;
	if (paused) queued = [];
	els.pause.setAttribute("aria-pressed", String(paused));
}

function setMuted(value) {
	audio.setMuted(value);
	writeStorage(MUTED_KEY, String(value));
	els.mute.setAttribute("aria-pressed", String(!value));
	els.mute.textContent = value ? "🔇" : "🔊";
}

function showToast(message) {
	els.toast.textContent = message;
	els.toast.hidden = false;
	toastTimer = 2200;
}

function handleEvents(events) {
	// Clearing a level shows its own banner, so skip the dock toast that comes with it.
	const levelUp = events.some((event) => event.type === "level");
	for (const event of events) {
		audio.play(event.type);
		if (event.type === "dock" && !levelUp) showToast(`${event.vesselName} docked at ${event.landing}`);
		else if (event.type === "passengers") showToast("Passengers picked up! +200");
		else if (event.type === "sink" && navigator.vibrate) navigator.vibrate(80);
		else if (event.type === "gameover" && event.score > highScore) {
			highScore = event.score;
			writeStorage(HIGH_SCORE_KEY, String(highScore));
		}
	}
}

let lastHud = "";
function updateHud() {
	const route = routeForLevel(state.level);
	const hud = [state.score, highScore, state.lives, state.level, state.status, paused].join("|");
	if (hud !== lastHud) {
		lastHud = hud;
		els.score.textContent = String(state.score);
		els.high.textContent = String(Math.max(highScore, state.score));
		els.lives.textContent = "⛴".repeat(Math.max(0, state.lives));
		els.lives.setAttribute("aria-label", `${state.lives} boats left`);
		els.route.textContent = `${route.id} · L${state.level}`;
		els.route.style.setProperty("--route", route.color);
		els.route.style.setProperty("--route-text", route.text);
		els.start.hidden = state.status !== "ready";
		els.over.hidden = state.status !== "over";
		els.paused.hidden = !paused;
		els.finalScore.textContent = String(state.score);
		document.body.dataset.status = paused ? "paused" : state.status;
	}
	const fraction = state.timeLeftMs / crossingMs(state.level);
	els.timer.style.transform = `scaleX(${Math.max(0, fraction)})`;
	els.timer.classList.toggle("warn", fraction < 0.25);
}

function handleInputs(actions) {
	if (actions.length === 0) return [];
	if (state.status === "ready") {
		state = startGame(state);
		return [];
	}
	if (state.status === "over") {
		state = startGame(newGame());
		return [];
	}
	if (paused) {
		setPaused(false);
		return [];
	}
	return actions.filter((action) => action !== "any");
}

let last = performance.now();
let carry = 0;
function frame(now) {
	const elapsed = Math.min(MAX_FRAME_MS, now - last);
	last = now;

	for (const mutate of pending.splice(0)) {
		state = structuredClone(state);
		mutate(state);
	}

	// Frames faster than the fixed step (120Hz screens) may run no step at all,
	// so inputs wait in `queued` until a step consumes them instead of being lost.
	queued.push(...handleInputs(input.drain()));
	if (!paused) {
		carry += elapsed;
		while (carry >= STEP_MS) {
			state = step(state, STEP_MS, queued);
			queued = [];
			handleEvents(state.events);
			carry -= STEP_MS;
		}
	}

	if (toastTimer > 0) {
		toastTimer -= elapsed;
		if (toastTimer <= 0) els.toast.hidden = true;
	}

	updateHud();
	renderer.draw(state, reducedMotion ? 0 : now);
	requestAnimationFrame(frame);
}

els.mute.addEventListener("click", () => setMuted(!audio.muted));
els.pause.addEventListener("click", () => setPaused(!paused));
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "hidden") setPaused(true);
});
new ResizeObserver(() => renderer.resize()).observe(els.stage);
setMuted(audio.muted);
requestAnimationFrame(frame);

if (debug) {
	window.__ferrogger = {
		get state() {
			return state;
		},
		get paused() {
			return paused;
		},
		get highScore() {
			return highScore;
		},
		mutate(fn) {
			pending.push(fn);
		},
	};
}
