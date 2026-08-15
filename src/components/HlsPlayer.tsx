"use client";

import { useEffect, useRef } from "react";
import videojs from "video.js";

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
  controlBar: any;
}

import "video.js/dist/video-js.css";

if (typeof window !== "undefined") {
  if (!videojs.getPlugin("qualityLevels")) {
    require("videojs-contrib-quality-levels");
  }
  if (!videojs.getPlugin("hlsQualitySelector")) {
    require("videojs-hls-quality-selector");
  }
}

interface HlsPlayerProps {
  src: string;
  poster?: string;
  onReady?: (player: any) => void;
  chapters?: { start: number; title: string }[];
}

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

export default function HlsPlayer({ src, poster, onReady, chapters }: HlsPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<ExtendedPlayer | null>(null);

  useEffect(() => {
    if (playerRef.current) return;

    const containerElement = containerRef.current;
    if (!containerElement) return;

    const videoElement = document.createElement("video-js");
    videoElement.classList.add("vjs-big-play-centered", "w-full", "aspect-video");
    containerElement.appendChild(videoElement);

    const player: ExtendedPlayer = videojs(videoElement, PLAYER_OPTIONS, function (this: any) {
      videojs.log("Video.js player is ready");

      const self = this as ExtendedPlayer;
      if (typeof self.hlsQualitySelector === "function") {
        self.hlsQualitySelector({
          displayCurrentQuality: true,
        });

        const qualityButton = self.controlBar.getChild("QualityButton") as any;
        if (qualityButton) {
          let originalCreateItems = qualityButton.createItems;
          Object.defineProperty(qualityButton, "createItems", {
            get() {
              return () => {
                const items = originalCreateItems ? originalCreateItems.call(qualityButton) : [];
                if (!items || items.length === 0) return items;

                const autoItem = items.find((item: any) => item.item && item.item.value === "auto");
                const resolutionItems = items.filter((item: any) => item.item && typeof item.item.value === "number");

                resolutionItems.sort((a: any, b: any) => b.item.value - a.item.value);

                const reordered = [];
                if (autoItem) {
                  reordered.push(autoItem);
                }
                reordered.push(...resolutionItems);
                return reordered;
              };
            },
            set(newFunc) {
              originalCreateItems = newFunc;
            },
            configurable: true,
          });
        }
      }

      if (onReady) {
        onReady(self);
      }
    }) as ExtendedPlayer;

    playerRef.current = player;

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

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    player.src({
      src,
      type: "application/x-mpegURL",
    });
    if (poster) {
      player.poster(poster);
    }
    player.load();
  }, [src, poster]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const setupMarkers = () => {
      const duration = player.duration();
      if (!duration || !chapters || chapters.length === 0) return;

      const seekBar = player.el().querySelector(".vjs-progress-holder");
      if (!seekBar) return;

      seekBar.querySelectorAll(".vjs-chapter-marker, .vjs-chapter-gap").forEach((el: any) => el.remove());

      chapters.forEach((chapter) => {
        if (chapter.start <= 0) return;

        const percentage = (chapter.start / duration) * 100;
        if (percentage < 0 || percentage > 100) return;

        const gap = document.createElement("div");
        gap.className = "vjs-chapter-gap absolute top-0 bottom-0 w-[4px] bg-black z-20 pointer-events-none";
        gap.style.left = `calc(${percentage}% - 2px)`;
        seekBar.appendChild(gap);

        const marker = document.createElement("div");
        marker.className = "vjs-chapter-marker absolute top-0 bottom-0 w-[8px] z-30 cursor-pointer pointer-events-auto group";
        marker.style.left = `calc(${percentage}% - 4px)`;

        const indicator = document.createElement("div");
        indicator.className = "mx-auto h-full w-[1.5px] bg-white/40 group-hover:bg-yellow-400 transition-colors";
        marker.appendChild(indicator);

        const m = Math.floor(chapter.start / 60);
        const s = Math.floor(chapter.start % 60);
        const formattedTime = `${m}:${s.toString().padStart(2, "0")}`;
        marker.title = `${chapter.title} (${formattedTime})`;

        marker.addEventListener("click", (e) => {
          e.stopPropagation();
          player.currentTime(chapter.start);
        });

        seekBar.appendChild(marker);
      });
    };

    player.on("loadedmetadata", setupMarkers);

    if (player.duration()) {
      setupMarkers();
    }

    return () => {
      player.off("loadedmetadata", setupMarkers);
    };
  }, [src, chapters]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black shadow-lg dark:border-zinc-800 transition-all duration-300 hover:shadow-xl">
      <div data-vjs-player ref={containerRef} />
    </div>
  );
}

