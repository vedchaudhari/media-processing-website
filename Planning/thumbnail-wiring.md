# Thumbnail Wiring — Frontend Implementation Plan

This plan describes how we will wire up the extracted video thumbnails on the frontend client (Next.js app).

## Goal
Show the video's generated thumbnail on the library page (`/`) video cards, and use it as the pre-play "poster" image in the Video.js player on the detail page (`/videos/[id]`).

---

## Proposed Changes

### 1. Types Configuration
#### [MODIFY] [types.ts](file:///Users/wssd054/ved/media-process/media-processing-website/src/lib/types.ts)
Add `thumbnailUrl` to the API types:

```typescript
export interface VideoListItem {
  id: string;
  title?: string;
  status: VideoStatus;
  progress: number;
  thumbnailUrl?: string; // <-- Add optional thumbnail URL from backend
  createdAt?: string;
}

export interface PlayResult {
  ready: boolean;
  videoId: string;
  title?: string;
  status: VideoStatus;
  progress: number;
  playbackUrl?: string;
  thumbnailUrl?: string; // <-- Add optional thumbnail URL from backend
}
```

---

### 2. UI Components
#### [MODIFY] [VideoCard.tsx](file:///Users/wssd054/ved/media-process/media-processing-website/src/components/VideoCard.tsx)
Redesign `VideoCard` to feel premium, featuring:
* A **16:9 aspect-ratio aspect container** at the top.
* **Lazy-loaded thumbnail image** using the standard HTML `<img />` tag with CSS scaling on card hover.
* A **smart placeholder** using an HSL-derived gradient background (`from-zinc-100 to-zinc-200` in light, `from-zinc-900 to-zinc-800` in dark mode) with a video icon when the thumbnail is not yet available.
* A **pulsing micro-animation** on the placeholder when the video is in-progress, giving the user instant feedback that work is happening.
* **Overlay Status Badge**: Move `StatusBadge` into a floating overlay on the top-right of the image/placeholder for a modern, video-streaming platform look (e.g., YouTube/Netflix style).
* Text container with padding below containing the title and details.

#### [MODIFY] [HlsPlayer.tsx](file:///Users/wssd054/ved/media-process/media-processing-website/src/components/HlsPlayer.tsx)
Integrate the poster image in the player:
* Accept a new `poster` prop: `interface HlsPlayerProps { src: string; poster?: string; }`.
* Map `poster` in the `useEffect` source updating loop using `player.poster(poster)`.

---

### 3. Pages
#### [MODIFY] [VideoDetail.tsx](file:///Users/wssd054/ved/media-process/media-processing-website/src/app/videos/[id]/VideoDetail.tsx)
* Pass `data.thumbnailUrl` to `<HlsPlayer>` as the `poster` attribute when the video is playable.

---

## Verification Plan

### Manual Verification
1. **Homepage Check**:
   - Inspect the video library page (`/`) to see if completed videos display their extracted frame.
   - Verify that videos in transition (e.g., transcoding, planning) show a pulsing gradient placeholder.
   - Verify that the card scales slightly on hover.
2. **Player Poster Check**:
   - Navigate to `/videos/[id]` for a ready video.
   - Ensure the thumbnail is loaded as the Video.js player's poster frame before hitting play.
