import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import express, { type ErrorRequestHandler } from "express";

// Node's "Happy Eyeballs" auto family selection can hang on IPv4/IPv6 dual-stack
// lookups in some container network setups, timing out outbound fetch() calls
// (weather, radar, YouTube oEmbed) even though a plain single-family connection
// succeeds instantly. Disable it so fetch falls back to normal connection behavior.
net.setDefaultAutoSelectFamily(false);
import { ROOT_DIR, VIDEOS_DIR } from "./db.ts";
import { scanVideos } from "./services/videoScanner.ts";
import { videosRouter } from "./routes/videos.ts";
import { settingsRouter } from "./routes/settings.ts";
import { statusRouter } from "./routes/status.ts";
import { weatherRouter } from "./routes/weather.ts";
import { radarRouter } from "./routes/radar.ts";

const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT) || 3000;

console.log(`[App] Starting ai-window-web in ${isProduction ? "production" : "development"} mode`);

scanVideos();

const app = express();
app.use(express.json());

app.use("/videos", express.static(VIDEOS_DIR));

app.use("/api/videos", videosRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/weather", weatherRouter);
app.use("/api/radar", radarRouter);
app.use("/api", statusRouter);

app.get("/", (_req, res) => res.redirect("/display"));

const httpServer = http.createServer(app);

async function start() {
  if (isProduction) {
    const distDir = process.env.APP_STATIC_DIR || path.join(ROOT_DIR, "dist");
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/videos")) return next();
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: ROOT_DIR,
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: "custom",
    });

    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/videos")) return next();
      try {
        const templatePath = path.join(ROOT_DIR, "index.html");
        let template = fs.readFileSync(templatePath, "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
  }

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    console.error(`[API Error] ${req.method} ${req.path}:`, err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);

  httpServer.listen(port, () => {
    console.log(`[App] Listening on http://localhost:${port}`);
    console.log(`[App] Display: http://localhost:${port}/display`);
    console.log(`[App] Admin:   http://localhost:${port}/admin`);
  });
}

start();
