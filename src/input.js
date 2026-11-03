// Keyboard, swipe and tap input. Each key press or gesture queues exactly one
// action; held keys do not auto-repeat into extra moves.
const KEYS = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
	w: "up",
	s: "down",
	a: "left",
	d: "right",
	W: "up",
	S: "down",
	A: "left",
	D: "right",
};

const SWIPE_PX = 24;

export function createInput({ surface, onCommand }) {
	const queue = [];
	let pointer = null;

	function push(action) {
		queue.push(action);
	}

	function onKeyDown(event) {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const direction = KEYS[event.key];
		if (direction) {
			event.preventDefault();
			if (!event.repeat) push(direction);
			return;
		}
		if (event.key === "p" || event.key === "P" || event.key === "Escape") onCommand("pause");
		else if (event.key === "m" || event.key === "M") onCommand("mute");
		else if ((event.key === " " || event.key === "Enter") && !event.repeat) {
			event.preventDefault();
			push("any");
		}
	}

	function onPointerDown(event) {
		if (event.button > 0) return;
		pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
	}

	function onPointerUp(event) {
		if (!pointer || pointer.id !== event.pointerId) return;
		const dx = event.clientX - pointer.x;
		const dy = event.clientY - pointer.y;
		pointer = null;
		if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) push("up");
		else if (Math.abs(dx) > Math.abs(dy)) push(dx > 0 ? "right" : "left");
		else push(dy > 0 ? "down" : "up");
	}

	function onPointerCancel() {
		pointer = null;
	}

	window.addEventListener("keydown", onKeyDown);
	surface.addEventListener("pointerdown", onPointerDown);
	surface.addEventListener("pointerup", onPointerUp);
	surface.addEventListener("pointercancel", onPointerCancel);

	return {
		drain() {
			return queue.splice(0, queue.length);
		},
	};
}
