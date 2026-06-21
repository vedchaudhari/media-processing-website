"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

/**
 * Plays an HLS stream. Safari/iOS support HLS natively on a plain <video>;
 * every other browser needs hls.js to attach to a MediaSource. The hls
 * instance is torn down on unmount / src change to avoid leaks.
 */
export default function HlsPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    // Compute the error synchronously but apply it asynchronously, so we never
    // call setState synchronously inside the effect body.
    let nextError: string | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari, iOS): point the element straight at the playlist.
      video.src = src;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError("Playback error. The stream may still be processing.");
        }
      });
    } else {
      nextError = "HLS is not supported in this browser.";
    }

    // Reset (or set) the error for this src on the next tick.
    const timer = setTimeout(() => setError(nextError), 0);

    return () => {
      clearTimeout(timer);
      hls?.destroy();
    };
  }, [src]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black dark:border-zinc-800">
      <video
        ref={videoRef}
        controls
        playsInline
        className="aspect-video w-full bg-black"
      />
      {error && (
        <p className="bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
