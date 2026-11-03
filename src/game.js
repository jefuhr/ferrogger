// The whole game as a pure simulation: step(state, dtMs, inputs) returns a new
// state and never touches the old one, the DOM, time or Math.random. Rendering,
// input and sound live elsewhere and only read state and its events.
import { VESSELS, routeForLevel } from "./data.js";
import { buildLanes, tideForLevel } from "./levels.js";
import { nextRandom, randomInt, seedState } from "./rng.js";

export const COLS = 11;
export const ROWS = 13;
export const HOME_ROW = ROWS - 1;
export const BUOY_ROW = 6;
export const START_COL = 5;
export const SLIP_COLS = [1, 3, 5, 7, 9];
// Fraction of a tile trimmed off each side of the ferry's hitbox.
export const INSET = 0.15;
// Off-screen tiles on each side where vessels wait before wrapping around.
export const MARGIN = 5;
export const DEATH_MS = 900;
// How far off a slip's centre the ferry may drift and still dock.
const DOCK_TOLERANCE = 0.35;

const ROW_POINTS = 10;
const DOCK_POINTS = 50;
const TIME_POINTS_PER_SECOND = 5;
const PASSENGER_POINTS = 200;
const LEVEL_POINTS = 1000;
const GULL_MS = 4000;
const PASSENGERS_MS = 6000;

export function crossingMs(level) {
	return Math.max(20000, 30000 - (level - 1) * 1500);
}

function pickVessel(state) {
	return VESSELS[randomInt(state, VESSELS.length)];
}

function freshSlips(level) {
	const route = routeForLevel(level);
	return SLIP_COLS.map((col, index) => ({
		col,
		landing: route.landings[index],
		filled: false,
		gull: 0,
		passengers: 0,
	}));
}

function setUpLevel(state) {
	state.slips = freshSlips(state.level);
	state.lanes = buildLanes({
		level: state.level,
		holder: state,
		calm: state.calm,
		cols: COLS,
		margin: MARGIN,
	});
	state.tide = tideForLevel(state.level);
	state.route = routeForLevel(state.level).id;
	state.eventTimer = 3000 + nextRandom(state) * 3000;
	state.banner = { text: routeForLevel(state.level).name, ms: 2200 };
}

function sendNextBoat(state) {
	state.ferry = { x: START_COL, row: HOME_ROW, vesselName: pickVessel(state) };
	state.furthestRow = HOME_ROW;
	state.timeLeftMs = crossingMs(state.level);
}

export function createGame({ seed = Date.now(), level = 1, calm = false } = {}) {
	const state = {
		seed,
		rng: seedState(seed),
		calm,
		level,
		status: "ready",
		score: 0,
		lives: 3,
		events: [],
		deathTimer: 0,
		deathCause: null,
		deathAt: null,
	};
	setUpLevel(state);
	sendNextBoat(state);
	return state;
}

export function startGame(previous) {
	const state = structuredClone(previous);
	state.status = "playing";
	state.events = [];
	return state;
}

function sink(state, cause) {
	state.status = "dying";
	state.deathCause = cause;
	state.deathAt = { x: state.ferry.x, row: state.ferry.row };
	state.deathTimer = DEATH_MS;
	state.lives -= 1;
	state.events.push({ type: "sink", cause });
}

function laneFor(state, row) {
	return state.lanes.find((lane) => lane.row === row);
}

function hitsVessel(state) {
	const lane = laneFor(state, state.ferry.row);
	if (!lane) return false;
	const left = state.ferry.x + INSET;
	const right = state.ferry.x + 1 - INSET;
	return lane.vessels.some((vessel) => left < vessel.x + vessel.len && right > vessel.x);
}

function dock(state) {
	const col = Math.round(state.ferry.x);
	const slip = state.slips.find((candidate) => candidate.col === col);
	if (!slip || Math.abs(state.ferry.x - col) > DOCK_TOLERANCE) return sink(state, "bulkhead");
	if (slip.filled) return sink(state, "occupied");
	if (slip.gull > 0) return sink(state, "gull");

	slip.filled = true;
	slip.vesselName = state.ferry.vesselName;
	state.score += DOCK_POINTS + Math.ceil(state.timeLeftMs / 1000) * TIME_POINTS_PER_SECOND;
	if (slip.passengers > 0) {
		state.score += PASSENGER_POINTS;
		slip.passengers = 0;
		state.events.push({ type: "passengers" });
	}
	state.events.push({ type: "dock", landing: slip.landing.name, vesselName: slip.vesselName });

	if (state.slips.every((candidate) => candidate.filled)) {
		state.score += LEVEL_POINTS;
		state.level += 1;
		setUpLevel(state);
		state.events.push({ type: "level", level: state.level, route: state.route });
	}
	sendNextBoat(state);
}

function move(state, direction) {
	const ferry = state.ferry;
	if (direction === "left") ferry.x = Math.max(0, ferry.x - 1);
	else if (direction === "right") ferry.x = Math.min(COLS - 1, ferry.x + 1);
	else if (direction === "down") ferry.row = Math.min(HOME_ROW, ferry.row + 1);
	else if (direction === "up") ferry.row -= 1;
	else return;

	state.events.push({ type: "move", direction });
	if (ferry.row === 0) return dock(state);
	if (ferry.row < state.furthestRow) {
		state.furthestRow = ferry.row;
		state.score += ROW_POINTS;
	}
	if (hitsVessel(state)) sink(state, "collision");
}

function moveVessels(state, seconds) {
	const loop = COLS + 2 * MARGIN;
	for (const lane of state.lanes) {
		for (const vessel of lane.vessels) {
			vessel.x += lane.dir * lane.speed * seconds;
			if (vessel.x >= COLS + MARGIN) {
				vessel.x -= loop;
				vessel.honked = false;
			} else if (vessel.x < -MARGIN) {
				vessel.x += loop;
				vessel.honked = false;
			}
			if (vessel.type === "siferry" && !vessel.honked) {
				const arriving = lane.dir < 0 ? vessel.x < COLS + 1 : vessel.x + vessel.len > -1;
				if (arriving) {
					vessel.honked = true;
					state.events.push({ type: "horn" });
				}
			}
		}
	}
}

function tickSlips(state, dtMs) {
	for (const slip of state.slips) {
		slip.gull = Math.max(0, slip.gull - dtMs);
		slip.passengers = Math.max(0, slip.passengers - dtMs);
	}
	if (state.calm) return;
	state.eventTimer -= dtMs;
	if (state.eventTimer > 0) return;
	state.eventTimer = 4000 + nextRandom(state) * 4000;
	const open = state.slips.filter((slip) => !slip.filled && !slip.gull && !slip.passengers);
	if (open.length === 0) return;
	const slip = open[randomInt(state, open.length)];
	if (nextRandom(state) < 0.5) slip.gull = GULL_MS;
	else slip.passengers = PASSENGERS_MS;
}

export function step(previous, dtMs, inputs = []) {
	const state = structuredClone(previous);
	state.events = [];
	if (state.banner) {
		state.banner.ms -= dtMs;
		if (state.banner.ms <= 0) state.banner = null;
	}
	if (state.status === "over") return state;

	const seconds = dtMs / 1000;
	moveVessels(state, seconds);
	tickSlips(state, dtMs);

	if (state.status === "ready") return state;

	if (state.status === "dying") {
		state.deathTimer -= dtMs;
		if (state.deathTimer > 0) return state;
		state.deathCause = null;
		state.deathAt = null;
		if (state.lives > 0) {
			state.status = "playing";
			sendNextBoat(state);
		} else {
			state.status = "over";
			state.events.push({ type: "gameover", score: state.score });
		}
		return state;
	}

	for (const direction of inputs) {
		move(state, direction);
		if (state.status !== "playing") return state;
	}

	const lane = laneFor(state, state.ferry.row);
	if (lane && lane.current) state.ferry.x += lane.current * seconds;
	if (state.ferry.x < -0.5 || state.ferry.x > COLS - 0.5) {
		sink(state, "swept");
	} else if (hitsVessel(state)) {
		sink(state, "collision");
	} else {
		state.timeLeftMs -= dtMs;
		if (state.timeLeftMs <= 0) {
			state.timeLeftMs = 0;
			sink(state, "late");
		}
	}
	return state;
}
