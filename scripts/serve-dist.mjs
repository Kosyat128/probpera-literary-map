import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const port = Number(process.env.PORT) || 4174;
const host = process.env.HOST || "127.0.0.1";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

async function resolvePublicFile(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${host}`).pathname);
  const relativePath = pathname.replace(/^\/+/u, "");
  const requestedPath = path.resolve(distDirectory, relativePath);
  if (
    requestedPath !== distDirectory &&
    !requestedPath.startsWith(`${distDirectory}${path.sep}`)
  ) {
    return null;
  }
  try {
    const stats = await fs.stat(requestedPath);
    return stats.isDirectory() ? path.join(requestedPath, "index.html") : requestedPath;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  let filePath = await resolvePublicFile(request.url || "/");
  let statusCode = 200;
  if (!filePath) {
    filePath = path.join(distDirectory, "404.html");
    statusCode = 404;
  }
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) throw new Error("not a file");
    response.writeHead(statusCode, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stats.size,
      "Cache-Control": path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Страница не найдена");
  }
});

server.listen(port, host, () => {
  console.log(`Доменный предпросмотр: http://${host}:${port}/`);
});
