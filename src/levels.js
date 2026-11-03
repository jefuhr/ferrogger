import { nextRandom } from "./rng.js";

// Rows count down from the slips (row 0) to the home pier (row 12). The lower
// river is plain traffic; the upper river adds the East River current, which
// pushes the ferry sideways the way the logs carry the frog in Frogger.
const LANES = [
	{ row: 1, type: "tour", len: 2, dir: -1, speed: 1.2, count: 3, current: 0.3 },
	{ row: 2, type: "jetski", len: 1, dir: 1, speed: 3.0, count: 3, current: 0.45 },
	{ row: 3, type: "siferry", len: 4, dir: -1, speed: 1.6, count: 1, current: 0.6 },
	{ row: 4, type: "taxi", len: 1.5, dir: 1, speed: 2.3, count: 3, current: 0.5 },
	{ row: 5, type: "barge", len: 3, dir: -1, speed: 0.9, count: 2, current: 0.35 },
	{ row: 7, type: "kayak", len: 1, dir: 1, speed: 1.6, count: 4, current: 0 },
	{ row: 8, type: "tour", len: 2, dir: -1, speed: 1.3, count: 3, current: 0 },
	{ row: 9, type: "barge", len: 3, dir: 1, speed: 0.7, count: 2, current: 0 },
	{ row: 10, type: "taxi", len: 1.5, dir: -1, speed: 2.0, count: 3, current: 0 },
	{ row: 11, type: "kayak", len: 1, dir: 1, speed: 0.9, count: 3, current: 0 },
];

// The narrowest gap any lane is allowed to leave between two vessels.
const MIN_GAP = 2;

export function speedFactor(level) {
	return Math.min(2.5, 1 + 0.15 * (level - 1));
}

function currentFactor(level) {
	return Math.min(2, 1 + 0.1 * (level - 1));
}

function vesselCount(template, level, loop) {
	const extra = level >= 5 ? 2 : level >= 3 ? 1 : 0;
	let count = template.count;
	for (let i = 0; i < extra; i++) {
		if ((count + 1) * (template.len + MIN_GAP) <= loop) count++;
	}
	return count;
}

// Spread vessels evenly around the lane's loop, jittered by the seeded RNG but
// never closer than MIN_GAP. Positions are in screen tiles in [-margin, cols + margin).
function layVessels(template, count, holder, cols, margin) {
	const loop = cols + 2 * margin;
	const slot = loop / count;
	// The small trim keeps floating-point error from shaving a gap below MIN_GAP.
	const jitter = Math.max(0, slot - template.len - MIN_GAP - 0.01);
	const base = nextRandom(holder) * loop;
	const vessels = [];
	for (let i = 0; i < count; i++) {
		const raw = base + i * slot + nextRandom(holder) * jitter;
		const x = (raw % loop) - margin;
		vessels.push({
			x,
			len: template.len,
			type: template.type,
			honked: x < cols + 1 && x + template.len > -1,
		});
	}
	return vessels;
}

export function tideForLevel(level) {
	return level % 2 === 1 ? 1 : -1;
}

export function buildLanes({ level, holder, calm, cols, margin }) {
	const tide = tideForLevel(level);
	const loop = cols + 2 * margin;
	return LANES.map((template) => ({
		row: template.row,
		dir: template.dir,
		speed: template.speed * speedFactor(level),
		current: calm ? 0 : template.current * currentFactor(level) * tide,
		vessels: calm
			? []
			: layVessels(template, vesselCount(template, level, loop), holder, cols, margin),
	}));
}
