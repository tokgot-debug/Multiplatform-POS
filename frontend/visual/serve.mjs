/**
 * Minimal static server for the exported build, used by the visual harness.
 *
 * `output: "export"` means there is no `next start`, and the app is plain files,
 * so node:http is enough - no dependency needed for this.
 */

import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { readFile, stat } from "node:fs/promises";

const ROOT = new URL("../out/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const PORT = Number(process.env.VISUAL_PORT || 3100);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

async function resolve(pathname) {
  // Reject traversal before touching the filesystem.
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  let candidate = join(ROOT, safe);

  try {
    if ((await stat(candidate)).isDirectory()) candidate = join(candidate, "index.html");
    return candidate;
  } catch {
    // trailingSlash routes export as <route>/index.html
    for (const attempt of [`${candidate}.html`, join(candidate, "index.html")]) {
      try {
        await stat(attempt);
        return attempt;
      } catch {
        // try the next shape
      }
    }
    return null;
  }
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, `http://localhost:${PORT}`);
  const file = await resolve(pathname);

  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
    return;
  }

  try {
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain" });
    response.end(String(error));
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`visual harness serving ${ROOT} on http://127.0.0.1:${PORT}`);
});
