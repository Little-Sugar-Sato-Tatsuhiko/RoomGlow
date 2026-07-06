# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RoomGlow: an always-on background-video display system (Atmoph Window-style) for a Windows Mini PC + 4K display, or a standalone PC. It's a single Node/Express + React app that runs identically in three shells: Chrome/Edge kiosk mode, Docker, or as an Electron desktop app — the video-selection logic (server) and display components (client) are kept separate so all three shells share the same behavior.

## Commands

```bash
npm install
npm run dev              # dev server via tsx watch, port 3000 (http://localhost:3000/display, /admin)
npm run typecheck        # tsc --noEmit
npm run build            # vite build -> dist/ (required before `npm run start`)
npm run start            # production: NODE_ENV=production tsx server/index.ts, serves dist/
```

There is no test suite and no lint script configured — don't invent `npm test`/`npm run lint` invocations.

Docker (mounts `videos/` and `data/`, source-mounted so `server/`/`src/` hot-reload):

```bash
docker compose up -d --build
curl -X POST http://localhost:3000/api/videos/scan   # rescan videos/ after adding files
```

Electron desktop app:

```bash
npm run electron:start   # build -> build:electron-server -> electron:rebuild -> electron .
npm run electron:build   # same, then electron-builder -> release/ (dmg / nsis)
```

`electron:start`/`electron:build` chain: `vite build` (frontend to `dist/`) → `scripts/build-electron-server.mjs` (esbuild-bundles `server/index.ts` into `electron/server-bundle.cjs`, single file, with `better-sqlite3` and `vite` left external) → `electron-rebuild -f -w better-sqlite3` (rebuilds the native module against Electron's Node ABI) → `electron .`.

**Gotcha:** `better-sqlite3`'s native binary is ABI-specific to whichever runtime last rebuilt it. After running any `electron:*` script, running `npm run dev`/`npm run start` under plain Node will fail until you `npm rebuild` (or reinstall). Docker's `node_modules` is container-isolated and unaffected. This is a common source of "works then suddenly doesn't" — check for an ABI mismatch before debugging further if native module errors appear after switching between Electron and plain-Node runs.

## Architecture

### One server, two frontend surfaces, no build step in dev

`server/index.ts` is the single entry point for every deployment target. In dev it creates a Vite dev server in middleware mode and mounts it on the same Express app (HMR works through the same HTTP server); in production it serves the built `dist/` and falls back to `index.html` for any non-`/api`, non-`/videos` path (SPA routing). TypeScript runs directly via `tsx` in dev/start — there's no separate server compile step outside the Electron bundling path. Imports use explicit `.ts`/`.tsx` extensions (`allowImportingTsExtensions` in tsconfig).

Two client routes, both always relevant:
- `/display` — meant to run 24/7 on the physical screen. Rendered unconditionally in `src/App.tsx` (not inside `<Routes>`), so it never unmounts.
- `/admin` — rendered as a `<Route>` that layers `AdminModal` as an overlay *on top of* the always-mounted `DisplayPage`. This is why opening/closing the admin screen never interrupts video playback — it's not a navigation, it's a modal toggle.

### Video model: local files and YouTube share one table

Both live in the same `videos` SQLite table, discriminated by a `source` column (`local` | `youtube`). `server/services/playlistService.ts#toPublicVideo` converts a DB row into the client-facing shape matching the `Video` union in `src/types.ts` (`LocalVideo` has `path`, `YoutubeVideo` has `youtubeId`). Local files are discovered by `server/services/videoScanner.ts` scanning `videos/{morning,daytime,evening,night}/` for `.mp4/.webm/.mov/.mkv`; YouTube entries are registered via `POST /api/videos/youtube` (URL or ID only — never downloaded, always streamed through the official IFrame Player per YouTube's ToS).

Rotation state (`currentIndexByPeriod` in `playlistService.ts`) is **in-memory, per period, not timer-driven**: the client calls `POST /api/videos/advance` only when the currently playing video fires its natural `ended` event (local `<video>` or YouTube player end event), so multi-video rotations always play each clip to completion regardless of length. A single enabled video per period just loops. This state resets on server restart (by design — no persistence needed).

Playback *position* (as opposed to rotation index) persists across reloads via `localStorage` (`src/lib/playbackPosition.ts`), independent of the server-side rotation index.

### Period (time-of-day) resolution

`server/services/periodService.ts#getCurrentPeriod` supports two modes read from settings:
- `auto`: uses `suncalc` sunrise/sunset for the configured lat/long, then derives morning/daytime/evening/night windows via fixed offsets (`MORNING_DURATION_MINUTES`, `EVENING_LEAD_MINUTES`, `EVENING_TAIL_MINUTES`).
- `manual`: uses four `HH:MM` settings directly.

Both fall back to hardcoded `DEFAULT_BOUNDARIES` if inputs are invalid/missing. Because this depends on the server process's local timezone, Docker (which defaults to UTC) needs `TZ` set in `docker-compose.yml`; Windows Mini PC/Electron just inherit the OS timezone.

### Settings: one key-value table, four places to touch when adding a setting

Settings are stored as a flat `key -> string value` table (`server/db.ts` `DEFAULT_SETTINGS`), typed at read time by `server/routes/settings.ts` via `BOOLEAN_KEYS`/`NUMBER_KEYS`/`TIME_KEYS`/`STRING_KEYS` sets (there's no schema — the classification lives entirely in these sets). Adding a new setting means updating: `DEFAULT_SETTINGS` in `server/db.ts`, the appropriate key-set in `server/routes/settings.ts` (plus any validation branch), the `Settings` interface in `src/types.ts`, and the client-side default object (e.g. `DEFAULT_SETTINGS` in `src/pages/DisplayPage.tsx`).

DB schema migrations are hand-rolled column-existence checks in `server/db.ts` (see the `source`/`youtube_id` column additions) — follow that same `PRAGMA table_info` + conditional `ALTER TABLE` pattern rather than introducing a migration framework.

### External APIs (all keyless, all server-cached, all independently fail-soft)

- Weather: Open-Meteo, 10 min server cache, lat/long from settings (`server/services/weatherService.ts`).
- Location auto-detect: ipapi.co (IP-based), only runs on first boot when coordinates are still at the built-in Tokyo default and `locationSource !== "manual"` (see the startup check in `server/index.ts`); editing lat/long by hand flips `locationSource` to `manual` so it's never silently overwritten again.
- Rain radar: OpenStreetMap tiles + RainViewer, 5 min server cache (`server/services/radarService.ts`); OSM attribution is displayed on-screen per their ToS — don't remove it.
- YouTube: oEmbed for title lookup only; playback is the official IFrame Player, never a download.

Each of these fails independently and only hides its own overlay widget on error — never take down `/display` as a whole. `net.setDefaultAutoSelectFamily(false)` is set in `server/index.ts` to work around Node's Happy Eyeballs causing `fetch()` (but not `curl`/`wget`) to hang in some container network setups — if outbound API calls mysteriously time out only via `fetch`, this is already the fix, don't re-diagnose it.

### Electron shell

`electron/main.cjs` (the `main` field in `package.json`) starts the bundled server (`electron/server-bundle.cjs`) on an OS-assigned free port, redirects `APP_DATA_DIR`/`APP_VIDEOS_DIR` to Electron's per-OS userData directory (so packaged installs don't write inside the app bundle), waits for `/api/status` to respond, then opens a `BrowserWindow` on `/display`. Tray menu and global shortcuts (`Cmd/Ctrl+Shift+A` admin, `+Shift+D` display, `F11` fullscreen, `+Q` quit) call `loadURL` against the same running server rather than spawning new windows/processes.
