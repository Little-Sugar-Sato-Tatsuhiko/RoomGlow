import fs from "node:fs";
import path from "node:path";
import { db, PERIODS, VIDEOS_DIR } from "../db.ts";

const VALID_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".mkv"]);

const insertVideo = db.prepare(`
  INSERT INTO videos (name, relative_path, period, enabled, created_at, updated_at)
  VALUES (@name, @relative_path, @period, 1, @now, @now)
  ON CONFLICT(relative_path) DO NOTHING
`);

export function scanVideos() {
  let found = 0;
  let added = 0;
  const now = new Date().toISOString();

  for (const period of PERIODS) {
    const periodDir = path.join(VIDEOS_DIR, period);
    if (!fs.existsSync(periodDir)) continue;

    const files = fs.readdirSync(periodDir, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile()) continue;
      if (!VALID_EXTENSIONS.has(path.extname(file.name).toLowerCase())) continue;

      found += 1;
      const relativePath = `${period}/${file.name}`;
      const result = insertVideo.run({
        name: file.name,
        relative_path: relativePath,
        period,
        now,
      });
      if (result.changes > 0) added += 1;
    }
  }

  console.log(`[VideoScanner] Scan complete: ${found} file(s) found, ${added} new video(s) registered`);
  return { found, added };
}
