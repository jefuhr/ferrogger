// Canvas drawing. Everything is drawn in tile units: one tile is one grid cell,
// and the context transform scales tiles to device pixels.
import { BUOY_ROW, COLS, DEATH_MS, HOME_ROW, ROWS } from "./game.js";
import { ROUTES } from "./data.js";

const COLORS = {
	river: "#1f74ad",
	riverDeep: "#155a8c",
	slack: "#2f8cc4",
	foam: "rgba(255, 255, 255, 0.55)",
	foamSoft: "rgba(255, 255, 255, 0.18)",
	bulkhead: "#5a4a52",
	bulkheadTop: "#7a6871",
	piling: "#2f2429",
	pier: "#b9835a",
	pierDark: "#8e5f3d",
	ink: "#1d1418",
	white: "#fffaf6",
	window: "#23324a",
	pink: "#ffadc9",
	kayakA: "#ffcf3f",
	kayakB: "#ff6f61",
	taxi: "#ffd23f",
	tug: "#d8434b",
	barge: "#7c6a58",
	gravel: "#a39383",
	siOrange: "#f47b20",
	tourStripe: "#0b3d91",
	jetski: "#2ec4b6",
	gull: "#ffffff",
	beak: "#ff9f1c",
	buoyRed: "#e63946",
	buoyGreen: "#2a9d8f",
};

const routeColor = Object.fromEntries(ROUTES.map((route) => [route.id, route]));

export function createRenderer(canvas, { reducedMotion = false } = {}) {
	const ctx = canvas.getContext("2d");
	let tile = 1;
	let dpr = 1;

	function resize() {
		const box = canvas.parentElement.getBoundingClientRect();
		tile = Math.max(8, Math.floor(Math.min(box.width / COLS, box.height / ROWS)));
		dpr = Math.min(3, window.devicePixelRatio || 1);
		canvas.style.width = `${tile * COLS}px`;
		canvas.style.height = `${tile * ROWS}px`;
		canvas.width = Math.round(tile * COLS * dpr);
		canvas.height = Math.round(tile * ROWS * dpr);
		canvas.parentElement.style.setProperty("--toast-top", `${(BUOY_ROW + 0.5) * tile}px`);
	}

	function useTiles() {
		ctx.setTransform(tile * dpr, 0, 0, tile * dpr, 0, 0);
	}

	// Text is drawn in device pixels because tiny fractional font sizes render
	// badly under a large transform in some browsers.
	function text(value, x, y, size, color, { align = "center", weight = 700 } = {}) {
		ctx.save();
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.font = `${weight} ${Math.max(7, size * tile)}px "Trebuchet MS", system-ui, sans-serif`;
		ctx.textAlign = align;
		ctx.textBaseline = "middle";
		ctx.fillStyle = color;
		ctx.fillText(value, x * tile, y * tile);
		ctx.restore();
	}

	function roundRect(x, y, w, h, r, fill) {
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, r);
		ctx.fillStyle = fill;
		ctx.fill();
	}

	// A hull pointing in `dir` (+1 right, -1 left) with a tapered bow.
	function hull(x, y, len, h, dir, fill, bow = 0.35) {
		const top = y;
		const bottom = y + h;
		const mid = y + h / 2;
		const stern = dir > 0 ? x : x + len;
		const bowTip = dir > 0 ? x + len : x;
		const bowStart = bowTip - dir * Math.min(bow, len / 2);
		ctx.beginPath();
		ctx.moveTo(stern, top + 0.04);
		ctx.quadraticCurveTo(stern, top, stern + dir * 0.06, top);
		ctx.lineTo(bowStart, top);
		ctx.quadraticCurveTo(bowTip, top + 0.02, bowTip, mid);
		ctx.quadraticCurveTo(bowTip, bottom - 0.02, bowStart, bottom);
		ctx.lineTo(stern + dir * 0.06, bottom);
		ctx.quadraticCurveTo(stern, bottom, stern, bottom - 0.04);
		ctx.closePath();
		ctx.fillStyle = fill;
		ctx.fill();
	}

	function windows(x, y, len, count, color = COLORS.window) {
		const gap = len / count;
		for (let i = 0; i < count; i++) {
			roundRect(x + i * gap + gap * 0.2, y, gap * 0.6, 0.09, 0.02, color);
		}
	}

	function wake(x, y, len, dir, time) {
		const stern = dir > 0 ? x : x + len;
		const wiggle = reducedMotion ? 0 : Math.sin(time / 140 + x) * 0.03;
		ctx.strokeStyle = COLORS.foamSoft;
		ctx.lineWidth = 0.06;
		ctx.beginPath();
		ctx.moveTo(stern, y + 0.2);
		ctx.lineTo(stern - dir * 0.55, y + 0.08 + wiggle);
		ctx.moveTo(stern, y + 0.8);
		ctx.lineTo(stern - dir * 0.55, y + 0.92 - wiggle);
		ctx.stroke();
	}

	function drawKayak(x, y, dir, time) {
		wake(x + 0.1, y, 0.8, dir, time);
		hull(x + 0.05, y + 0.36, 0.9, 0.28, dir, COLORS.kayakA, 0.3);
		ctx.beginPath();
		ctx.arc(x + 0.5, y + 0.5, 0.09, 0, Math.PI * 2);
		ctx.fillStyle = COLORS.kayakB;
		ctx.fill();
		const sweep = reducedMotion ? 0.25 : Math.sin(time / 180 + x * 3) * 0.25;
		ctx.strokeStyle = COLORS.ink;
		ctx.lineWidth = 0.04;
		ctx.beginPath();
		ctx.moveTo(x + 0.5 - sweep, y + 0.22);
		ctx.lineTo(x + 0.5 + sweep, y + 0.78);
		ctx.stroke();
	}

	function drawJetski(x, y, dir, time) {
		wake(x, y, 1, dir, time);
		hull(x + 0.1, y + 0.3, 0.8, 0.4, dir, COLORS.jetski, 0.3);
		roundRect(x + 0.4, y + 0.38, 0.22, 0.24, 0.06, COLORS.ink);
	}

	function drawTaxi(x, y, len, dir, time) {
		wake(x, y, len, dir, time);
		hull(x, y + 0.18, len, 0.64, dir, COLORS.taxi);
		const checks = Math.floor((len - 0.4) / 0.12);
		for (let i = 0; i < checks; i++) {
			roundRect(x + 0.2 + i * 0.12, y + 0.24 + (i % 2) * 0.06, 0.06, 0.06, 0, COLORS.ink);
		}
		roundRect(x + 0.3, y + 0.38, len - 0.7, 0.32, 0.06, COLORS.white);
		windows(x + 0.3, y + 0.5, len - 0.7, 3);
	}

	function drawTour(x, y, len, dir, time) {
		wake(x, y, len, dir, time);
		hull(x, y + 0.14, len, 0.72, dir, COLORS.white);
		roundRect(x + 0.12, y + 0.68, len - 0.3, 0.07, 0, COLORS.tourStripe);
		roundRect(x + 0.3, y + 0.26, len - 0.75, 0.36, 0.06, "#e9eef5");
		windows(x + 0.3, y + 0.32, len - 0.75, 5);
		windows(x + 0.3, y + 0.48, len - 0.75, 5);
	}

	function drawBarge(x, y, len, dir, time) {
		// The tug pushes from the stern, so it sits on the trailing end.
		const tugLen = 0.8;
		const bargeLen = len - tugLen;
		const bargeX = dir > 0 ? x + tugLen : x;
		const tugX = dir > 0 ? x : x + bargeLen;
		wake(tugX, y, tugLen, dir, time);
		roundRect(bargeX, y + 0.12, bargeLen, 0.76, 0.06, COLORS.barge);
		ctx.beginPath();
		ctx.ellipse(bargeX + bargeLen / 2, y + 0.5, bargeLen * 0.38, 0.24, 0, 0, Math.PI * 2);
		ctx.fillStyle = COLORS.gravel;
		ctx.fill();
		hull(tugX, y + 0.2, tugLen, 0.6, dir, COLORS.tug, 0.2);
		roundRect(tugX + 0.22, y + 0.32, 0.36, 0.36, 0.05, COLORS.white);
		roundRect(tugX + 0.3, y + 0.42, 0.2, 0.16, 0.03, COLORS.ink);
	}

	function drawSiFerry(x, y, len, dir, time) {
		wake(x, y, len, dir, time);
		hull(x, y + 0.06, len, 0.88, dir, COLORS.siOrange, 0.5);
		roundRect(x + 0.45, y + 0.2, len - 0.9, 0.6, 0.1, COLORS.white);
		windows(x + 0.5, y + 0.3, len - 1, 10);
		windows(x + 0.5, y + 0.6, len - 1, 10);
		roundRect(x + len / 2 - 0.25, y + 0.38, 0.5, 0.24, 0.05, COLORS.siOrange);
	}

	function drawVessel(vessel, row, dir, time) {
		const { x, len, type } = vessel;
		if (x > COLS || x + len < 0) return;
		if (type === "kayak") drawKayak(x, row, dir, time);
		else if (type === "jetski") drawJetski(x, row, dir, time);
		else if (type === "taxi") drawTaxi(x, row, len, dir, time);
		else if (type === "tour") drawTour(x, row, len, dir, time);
		else if (type === "barge") drawBarge(x, row, len, dir, time);
		else if (type === "siferry") drawSiFerry(x, row, len, dir, time);
	}

	// The player's ferry points up the river toward the slips.
	function drawFerry(x, y, route, scale = 1) {
		ctx.save();
		ctx.translate(x + 0.5, y + 0.5);
		ctx.scale(scale, scale);
		ctx.translate(-0.5, -0.5);
		ctx.beginPath();
		ctx.moveTo(0.5, 0.02);
		ctx.quadraticCurveTo(0.84, 0.18, 0.84, 0.46);
		ctx.lineTo(0.84, 0.9);
		ctx.quadraticCurveTo(0.84, 0.98, 0.76, 0.98);
		ctx.lineTo(0.24, 0.98);
		ctx.quadraticCurveTo(0.16, 0.98, 0.16, 0.9);
		ctx.lineTo(0.16, 0.46);
		ctx.quadraticCurveTo(0.16, 0.18, 0.5, 0.02);
		ctx.closePath();
		ctx.fillStyle = COLORS.white;
		ctx.fill();
		ctx.strokeStyle = COLORS.ink;
		ctx.lineWidth = 0.04;
		ctx.stroke();
		roundRect(0.16, 0.74, 0.68, 0.1, 0, route.color);
		roundRect(0.28, 0.34, 0.44, 0.34, 0.06, "#e9eef5");
		roundRect(0.33, 0.38, 0.34, 0.1, 0.03, COLORS.window);
		roundRect(0.33, 0.53, 0.34, 0.1, 0.03, COLORS.window);
		ctx.restore();
	}

	function drawGull(x, y, time) {
		const flap = reducedMotion ? 0 : Math.sin(time / 120) * 0.08;
		ctx.fillStyle = COLORS.gull;
		ctx.beginPath();
		ctx.ellipse(x, y, 0.18, 0.11, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = COLORS.gull;
		ctx.lineWidth = 0.06;
		ctx.beginPath();
		ctx.moveTo(x - 0.3, y - 0.12 - flap);
		ctx.quadraticCurveTo(x - 0.12, y - 0.2, x, y - 0.04);
		ctx.quadraticCurveTo(x + 0.12, y - 0.2, x + 0.3, y - 0.12 - flap);
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(x + 0.14, y - 0.06, 0.07, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = COLORS.beak;
		ctx.beginPath();
		ctx.moveTo(x + 0.2, y - 0.08);
		ctx.lineTo(x + 0.32, y - 0.04);
		ctx.lineTo(x + 0.2, y - 0.02);
		ctx.fill();
	}

	function drawPassengers(x, y, time) {
		const colors = ["#ffadc9", "#ffd23f", "#2ec4b6", "#ffffff"];
		const bob = reducedMotion ? 0 : Math.abs(Math.sin(time / 200)) * 0.05;
		colors.forEach((color, index) => {
			const px = x - 0.33 + index * 0.22;
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(px, y - bob * (index % 2), 0.07, 0, Math.PI * 2);
			ctx.fill();
			roundRect(px - 0.06, y + 0.05 - bob * (index % 2), 0.12, 0.14, 0.04, color);
		});
	}

	function drawWater(state, time) {
		for (let row = 1; row < HOME_ROW; row++) {
			const fill = row === BUOY_ROW ? COLORS.slack : row < BUOY_ROW ? COLORS.riverDeep : COLORS.river;
			ctx.fillStyle = fill;
			ctx.fillRect(0, row, COLS, 1);
		}
		ctx.strokeStyle = COLORS.foamSoft;
		ctx.lineWidth = 0.035;
		for (let row = 1; row < HOME_ROW; row++) {
			const drift = reducedMotion ? 0 : (time / 2400 + row * 0.37) % 1;
			for (let i = -1; i < COLS; i += 2) {
				const wx = i + drift * 2 + (row % 2);
				ctx.beginPath();
				ctx.moveTo(wx, row + 0.5);
				ctx.quadraticCurveTo(wx + 0.15, row + 0.42, wx + 0.3, row + 0.5);
				ctx.stroke();
			}
		}

		// Current chevrons in the upper river show which way the tide pushes.
		for (const lane of state.lanes) {
			if (!lane.current) continue;
			const dir = Math.sign(lane.current);
			const travel = reducedMotion ? 0 : ((time / 1000) * Math.abs(lane.current)) % 2;
			ctx.strokeStyle = COLORS.foam;
			ctx.lineWidth = 0.04;
			for (let i = -2; i < COLS + 2; i += 2) {
				const cx = i + dir * travel + 0.5;
				ctx.beginPath();
				ctx.moveTo(cx - dir * 0.07, lane.row + 0.12);
				ctx.lineTo(cx + dir * 0.03, lane.row + 0.2);
				ctx.lineTo(cx - dir * 0.07, lane.row + 0.28);
				ctx.stroke();
			}
		}

		for (let col = 0.5; col < COLS; col += 2.5) {
			const left = Math.round(col) % 2 === 0;
			roundRect(col - 0.1, BUOY_ROW + 0.36, 0.2, 0.3, 0.05, left ? COLORS.buoyRed : COLORS.buoyGreen);
		}
		ctx.strokeStyle = COLORS.foam;
		ctx.setLineDash([0.15, 0.2]);
		ctx.lineWidth = 0.025;
		ctx.beginPath();
		ctx.moveTo(0, BUOY_ROW + 0.5);
		ctx.lineTo(COLS, BUOY_ROW + 0.5);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	function drawBulkhead(state, time) {
		const route = routeColor[state.route];
		ctx.fillStyle = COLORS.bulkhead;
		ctx.fillRect(0, 0, COLS, 1);
		ctx.fillStyle = COLORS.bulkheadTop;
		ctx.fillRect(0, 0, COLS, 0.3);
		ctx.fillStyle = route.color;
		ctx.fillRect(0, 0.28, COLS, 0.04);
		for (const slip of state.slips) {
			ctx.fillStyle = COLORS.riverDeep;
			ctx.fillRect(slip.col, 0.32, 1, 0.68);
			ctx.fillStyle = COLORS.piling;
			ctx.fillRect(slip.col - 0.04, 0.32, 0.1, 0.68);
			ctx.fillRect(slip.col + 0.94, 0.32, 0.1, 0.68);
			text(slip.landing.short, slip.col + 0.5, 0.15, 0.19, COLORS.white);
			if (slip.filled) drawFerry(slip.col, 0.32, route, 0.66);
			if (slip.gull > 0) drawGull(slip.col + 0.5, 0.68, time);
			if (slip.passengers > 0) drawPassengers(slip.col + 0.5, 0.62, time);
		}
	}

	function drawPier() {
		ctx.fillStyle = COLORS.pier;
		ctx.fillRect(0, HOME_ROW, COLS, 1);
		ctx.strokeStyle = COLORS.pierDark;
		ctx.lineWidth = 0.03;
		for (let y = HOME_ROW + 0.25; y < ROWS; y += 0.25) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(COLS, y);
			ctx.stroke();
		}
		for (let col = 0.5; col < COLS; col += 2) {
			if (Math.abs(col - 5.5) < 1) continue;
			ctx.beginPath();
			ctx.arc(col, HOME_ROW + 0.18, 0.09, 0, Math.PI * 2);
			ctx.fillStyle = COLORS.piling;
			ctx.fill();
		}
	}

	function drawSplash(state) {
		if (!state.deathAt) return;
		const progress = 1 - Math.max(0, state.deathTimer) / DEATH_MS;
		const cx = state.deathAt.x + 0.5;
		const cy = state.deathAt.row + 0.5;
		const fade = reducedMotion ? 1 : 1 - progress * 0.7;
		const rings = reducedMotion ? [0.45] : [0.25 + progress * 0.6, 0.05 + progress * 0.4];

		// Dark under-strokes keep the rings readable over white hulls.
		ctx.globalAlpha = fade;
		for (const [color, width] of [[COLORS.ink, 0.12], ["#8fdcff", 0.07]]) {
			ctx.strokeStyle = color;
			ctx.lineWidth = width;
			for (const radius of rings) {
				ctx.beginPath();
				ctx.arc(cx, cy, radius, 0, Math.PI * 2);
				ctx.stroke();
			}
		}
		const lift = reducedMotion ? 0.3 : Math.sin(progress * Math.PI) * 0.45;
		ctx.fillStyle = COLORS.white;
		for (let i = 0; i < 6; i++) {
			const angle = (i / 6) * Math.PI * 2;
			ctx.beginPath();
			ctx.arc(cx + Math.cos(angle) * lift, cy + Math.sin(angle) * lift, 0.07, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	function drawBanner(state) {
		if (!state.banner) return;
		const route = routeColor[state.route];
		const y = BUOY_ROW;
		roundRect(1, y + 0.08, COLS - 2, 0.84, 0.2, route.color);
		ctx.strokeStyle = COLORS.ink;
		ctx.lineWidth = 0.05;
		ctx.stroke();
		text(`Level ${state.level} · ${state.banner.text}`, COLS / 2, y + 0.5, 0.36, route.text);
	}

	function draw(state, time) {
		useTiles();
		ctx.clearRect(0, 0, COLS, ROWS);
		drawWater(state, time);
		drawBulkhead(state, time);
		drawPier();
		useTiles();
		for (const lane of state.lanes) {
			for (const vessel of lane.vessels) drawVessel(vessel, lane.row, lane.dir, time);
		}
		const route = routeColor[state.route];
		if (state.status === "playing" || state.status === "ready") {
			drawFerry(state.ferry.x, state.ferry.row, route);
		}
		drawSplash(state);
		drawBanner(state);
	}

	resize();
	return { resize, draw };
}
