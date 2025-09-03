import "dotenv/config"; // Load .env first
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { initializeDatabase } from "./db";

// Log where .env is expected from and values; avoid multiple config() calls
try {
  const cwdEnv = path.resolve(process.cwd(), ".env");
  const here = fileURLToPath(import.meta.url);
  const hereDir = path.dirname(here);
  const distEnv = path.resolve(hereDir, "..", ".env");
  const candidates = [cwdEnv, distEnv];
  const found = candidates.find(p => fs.existsSync(p));
  if (found) {
    console.log(`[env] expected from: ${found}`);
  } else {
    console.log(`[env] using default dotenv search (no explicit .env found)`);
  }
  console.log(`[env] GOOGLE_REVIEW_URL=${process.env.GOOGLE_REVIEW_URL || '<undefined>'}`);
  console.log(`[env] GOOGLE_PLACE_ID=${process.env.GOOGLE_PLACE_ID || '<undefined>'}`);
  console.log(`[env] REVIEW_OVERRIDE=${process.env.REVIEW_OVERRIDE || '<undefined>'}`);
  console.log(`[env] PLACE_ID=${process.env.PLACE_ID || '<undefined>'}`);
} catch {}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize SQLite database
  initializeDatabase();
  
  // Register webhook endpoints early
  try { const { registerWebhookRoutes } = await import('./routes'); registerWebhookRoutes(app); } catch {}

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Schedule feedback follow-up SLA notifications
  try {
    const { storage } = await import('./storage');
    // run once on boot
    storage.notifyOverdueFeedbackFollowUps().catch(() => {});
    // check every 15 minutes
    setInterval(() => {
      storage.notifyOverdueFeedbackFollowUps().catch(() => {});
    }, 15 * 60 * 1000);
  } catch {}
})();
