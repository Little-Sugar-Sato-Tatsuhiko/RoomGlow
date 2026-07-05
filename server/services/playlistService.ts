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

// Which candidate (by array index, once sorted) is currently playing for each
// period. Advances only when the client reports the playing video reached its
// natural end, so multi-video rotation plays each one to completion rather
// than cutting it off on a fixed timer.
const currentIndexByPeriod = new Map<Period, number>();

export function getCurrentVideo(period: Period) {
  const candidates = selectEnabledForPeriod.all(period) as VideoRow[];
  if (candidates.length === 0) {
    return { video: null, hasMultipleVideos: false };
  }

  const index = (currentIndexByPeriod.get(period) ?? 0) % candidates.length;
  return { video: toPublicVideo(candidates[index]), hasMultipleVideos: candidates.length > 1 };
}

export function advanceVideo(period: Period) {
  const candidates = selectEnabledForPeriod.all(period) as VideoRow[];
  if (candidates.length === 0) {
    currentIndexByPeriod.set(period, 0);
    return { video: null, hasMultipleVideos: false };
  }

  const nextIndex = ((currentIndexByPeriod.get(period) ?? 0) + 1) % candidates.length;
  currentIndexByPeriod.set(period, nextIndex);
  return { video: toPublicVideo(candidates[nextIndex]), hasMultipleVideos: candidates.length > 1 };
}
