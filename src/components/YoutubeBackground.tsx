import { useEffect, useId, useRef } from "react";
import { getPlaybackPosition, savePlaybackPosition } from "../lib/playbackPosition.ts";

const SAVE_POSITION_INTERVAL_MS = 5000;
const ERROR_SKIP_DELAY_MS = 3000;
const PLAYER_READY_TIMEOUT_MS = 15000;

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, options: Record<string, unknown>) => YoutubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YoutubePlayer {
  mute(): void;
  playVideo(): void;
  destroy(): void;
  unloadModule?(moduleName: string): void;
  setPlaybackQuality?(quality: string): void;
  getAvailableQualityLevels?(): string[];
  getCurrentTime?(): number;
  seekTo?(seconds: number, allowSeekAhead: boolean): void;
}

function requestHighestQuality(player: YoutubePlayer) {
  const levels = player.getAvailableQualityLevels?.() ?? [];
  const best = levels[0];
  if (best) player.setPlaybackQuality?.(best);
}

let apiPromise: Promise<void> | null = null;

function loadYoutubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });

  return apiPromise;
}

interface Props {
  videoId: string;
  loop: boolean;
  onError: () => void;
  onEnded: () => void;
}

export default function YoutubeBackground({ videoId, loop, onError, onEnded }: Props) {
  const containerId = `yt-player-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const playerRef = useRef<YoutubePlayer | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    let cancelled = false;
    let errorSkipTimeoutId: number | undefined;

    function skipAfterError() {
      onErrorRef.current();
      window.clearTimeout(errorSkipTimeoutId);
      errorSkipTimeoutId = window.setTimeout(() => {
        if (!cancelled) onEndedRef.current();
      }, ERROR_SKIP_DELAY_MS);
    }

    const readyTimeoutId = window.setTimeout(skipAfterError, PLAYER_READY_TIMEOUT_MS);

    loadYoutubeApi().then(() => {
      if (cancelled || !window.YT) return;
      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          playsinline: 1,
          disablekb: 1,
          fs: 0,
          ...(loop ? { loop: 1, playlist: videoId } : {}),
        },
        events: {
          onReady: (event: { target: YoutubePlayer }) => {
            window.clearTimeout(readyTimeoutId);
            event.target.mute();
            event.target.playVideo();
            event.target.unloadModule?.("cc");
            requestHighestQuality(event.target);

            const saved = getPlaybackPosition(`youtube:${videoId}`);
            if (saved) event.target.seekTo?.(saved, true);
          },
          onStateChange: (event: { data: number; target: YoutubePlayer }) => {
            if (event.data === 1 /* playing */) requestHighestQuality(event.target);
            if (event.data === 0 /* ended */) onEndedRef.current();
          },
          onError: () => skipAfterError(),
        },
      });
    });

    const intervalId = window.setInterval(() => {
      const currentTime = playerRef.current?.getCurrentTime?.();
      if (typeof currentTime === "number") {
        savePlaybackPosition(`youtube:${videoId}`, currentTime);
      }
    }, SAVE_POSITION_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimeoutId);
      window.clearTimeout(errorSkipTimeoutId);
      window.clearInterval(intervalId);
      const currentTime = playerRef.current?.getCurrentTime?.();
      if (typeof currentTime === "number") {
        savePlaybackPosition(`youtube:${videoId}`, currentTime);
      }
      playerRef.current?.destroy();
    };
  }, [containerId, videoId]);

  return (
    <div className="youtube-background">
      <div id={containerId} />
    </div>
  );
}
