const STORAGE_PREFIX = "aiwindow:playback:";

export function savePlaybackPosition(key: string, seconds: number) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, String(seconds));
  } catch {
    // Ignore storage errors (private browsing, quota, etc.) — resuming is best-effort.
  }
}

export function getPlaybackPosition(key: string): number | null {
  try {
    const value = localStorage.getItem(STORAGE_PREFIX + key);
    return value ? Number(value) : null;
  } catch {
    return null;
  }
}
