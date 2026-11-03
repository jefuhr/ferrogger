// Mulberry32. The generator state lives on the game state so a seed fully
// determines a run, which keeps the simulation pure and testable.
export function seedState(seed) {
	return seed >>> 0;
}

export function nextRandom(holder) {
	holder.rng = (holder.rng + 0x6d2b79f5) >>> 0;
	let t = holder.rng;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(holder, maxExclusive) {
	return Math.floor(nextRandom(holder) * maxExclusive);
}
