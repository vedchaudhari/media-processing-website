/**
 * A Server-Sent Events client built on `fetch`, not the browser's `EventSource`.
 *
 * `EventSource` is the obvious choice and gives reconnection for free, but it
 * cannot set request headers — and this app authenticates with a Bearer JWT
 * (see api.ts). The alternative, smuggling the token through the query string,
 * would leak it into server access logs, browser history, and any `Referer`.
 * Reading the response body as a stream keeps the `Authorization` header, which
 * also means the backend's existing requireAuth/requireAdmin middleware guards
 * the stream exactly like every other route.
 *
 * The tradeoff is that reconnection is ours to implement — that's the backoff
 * loop below.
 */

/** Connection state, surfaced so the UI can show live/reconnecting/disconnected. */
export type StreamStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface EventStreamOptions {
  /** Fired per frame. `data` is the parsed JSON payload. */
  onEvent: (event: string, data: unknown) => void;
  /** Fired on every connection-state transition. */
  onStatus?: (status: StreamStatus) => void;
  /** Evaluated per attempt, so a reconnect after a re-login picks up the new token. */
  headers?: () => Record<string, string>;
}

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;

/**
 * Splits one SSE frame into its event name and payload, then hands it to the
 * caller. Comment lines (`: ping` heartbeats) and frames with no `data` are
 * dropped — they exist to keep the socket warm, not to say anything.
 */
function dispatchFrame(frame: string, onEvent: EventStreamOptions["onEvent"]): void {
  let event = "message";
  const data: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    // A single leading space after the colon is part of the framing, not the value.
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }

  if (data.length === 0) return;

  try {
    // Multiple `data:` lines rejoin with newlines — that's how the spec encodes
    // a multi-line payload, and how sse.service.ts writes one.
    onEvent(event, JSON.parse(data.join("\n")));
  } catch {
    // A frame we can't parse isn't worth tearing the stream down for.
    console.warn("Ignoring unparseable SSE frame");
  }
}

/**
 * Opens a stream and keeps it open, reconnecting with exponential backoff
 * whenever it drops (server restart, laptop sleep, flaky network).
 *
 * @returns A disposer that permanently closes the stream. Safe to use directly
 *          as a `useEffect` cleanup.
 */
export function openEventStream(url: string, options: EventStreamOptions): () => void {
  const controller = new AbortController();
  let stopped = false;
  let retryMs = INITIAL_RETRY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (status: StreamStatus) => {
    if (!stopped) options.onStatus?.(status);
  };

  /** Backoff sleep that resolves early if the caller disposes the stream. */
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const finish = () => {
        if (retryTimer) clearTimeout(retryTimer);
        controller.signal.removeEventListener("abort", finish);
        resolve();
      };
      retryTimer = setTimeout(finish, ms);
      controller.signal.addEventListener("abort", finish);
    });

  /** Consumes the response body until the server closes it or we abort. */
  const readStream = async (body: ReadableStream<Uint8Array>) => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;

      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line. A chunk can hold several frames,
      // or half of one — hence the buffer.
      for (;;) {
        const separator = /\r?\n\r?\n/.exec(buffer);
        if (!separator) break;
        dispatchFrame(buffer.slice(0, separator.index), options.onEvent);
        buffer = buffer.slice(separator.index + separator[0].length);
      }
    }
  };

  const run = async () => {
    setStatus("connecting");

    while (!stopped) {
      try {
        const res = await fetch(url, {
          headers: { Accept: "text/event-stream", ...options.headers?.() },
          signal: controller.signal,
          cache: "no-store",
        });

        // Retrying a rejected token just replays the same rejection forever —
        // this is terminal until the user logs in again.
        if (res.status === 401 || res.status === 403) {
          setStatus("closed");
          return;
        }

        if (!res.ok || !res.body) throw new Error(`Stream failed (${res.status})`);

        setStatus("open");
        retryMs = INITIAL_RETRY_MS;
        await readStream(res.body);
      } catch {
        // Any failure — refused connection, mid-stream drop, abort — funnels
        // into the same backoff path below.
      }

      if (stopped || controller.signal.aborted) return;

      setStatus("reconnecting");
      await wait(retryMs);
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    }
  };

  void run();

  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    controller.abort();
  };
}
