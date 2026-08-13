# Media Processing — Web

The Next.js frontend for [`media-processing`](../media-processing): upload a video, watch it move through the transcode/AI pipeline live, then stream it back as adaptive HLS with an interactive transcript, AI-generated insights, and a RAG-based "Ask AI" chat grounded in the video's own content. Includes an admin dashboard with live pipeline stats.

## Tech stack

- **Framework:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS
- **Data fetching:** TanStack Query (polling for per-video status, SSE for the admin dashboard)
- **Playback:** Video.js + HLS quality-level plugins
- **Charts:** Recharts (admin dashboard)
- **Icons:** Remix Icon

## Prerequisites

- Node.js (LTS) and npm
- The [`media-processing`](../media-processing) backend running and reachable

## Getting started

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE_URL to your backend's URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3000` | Base URL of the `media-processing` backend API |

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm start` | Production build, then serve it |
| `npm run lint` | ESLint |

## Pages

- **`/register`, `/login`** — auth (JWT stored client-side by `lib/auth-context.tsx`, attached to every API call)
- **`/`** — video library
- **`/upload`** — file goes straight to storage via a presigned URL (not through this app's server), with a live progress bar and mid-transfer cancel
- **`/videos/[id]`** — HLS player, interactive click-to-seek transcript, AI insights (summary/chapters), and an Ask-AI chat — each of the three AI side-features polls independently and shows its own pending/processing/failed/skipped state, with a retry action if one fails
- **`/admin`** — pipeline stats (live via SSE, no polling), video list, user list — admin role only

## Talking to the backend

Every request goes through `src/lib/api.ts`, which attaches the JWT and normalizes errors into a single `ApiError` (`.message` is always safe to show the user directly). There's no other place in the app that calls `fetch` against the backend directly except the raw upload PUT, which intentionally bypasses this app's own API — see `uploadToStorage` for why (progress events require `XMLHttpRequest`, and the file goes straight to object storage, not through this server).

## Project structure

```
src/
  app/            routes (App Router) — one folder per page above
  components/     shared UI (StatusBadge, VideoCard, HlsPlayer, NavBar, PasswordInput, charts/...)
  lib/            api.ts (backend client), types.ts (shared response/status types),
                  auth-context.tsx, sse.ts (SSE client), use-admin-stats-stream.ts
```
