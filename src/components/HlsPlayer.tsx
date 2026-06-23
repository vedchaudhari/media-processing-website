"use client";

import { useEffect, useRef } from "react";
import videojs from "video.js";

// Custom TypeScript-safe interface extending the base Video.js Player type
type VideoJsPlayer = ReturnType<typeof videojs>;

interface ExtendedPlayer extends VideoJsPlayer {
  hlsQualitySelector(options?: { displayCurrentQuality?: boolean }): void;
  qualityLevels(): {
    on(event: string, callback: () => void): void;
    off(event: string, callback: () => void): void;
    [key: number]: any;
    length: number;
    selectedIndex: number;
  };
}

// Import Video.js default styles
import "video.js/dist/video-js.css";

interface HlsPlayerProps {
  src: string;
}

// Define player configuration options externally for modularity and easy future additions
const PLAYER_OPTIONS = {
  autoplay: false,
  controls: true,
  responsive: true,
  fluid: true,
  playbackRates: [0.5, 1, 1.5, 2],
  controlBar: {
    skipButtons: {
      forward: 10,
      backward: 10,
    },
  },
};

export default function HlsPlayer({ src }: HlsPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<ExtendedPlayer | null>(null);

  // 1. Initialize player once on mount
  useEffect(() => {
    if (playerRef.current) return;

    const containerElement = containerRef.current;
    if (!containerElement) return;

    // Dynamically register the quality levels and quality selector plugins on the client
    if (typeof window !== "undefined") {
      require("videojs-contrib-quality-levels");
      require("videojs-hls-quality-selector");
    }

    // Create a new video-js element dynamically to avoid React hydration / DOM mismatch
    const videoElement = document.createElement("video-js");
    videoElement.classList.add("vjs-big-play-centered", "w-full", "aspect-video");
    containerElement.appendChild(videoElement);

    const player: ExtendedPlayer = videojs(videoElement, PLAYER_OPTIONS, function (this: any) {
      videojs.log("Video.js player is ready");

      // Initialize HLS quality selector once the player is ready
      const self = this as ExtendedPlayer;
      if (typeof self.hlsQualitySelector === "function") {
        self.hlsQualitySelector({
          displayCurrentQuality: true,
        });
      }
    }) as ExtendedPlayer;

    playerRef.current = player;

    // Clean up player and remove video element on unmount
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
      if (containerElement.contains(videoElement)) {
        containerElement.removeChild(videoElement);
      }
    };
  }, []);

  // 2. Update source and reload separately when src changes
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    player.src({
      src,
      type: "application/x-mpegURL", // standard HLS type
    });
    player.load();
  }, [src]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black shadow-lg dark:border-zinc-800 transition-all duration-300 hover:shadow-xl">
      <div data-vjs-player ref={containerRef} />
    </div>
  );
}



