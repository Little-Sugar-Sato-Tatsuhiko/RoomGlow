import { Router } from "express";
import { db, PERIODS } from "../db.ts";
import { scanVideos } from "../services/videoScanner.ts";
import type { VideoRow } from "../services/playlistService.ts";

export const videosRouter = Router();

function toVideoListItem(video: VideoRow) {
  const base = {
    id: video.id,
    name: video.name,
    period: video.period,
    enabled: Boolean(video.enabled),
    createdAt: video.created_at,
    updatedAt: video.updated_at,
  };

  if (video.source === "youtube") {
    return { ...base, source: "youtube" as const, youtubeId: video.youtube_id as string };
  }

  return { ...base, source: "local" as const, path: `/videos/${video.relative_path}` };
}

function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.slice(1).split("/")[0] || null;
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.searchParams.has("v")) return url.searchParams.get("v");
      const match = url.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/);
      if (match) return match[1];
    }
  } catch {
    return null;
  }

  return null;
}

async function fetchYoutubeTitle(videoId: string): Promise<string | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;
    const data = (await response.json()) as { title?: string };
    return data.title ?? null;
  } catch {
    return null;
  }
}

const selectAll = db.prepare(
  "SELECT * FROM videos ORDER BY period ASC, name ASC"
);
const selectById = db.prepare("SELECT * FROM videos WHERE id = ?");
const selectByRelativePath = db.prepare("SELECT * FROM videos WHERE relative_path = ?");
const updateEnabled = db.prepare(
  "UPDATE videos SET enabled = ?, updated_at = ? WHERE id = ?"
);
const updateImported = db.prepare(
  "UPDATE videos SET name = ?, enabled = ?, updated_at = ? WHERE id = ?"
);
const deleteById = db.prepare("DELETE FROM videos WHERE id = ?");
const insertYoutubeVideo = db.prepare(`
  INSERT INTO videos (name, relative_path, period, source, youtube_id, enabled, created_at, updated_at)
  VALUES (@name, @relative_path, @period, 'youtube', @youtube_id, 1, @now, @now)
`);
const insertImportedVideo = db.prepare(`
  INSERT INTO videos (name, relative_path, period, source, youtube_id, enabled, created_at, updated_at)
  VALUES (@name, @relative_path, @period, @source, @youtube_id, @enabled, @now, @now)
`);

interface ExportedVideo {
  name: string;
  period: string;
  enabled: boolean;
  source: "local" | "youtube";
  relativePath?: string;
  youtubeId?: string;
}

function toExportItem(video: VideoRow): ExportedVideo {
  const base = {
    name: video.name,
    period: video.period,
    enabled: Boolean(video.enabled),
  };

  if (video.source === "youtube") {
    return { ...base, source: "youtube", youtubeId: video.youtube_id as string };
  }
  return { ...base, source: "local", relativePath: video.relative_path };
}

videosRouter.get("/", (_req, res) => {
  const videos = (selectAll.all() as VideoRow[]).map(toVideoListItem);
  res.json({ videos });
});

videosRouter.get("/export", (_req, res) => {
  const videos = (selectAll.all() as VideoRow[]).map(toExportItem);
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    videos,
  };

  const filename = `roomglow-playlist-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.json(exportData);
});

videosRouter.post("/import", (req, res) => {
  const entries = req.body?.videos;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: "'videos' must be an array" });
  }

  let imported = 0;
  let updated = 0;
  const skipped: string[] = [];

  const applyImport = db.transaction((items: unknown[]) => {
    for (const item of items) {
      const entry = item as Partial<ExportedVideo>;

      if (!entry || typeof entry.name !== "string" || !PERIODS.includes(entry.period as never)) {
        skipped.push(entry?.name ?? "(不明)");
        continue;
      }

      let relativePath: string | null = null;
      if (entry.source === "youtube" && typeof entry.youtubeId === "string") {
        relativePath = `youtube/${entry.period}/${entry.youtubeId}`;
      } else if (entry.source === "local" && typeof entry.relativePath === "string") {
        relativePath = entry.relativePath;
      }

      if (!relativePath) {
        skipped.push(entry.name);
        continue;
      }

      const now = new Date().toISOString();
      const existing = selectByRelativePath.get(relativePath) as VideoRow | undefined;
      const enabled = entry.enabled !== false;

      if (existing) {
        updateImported.run(entry.name, enabled ? 1 : 0, now, existing.id);
        updated += 1;
      } else {
        insertImportedVideo.run({
          name: entry.name,
          relative_path: relativePath,
          period: entry.period,
          source: entry.source,
          youtube_id: entry.source === "youtube" ? entry.youtubeId : null,
          enabled: enabled ? 1 : 0,
          now,
        });
        imported += 1;
      }
    }
  });
  applyImport(entries);

  console.log(`[Videos] Import: ${imported} added, ${updated} updated, ${skipped.length} skipped`);
  const videos = (selectAll.all() as VideoRow[]).map(toVideoListItem);
  res.json({ imported, updated, skipped, videos });
});

videosRouter.post("/scan", (_req, res) => {
  const result = scanVideos();
  const videos = (selectAll.all() as VideoRow[]).map(toVideoListItem);
  res.json({ ...result, videos });
});

videosRouter.post("/youtube", async (req, res) => {
  const { url, videoId: rawVideoId, period, title } = req.body ?? {};

  if (!PERIODS.includes(period)) {
    return res.status(400).json({ error: `'period' must be one of: ${PERIODS.join(", ")}` });
  }

  const videoId = extractYoutubeId(rawVideoId ?? url ?? "");
  if (!videoId) {
    return res.status(400).json({ error: "Could not extract a YouTube video ID from 'url' or 'videoId'" });
  }

  const relativePath = `youtube/${period}/${videoId}`;
  if (selectByRelativePath.get(relativePath)) {
    return res.status(409).json({ error: "This YouTube video is already registered for this period" });
  }

  const resolvedTitle = (typeof title === "string" && title.trim()) || (await fetchYoutubeTitle(videoId)) || videoId;
  const now = new Date().toISOString();
  const result = insertYoutubeVideo.run({
    name: resolvedTitle,
    relative_path: relativePath,
    period,
    youtube_id: videoId,
    now,
  });

  console.log(`[Videos] Added YouTube video ${videoId} ("${resolvedTitle}") to ${period}`);
  const created = selectById.get(result.lastInsertRowid) as VideoRow;
  res.status(201).json(toVideoListItem(created));
});

videosRouter.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = selectById.get(id) as VideoRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: "Video not found" });
  }

  if (typeof req.body.enabled !== "boolean") {
    return res.status(400).json({ error: "'enabled' must be a boolean" });
  }

  updateEnabled.run(req.body.enabled ? 1 : 0, new Date().toISOString(), id);
  const updated = selectById.get(id) as VideoRow;
  res.json(toVideoListItem(updated));
});

videosRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = selectById.get(id) as VideoRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: "Video not found" });
  }

  deleteById.run(id);
  console.log(`[Videos] Deleted video ${id} ("${existing.name}")`);
  res.status(204).end();
});
