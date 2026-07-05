import { db } from "../db.ts";
import type { Period, VideoSource } from "../db.ts";

export interface VideoRow {
  id: number;
  name: string;
  relative_path: string;
  period: string;
  source: VideoSource;
  youtube_id: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

const selectEnabledForPeriod = db.prepare(
  "SELECT * FROM videos WHERE period = ? AND enabled = 1 ORDER BY id ASC"
);

export function toPublicVideo(video: VideoRow) {
  if (video.source === "youtube") {
    return {
      id: video.id,
      name: video.name,
      period: video.period,
      source: "youtube" as const,
      youtubeId: video.youtube_id as string,
    };
  }

  return {
    id: video.id,
    name: video.name,
    period: video.period,
    source: "local" as const,
    path: `/videos/${video.relative_path}`,
  };
}

export function getCurrentVideo(period: Period, date: Date = new Date(), refreshIntervalSeconds = 60) {
  const candidates = selectEnabledForPeriod.all(period) as VideoRow[];
  if (candidates.length === 0) {
    return { video: null };
  }

  const interval = Math.max(1, refreshIntervalSeconds);
  const step = Math.floor(date.getTime() / 1000 / interval);
  const index = step % candidates.length;

  return { video: toPublicVideo(candidates[index]) };
}
