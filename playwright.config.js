import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
	testDir: "e2e",
	fullyParallel: true,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: "retain-on-failure",
	},
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"] } },
		{ name: "iphone", use: { ...devices["iPhone 13"] } },
	],
	webServer: {
		command: "node scripts/serve.js",
		url: `http://127.0.0.1:${PORT}/`,
		env: { PORT: String(PORT) },
		reuseExistingServer: false,
	},
});
