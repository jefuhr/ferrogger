import { test } from "node:test";
import assert from "node:assert/strict";
import {
	COLS,
	HOME_ROW,
	START_COL,
	SLIP_COLS,
	INSET,
	MARGIN,
	DEATH_MS,
	crossingMs,
	createGame,
	startGame,
	step,
} from "../src/game.js";

function playing(options = {}) {
	return startGame(createGame({ seed: 1, calm: true, ...options }));
}

function laneAt(state, row) {
	const lane = state.lanes.find((candidate) => candidate.row === row);
	assert.ok(lane, `expected a lane on row ${row}`);
	return lane;
}

function withLane(state, row, patch) {
	const next = structuredClone(state);
	Object.assign(laneAt(next, row), patch);
	return next;
}

function place(state, x, row) {
	const next = structuredClone(state);
	next.ferry.x = x;
	next.ferry.row = row;
	return next;
}

function repeat(direction, count) {
	return Array.from({ length: count }, () => direction);
}

// Drive from the home pier straight up into the slip above `col`.
function driveTo(state, col) {
	const sideways = col - START_COL;
	const moves = [
		...repeat(sideways < 0 ? "left" : "right", Math.abs(sideways)),
		...repeat("up", HOME_ROW),
	];
	return step(state, 0, moves);
}

test("a new game starts ready, on the home pier, with three lives", () => {
	const state = createGame({ seed: 1 });
	assert.equal(state.status, "ready");
	assert.equal(state.lives, 3);
	assert.equal(state.ferry.row, HOME_ROW);
	assert.equal(state.ferry.x, START_COL);
	assert.equal(state.slips.length, 5);
	assert.deepEqual(state.slips.map((slip) => slip.col), SLIP_COLS);
});

test("inputs are ignored and the clock does not run before the game starts", () => {
	const state = createGame({ seed: 1, calm: true });
	const next = step(state, 5000, ["up", "left"]);
	assert.equal(next.ferry.row, HOME_ROW);
	assert.equal(next.ferry.x, START_COL);
	assert.equal(next.timeLeftMs, state.timeLeftMs);
});

test("one input moves exactly one tile", () => {
	const state = playing();
	assert.equal(step(state, 0, ["up"]).ferry.row, HOME_ROW - 1);
	assert.equal(step(state, 0, ["left"]).ferry.x, START_COL - 1);
	assert.equal(step(state, 0, ["right"]).ferry.x, START_COL + 1);
	assert.equal(step(state, 0, ["up", "up"]).ferry.row, HOME_ROW - 2);
});

test("moves are clamped at the river edges and the home pier", () => {
	const left = place(playing(), 0, HOME_ROW);
	assert.equal(step(left, 0, ["left"]).ferry.x, 0);
	const right = place(playing(), COLS - 1, HOME_ROW);
	assert.equal(step(right, 0, ["right"]).ferry.x, COLS - 1);
	assert.equal(step(playing(), 0, ["down"]).ferry.row, HOME_ROW);
	const drifted = place(playing(), 0.4, 6);
	assert.equal(step(drifted, 0, ["left"]).ferry.x, 0);
});

test("the original game state is never mutated", () => {
	const state = playing();
	const snapshot = structuredClone(state);
	step(state, 1000, ["up", "left"]);
	assert.deepEqual(state, snapshot);
});

test("vessels moving right wrap seamlessly back to the left margin", () => {
	const state = withLane(playing(), 10, {
		dir: 1,
		speed: 1,
		vessels: [{ x: COLS + MARGIN - 0.1, len: 2, type: "taxi" }],
	});
	const vessel = laneAt(step(state, 200, []), 10).vessels[0];
	assert.ok(Math.abs(vessel.x - (-MARGIN + 0.1)) < 1e-9, `x was ${vessel.x}`);
});

test("vessels moving left wrap seamlessly back to the right margin", () => {
	const state = withLane(playing(), 10, {
		dir: -1,
		speed: 1,
		vessels: [{ x: -MARGIN + 0.1, len: 2, type: "taxi" }],
	});
	const vessel = laneAt(step(state, 200, []), 10).vessels[0];
	assert.ok(Math.abs(vessel.x - (COLS + MARGIN - 0.1)) < 1e-9, `x was ${vessel.x}`);
});

test("a vessel exactly touching the ferry's hitbox is a near miss", () => {
	const x = 4;
	const state = place(
		withLane(playing(), 10, {
			speed: 0,
			vessels: [{ x: x + 1 - INSET, len: 2, type: "taxi" }],
		}),
		x,
		10,
	);
	assert.equal(step(state, 16, []).status, "playing");
});

test("a sliver of overlap with a vessel sinks the ferry", () => {
	const x = 4;
	const state = place(
		withLane(playing(), 10, {
			speed: 0,
			vessels: [{ x: x + 1 - INSET - 0.01, len: 2, type: "taxi" }],
		}),
		x,
		10,
	);
	const next = step(state, 16, []);
	assert.equal(next.status, "dying");
	assert.equal(next.deathCause, "collision");
	assert.equal(next.lives, 2);
});

test("moving into a vessel's lane sinks the ferry", () => {
	const state = withLane(playing(), HOME_ROW - 1, {
		speed: 0,
		vessels: [{ x: START_COL - 0.5, len: 2, type: "kayak" }],
	});
	assert.equal(step(state, 0, ["up"]).status, "dying");
});

test("the current drifts the ferry sideways", () => {
	const state = place(withLane(playing(), 3, { current: 0.5 }), 4, 3);
	const next = step(state, 1000, []);
	assert.ok(Math.abs(next.ferry.x - 4.5) < 1e-9, `x was ${next.ferry.x}`);
	assert.equal(next.status, "playing");
});

test("being swept off either edge sinks the ferry", () => {
	const right = place(withLane(playing(), 3, { current: 1 }), COLS - 1, 3);
	const sweptRight = step(right, 1000, []);
	assert.equal(sweptRight.status, "dying");
	assert.equal(sweptRight.deathCause, "swept");

	const left = place(withLane(playing(), 3, { current: -1 }), 0, 3);
	assert.equal(step(left, 1000, []).deathCause, "swept");
});

test("the current does not move the ferry on calm rows", () => {
	const state = place(playing(), 4, 6);
	assert.equal(step(state, 1000, []).ferry.x, 4);
});

test("docking in an empty slip fills it and sends a new boat out", () => {
	const state = playing();
	const next = driveTo(state, SLIP_COLS[2]);
	assert.equal(next.slips[2].filled, true);
	assert.equal(next.status, "playing");
	assert.equal(next.lives, 3);
	assert.equal(next.ferry.row, HOME_ROW);
	assert.equal(next.ferry.x, START_COL);
	assert.notEqual(next.ferry.vesselName, undefined);
	assert.ok(next.events.some((event) => event.type === "dock"));
});

test("docking pays row points, the docking bonus and a time bonus", () => {
	const next = driveTo(playing(), SLIP_COLS[2]);
	const rowPoints = (HOME_ROW - 1) * 10;
	const timeBonus = Math.ceil(crossingMs(1) / 1000) * 5;
	assert.equal(next.score, rowPoints + 50 + timeBonus);
});

test("waiting passengers are worth a bonus", () => {
	const state = structuredClone(playing());
	state.slips[2].passengers = 5000;
	const plain = driveTo(playing(), SLIP_COLS[2]).score;
	const next = driveTo(state, SLIP_COLS[2]);
	assert.equal(next.score, plain + 200);
	assert.equal(next.slips[2].passengers, 0);
});

test("docking in a filled slip sinks the ferry", () => {
	const state = structuredClone(playing());
	state.slips[2].filled = true;
	const next = driveTo(state, SLIP_COLS[2]);
	assert.equal(next.status, "dying");
	assert.equal(next.deathCause, "occupied");
});

test("a slip with a seagull on it is blocked", () => {
	const state = structuredClone(playing());
	state.slips[2].gull = 5000;
	const next = driveTo(state, SLIP_COLS[2]);
	assert.equal(next.status, "dying");
	assert.equal(next.deathCause, "gull");
});

test("hitting the bulkhead between slips sinks the ferry", () => {
	const next = driveTo(playing(), SLIP_COLS[2] + 1);
	assert.equal(next.status, "dying");
	assert.equal(next.deathCause, "bulkhead");
});

test("a slightly drifted ferry still docks in the slip it is lined up with", () => {
	const state = place(playing(), SLIP_COLS[1] + 0.3, 1);
	assert.equal(step(state, 0, ["up"]).slips[1].filled, true);
});

test("running out of time sinks the ferry and the clock resets on respawn", () => {
	const state = playing();
	const late = step(state, crossingMs(1), []);
	assert.equal(late.status, "dying");
	assert.equal(late.deathCause, "late");
	assert.equal(late.lives, 2);

	const respawned = step(late, DEATH_MS, []);
	assert.equal(respawned.status, "playing");
	assert.equal(respawned.timeLeftMs, crossingMs(1));
	assert.equal(respawned.ferry.row, HOME_ROW);
});

test("the clock resets after docking", () => {
	const state = step(playing(), 10000, []);
	const docked = driveTo(state, SLIP_COLS[0]);
	assert.equal(docked.timeLeftMs, crossingMs(1));
});

test("the ferry cannot move while sinking", () => {
	const late = step(playing(), crossingMs(1), []);
	const next = step(late, 10, ["left", "up"]);
	assert.equal(next.ferry.x, late.ferry.x);
	assert.equal(next.ferry.row, late.ferry.row);
});

test("row points only count rows newer than the furthest reached", () => {
	const state = playing();
	assert.equal(step(state, 0, repeat("up", 3)).score, 30);
	assert.equal(step(state, 0, ["up", "up", "up", "down", "up"]).score, 30);
	assert.equal(step(state, 0, ["up", "up", "up", "down", "up", "up"]).score, 40);
});

test("row points start over for each new boat", () => {
	const state = step(playing(), 0, repeat("up", 3));
	const late = step(state, crossingMs(1), []);
	const respawned = step(late, DEATH_MS, []);
	assert.equal(step(respawned, 0, ["up"]).score, 40);
});

test("filling all five slips clears the level", () => {
	const state = structuredClone(playing());
	for (const slip of state.slips.slice(0, 4)) slip.filled = true;
	const before = state.score;
	const next = driveTo(state, SLIP_COLS[4]);
	assert.equal(next.level, 2);
	assert.ok(next.slips.every((slip) => !slip.filled));
	assert.ok(next.score >= before + 1000);
	assert.ok(next.events.some((event) => event.type === "level"));
});

test("later levels run faster and flip the tide", () => {
	const one = createGame({ seed: 7, level: 1 });
	const two = createGame({ seed: 7, level: 2 });
	for (const lane of one.lanes) {
		const harder = laneAt(two, lane.row);
		assert.ok(harder.speed > lane.speed, `row ${lane.row} did not speed up`);
	}
	assert.equal(two.tide, -one.tide);
});

test("every lane leaves a gap wide enough to pass", () => {
	for (let level = 1; level <= 8; level++) {
		const state = createGame({ seed: level * 31, level });
		for (const lane of state.lanes) {
			const loop = COLS + 2 * MARGIN;
			const sorted = [...lane.vessels].sort((a, b) => a.x - b.x);
			sorted.forEach((vessel, index) => {
				const next = sorted[(index + 1) % sorted.length];
				const gap = (next.x - (vessel.x + vessel.len) + loop) % loop;
				assert.ok(sorted.length === 1 || gap >= 2, `level ${level} row ${lane.row} gap ${gap}`);
			});
		}
	}
});

test("losing the last boat ends the game and inputs are then ignored", () => {
	const state = structuredClone(playing());
	state.lives = 1;
	const late = step(state, crossingMs(1), []);
	const over = step(late, DEATH_MS, []);
	assert.equal(over.status, "over");
	assert.equal(over.lives, 0);
	const after = step(over, 1000, ["up", "left"]);
	assert.equal(after.ferry.row, over.ferry.row);
	assert.equal(after.ferry.x, over.ferry.x);
	assert.equal(after.score, over.score);
});

test("the same seed and inputs always replay the same game", () => {
	const script = [["up"], [], ["left"], ["up", "up"], [], ["right"], ["up"]];
	const run = () => {
		let state = startGame(createGame({ seed: 42 }));
		for (const inputs of script) state = step(state, 250, inputs);
		for (let i = 0; i < 120; i++) state = step(state, 1000 / 60, []);
		return state;
	};
	assert.deepEqual(run(), run());
});

test("different seeds lay out different traffic", () => {
	const a = createGame({ seed: 1 }).lanes.map((lane) => lane.vessels.map((v) => v.x));
	const b = createGame({ seed: 2 }).lanes.map((lane) => lane.vessels.map((v) => v.x));
	assert.notDeepEqual(a, b);
});

test("the Staten Island Ferry sounds its horn once as it comes on screen", () => {
	const state = withLane(playing(), 3, {
		dir: -1,
		speed: 1,
		current: 0,
		vessels: [{ x: COLS + 1.05, len: 4, type: "siferry", honked: false }],
	});
	const first = step(state, 100, []);
	assert.equal(first.events.filter((event) => event.type === "horn").length, 1);
	const second = step(first, 100, []);
	assert.equal(second.events.filter((event) => event.type === "horn").length, 0);
});
