import { test, expect } from "@playwright/test";

const CALM = "/?seed=1&debug&calm";
const TRAFFIC = "/?seed=1&debug";

function gameState(page) {
	return page.evaluate(() => window.__ferrogger.state);
}

async function status(page) {
	return (await gameState(page)).status;
}

async function shoot(page, testInfo, name) {
	const path = testInfo.outputPath(`${name}.png`);
	await page.screenshot({ path });
	await testInfo.attach(name, { path, contentType: "image/png" });
}

async function open(page, url) {
	await page.goto(url);
	await page.waitForFunction(() => window.__ferrogger?.state);
}

async function cast(page, isMobile) {
	if (isMobile) await page.tap("#start");
	else await page.keyboard.press("ArrowUp");
	await expect.poll(() => status(page)).toBe("playing");
}

// Put the ferry on top of a vessel that is fully on screen so the next frame sinks it.
async function ram(page) {
	await page.evaluate(() =>
		window.__ferrogger.mutate((state) => {
			for (const lane of state.lanes) {
				const vessel = lane.vessels.find((v) => v.x > 1 && v.x + v.len < 10);
				if (vessel) {
					state.ferry.row = lane.row;
					state.ferry.x = vessel.x + vessel.len / 2 - 0.5;
					return;
				}
			}
			throw new Error("no vessel on screen");
		}),
	);
}

test("the page loads cleanly and the river fills the screen", async ({ page }, testInfo) => {
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
	await open(page, TRAFFIC);
	await expect(page.locator("#start")).toBeVisible();

	const stage = await page.locator("#stage").boundingBox();
	const canvas = await page.locator("#river").boundingBox();
	const fills = canvas.width >= stage.width * 0.85 || canvas.height >= stage.height * 0.85;
	expect(fills, `canvas ${canvas.width}x${canvas.height} in stage ${stage.width}x${stage.height}`).toBe(true);
	await page.waitForTimeout(300);
	expect(errors).toEqual([]);
	await shoot(page, testInfo, "start");
});

test("a key press or tap casts off without moving the ferry", async ({ page, isMobile }, testInfo) => {
	await open(page, TRAFFIC);
	await cast(page, isMobile);
	await expect(page.locator("#start")).toBeHidden();
	expect((await gameState(page)).ferry.row).toBe(12);
	await page.waitForTimeout(600);
	await shoot(page, testInfo, "playing");
});

test("the arrow keys move exactly one tile per press", async ({ page }) => {
	await open(page, CALM);
	await cast(page, false);
	await page.keyboard.press("ArrowUp");
	await expect.poll(async () => (await gameState(page)).ferry.row).toBe(11);
	await page.keyboard.press("ArrowLeft");
	await expect.poll(async () => (await gameState(page)).ferry.x).toBe(4);
	await page.waitForTimeout(200);
	const state = await gameState(page);
	expect(state.ferry.row).toBe(11);
	expect(state.ferry.x).toBe(4);
});

test("a swipe moves one tile and a tap goes forward", async ({ page, isMobile }) => {
	await open(page, CALM);
	await cast(page, isMobile);
	const box = await page.locator("#river").boundingBox();
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;

	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 80, cy + 5, { steps: 4 });
	await page.mouse.up();
	await expect.poll(async () => (await gameState(page)).ferry.x).toBe(6);

	if (isMobile) await page.touchscreen.tap(cx, cy);
	else await page.mouse.click(cx, cy);
	await expect.poll(async () => (await gameState(page)).ferry.row).toBe(11);
	expect((await gameState(page)).ferry.x).toBe(6);
});

test("hitting traffic costs a boat and losing all three ends the game", async ({ page, isMobile }, testInfo) => {
	await open(page, TRAFFIC);
	await cast(page, isMobile);

	await ram(page);
	await expect.poll(() => status(page)).toBe("dying");
	expect((await gameState(page)).lives).toBe(2);
	await expect(page.locator("#lives")).toHaveText("⛴⛴");
	await shoot(page, testInfo, "sinking");

	for (const lives of [1, 0]) {
		await expect.poll(() => status(page)).toBe("playing");
		await ram(page);
		await expect.poll(async () => (await gameState(page)).lives).toBe(lives);
	}
	await expect.poll(() => status(page)).toBe("over");
	await expect(page.locator("#over")).toBeVisible();
	await shoot(page, testInfo, "game-over");
});

test("crossing the river docks the ferry in the slip it reaches", async ({ page, isMobile }, testInfo) => {
	await open(page, CALM);
	await cast(page, isMobile);
	for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowUp");
	await expect.poll(async () => (await gameState(page)).slips[2].filled).toBe(true);
	const state = await gameState(page);
	expect(state.ferry.row).toBe(12);
	expect(state.lives).toBe(3);
	await expect(page.locator("#toast")).toContainText("docked at South Williamsburg");
	await shoot(page, testInfo, "docked");
});

test("no input is lost when frames arrive faster than the game ticks", async ({ page, isMobile }) => {
	// Fake a 240Hz screen: most frames are shorter than one fixed game step.
	await page.addInitScript(() => {
		let now = null;
		window.requestAnimationFrame = (callback) =>
			setTimeout(() => {
				now = (now ?? performance.now()) + 1000 / 240;
				callback(now);
			}, 4);
	});
	await open(page, CALM);
	await cast(page, isMobile);
	for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowUp");
	await expect.poll(async () => (await gameState(page)).slips[2].filled).toBe(true);
});

test("hiding the tab pauses the game and any key resumes it", async ({ page, isMobile }, testInfo) => {
	await open(page, CALM);
	await cast(page, isMobile);
	await page.evaluate(() => {
		Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await expect(page.locator("#paused")).toBeVisible();
	const before = (await gameState(page)).timeLeftMs;
	await page.waitForTimeout(500);
	expect((await gameState(page)).timeLeftMs).toBe(before);
	await shoot(page, testInfo, "paused");

	await page.keyboard.press("ArrowUp");
	await expect(page.locator("#paused")).toBeHidden();
	await expect.poll(async () => (await gameState(page)).timeLeftMs).toBeLessThan(before);
	expect((await gameState(page)).ferry.row).toBe(12);
});

test("the best score survives a reload", async ({ page, isMobile }) => {
	await open(page, CALM);
	await cast(page, isMobile);
	for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowUp");
	await expect.poll(async () => (await gameState(page)).score).toBe(30);
	await page.evaluate(() =>
		window.__ferrogger.mutate((state) => {
			state.lives = 1;
			state.timeLeftMs = 1;
		}),
	);
	await expect.poll(() => status(page)).toBe("over");
	await expect.poll(() => page.evaluate(() => window.__ferrogger.highScore)).toBe(30);

	await page.reload();
	await page.waitForFunction(() => window.__ferrogger?.state);
	await expect(page.locator("#high-score")).toHaveText("30");
});
