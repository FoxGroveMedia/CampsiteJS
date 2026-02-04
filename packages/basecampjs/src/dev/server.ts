import { createServer, IncomingMessage, ServerResponse, Server } from "http";
import { existsSync } from "fs";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { getExt } from "../utils/fs.js";
import { kolor } from "../utils/logger.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

/**
 * Serve static files from a directory
 */
export function serve(outDir: string, port: number = 4173): Server {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const urlPath = decodeURI((req.url || "/").split("?")[0]);
    const safePath = urlPath.replace(/\.\.+/g, "");
    const requestPath = safePath.replace(/^\/+/, "") || "index.html";
    let filePath = join(outDir, requestPath);
    const notFoundPath = join(outDir, "404.html");
    const indexPath = join(outDir, "index.html");
    let isNotFoundResponse = false;

    try {
      const stats = await stat(filePath);
      if (stats.isDirectory()) {
        filePath = join(filePath, "index.html");
        await stat(filePath);
      }
    } catch {
      if (existsSync(notFoundPath)) {
        filePath = notFoundPath;
        isNotFoundResponse = true;
      } else {
        filePath = indexPath;
      }
    }

    try {
      const data = await readFile(filePath);
      const type = MIME_TYPES[getExt(filePath)] || "text/plain";
      res.writeHead(isNotFoundResponse ? 404 : 200, { "Content-Type": type });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  });

  server.listen(port, () => {
    console.log(kolor.green(`Serving dist at http://localhost:${port}`));
  });

  return server;
}
