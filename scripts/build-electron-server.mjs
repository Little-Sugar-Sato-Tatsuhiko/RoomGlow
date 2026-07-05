import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await build({
  entryPoints: [path.join(rootDir, "server/index.ts")],
  outfile: path.join(rootDir, "electron/server-bundle.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["better-sqlite3", "vite"],
  logLevel: "info",
});

console.log("[build-electron-server] Bundled server -> electron/server-bundle.cjs");
