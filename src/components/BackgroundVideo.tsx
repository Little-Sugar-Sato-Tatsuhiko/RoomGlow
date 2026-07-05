import { useEffect, useRef, useState } from "react";
import type { Video } from "../types.ts";
import YoutubeBackground from "./YoutubeBackground.tsx";
import { getPlaybackPosition, savePlaybackPosition } from "../lib/playbackPosition.ts";

const SAVE_POSITION_INTERVAL_MS = 5000;

interface Props {
  video: Video | null;
  loop: boolean;
  onEnded: () => void;
}

interface Slot {
  video: Video | null;
  visible: boolean;
}

function videoKey(video: Video | null): string | null {
  if (!video) return null;
  return video.source === "youtube" ? `youtube:${video.youtubeId}` : `local:${video.path}`;
}

interface LocalVideoLayerProps {
  className: string;
  path: string;
  storageKey: string;
  loop: boolean;
  onError: () => void;
  onEnded: () => void;
}

function LocalVideoLayer({ className, path, storageKey, loop, onError, onEnded }: LocalVideoLayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    function restorePosition() {
      const saved = getPlaybackPosition(storageKey);
      if (saved) videoEl!.currentTime = saved;
    }

    restorePosition();
    videoEl.addEventListener("loadedmetadata", restorePosition);

    const intervalId = window.setInterval(() => {
      if (!videoEl.paused) savePlaybackPosition(storageKey, videoEl.currentTime);
    }, SAVE_POSITION_INTERVAL_MS);

    return () => {
      videoEl.removeEventListener("loadedmetadata", restorePosition);
      window.clearInterval(intervalId);
      savePlaybackPosition(storageKey, videoEl.currentTime);
    };
  }, [storageKey]);

  return (
    <video
      ref={videoRef}
      className={className}
      src={path}
      autoPlay
      loop={loop}
      muted
      playsInline
      onError={onError}
      onEnded={onEnded}
    />
  );
}

export default function BackgroundVideo({ video, loop, onEnded }: Props) {
  const [slots, setSlots] = useState<[Slot, Slot]>([
    { video: null, visible: true },
    { video: null, visible: false },
  ]);
  const [hasError, setHasError] = useState(false);
  const activeIndexRef = useRef(0);
  const currentKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const nextKey = videoKey(video);
    if (nextKey === currentKeyRef.current) return;
    currentKeyRef.current = nextKey;
    setHasError(false);

    const activeIndex = activeIndexRef.current;
    const nextIndex = activeIndex === 0 ? 1 : 0;

    setSlots((prev) => {
      const updated = [...prev] as [Slot, Slot];
      updated[nextIndex] = { video, visible: true };
      updated[activeIndex] = { ...updated[activeIndex], visible: false };
      return updated;
    });
    activeIndexRef.current = nextIndex;
  }, [video]);

  const hasAnyVideo = slots.some((slot) => slot.video);

  if (hasError || !hasAnyVideo) {
    return <div className="background-video background-video--fallback" />;
  }

  return (
    <div className="background-video">
      {slots.map((slot, index) => {
        if (!slot.video) return null;
        const key = videoKey(slot.video)!;
        const layerClassName = `background-video__layer ${slot.visible ? "is-visible" : ""}`;
        const handleError = () => {
          if (index === activeIndexRef.current) setHasError(true);
        };

        const handleEnded = () => {
          if (index === activeIndexRef.current) onEnded();
        };

        if (slot.video.source === "youtube") {
          return (
            <div key={key} className={layerClassName}>
              <YoutubeBackground
                videoId={slot.video.youtubeId}
                loop={loop}
                onError={handleError}
                onEnded={handleEnded}
              />
            </div>
          );
        }

        return (
          <LocalVideoLayer
            key={key}
            className={layerClassName}
            path={slot.video.path}
            storageKey={key}
            loop={loop}
            onError={handleError}
            onEnded={handleEnded}
          />
        );
      })}
    </div>
  );
}
