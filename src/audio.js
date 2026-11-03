// Synthesized sound effects, so the game ships no audio files. Muted until the
// player turns sound on, which also satisfies browser autoplay rules.
export function createAudio({ muted = true } = {}) {
	let context = null;
	let isMuted = muted;

	function ensureContext() {
		if (!context) {
			const AudioContext = window.AudioContext || window.webkitAudioContext;
			if (!AudioContext) return null;
			context = new AudioContext();
		}
		if (context.state === "suspended") context.resume();
		return context;
	}

	function tone({ frequency, duration, type = "square", volume = 0.08, at = 0, slideTo }) {
		const ctx = ensureContext();
		if (!ctx) return;
		const start = ctx.currentTime + at;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(frequency, start);
		if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
		osc.connect(gain).connect(ctx.destination);
		osc.start(start);
		osc.stop(start + duration + 0.05);
	}

	function splash() {
		const ctx = ensureContext();
		if (!ctx) return;
		const length = Math.floor(ctx.sampleRate * 0.5);
		const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
		const source = ctx.createBufferSource();
		const filter = ctx.createBiquadFilter();
		const gain = ctx.createGain();
		filter.type = "lowpass";
		filter.frequency.value = 1200;
		gain.gain.value = 0.25;
		source.buffer = buffer;
		source.connect(filter).connect(gain).connect(ctx.destination);
		source.start();
	}

	const sounds = {
		move: () => tone({ frequency: 520, duration: 0.05, volume: 0.03 }),
		horn: () => {
			tone({ frequency: 98, duration: 1.1, type: "sawtooth", volume: 0.06 });
			tone({ frequency: 147, duration: 1.1, type: "sawtooth", volume: 0.04 });
		},
		dock: () => {
			tone({ frequency: 660, duration: 0.12, type: "triangle", volume: 0.1 });
			tone({ frequency: 990, duration: 0.2, type: "triangle", volume: 0.1, at: 0.1 });
		},
		passengers: () => tone({ frequency: 1320, duration: 0.15, type: "triangle", volume: 0.08, at: 0.25 }),
		sink: splash,
		level: () => {
			[523, 659, 784, 1047].forEach((frequency, index) =>
				tone({ frequency, duration: 0.14, type: "triangle", volume: 0.1, at: index * 0.1 }),
			);
		},
		gameover: () => tone({ frequency: 392, duration: 0.8, type: "triangle", volume: 0.1, slideTo: 98 }),
	};

	return {
		get muted() {
			return isMuted;
		},
		setMuted(value) {
			isMuted = value;
			if (!isMuted) ensureContext();
		},
		play(name) {
			if (isMuted || !sounds[name]) return;
			try {
				sounds[name]();
			} catch {
				// Sound is decoration; a broken audio stack must never stop the game.
			}
		},
	};
}
