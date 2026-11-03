// A small static file server for local play and the E2E tests.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT) || 5173;
const host = process.env.HOST || "127.0.0.1";

const TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".json": "application/json",
};

// Only the files the page actually loads are served.
const ALLOWED = (path) => path === "index.html" || path === "styles.css" || path.startsWith(`src${sep}`);

createServer(async (request, response) => {
	const { pathname } = new URL(request.url, "http://localhost");
	const relative = normalize(decodeURIComponent(pathname === "/" ? "/index.html" : pathname)).slice(1);
	if (relative.includes("..") || !ALLOWED(relative)) {
		response.writeHead(404).end("Not found");
		return;
	}
	try {
		const body = await readFile(join(root, relative));
		response.writeHead(200, {
			"Content-Type": TYPES[extname(relative)] ?? "application/octet-stream",
			"Cache-Control": "no-store",
		});
		response.end(body);
	} catch {
		response.writeHead(404).end("Not found");
	}
}).listen(port, host, () => {
	console.log(`Ferrogger is boarding at http://${host}:${port}/`);
});
