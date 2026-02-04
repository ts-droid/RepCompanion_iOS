import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  // Static files are usually in dist/public after vite build
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    log(`Warning: Could not find the build directory: ${distPath}. Continuing as API-only server.`);
    return;
  }

  app.use(express.static(distPath));

  // Fall through to index.html for SPA routing
  app.use("*", (req: Request, res: Response, next) => {
    // Skip if it's an API request
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}
