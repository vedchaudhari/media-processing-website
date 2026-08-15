export type StreamStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface EventStreamOptions {

  onEvent: (event: string, data: unknown) => void;

  onStatus?: (status: StreamStatus) => void;

  headers?: () => Record<string, string>;
}

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;

function dispatchFrame(frame: string, onEvent: EventStreamOptions["onEvent"]): void {
  let event = "message";
  const data: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);

    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }

  if (data.length === 0) return;

  try {

    onEvent(event, JSON.parse(data.join("\n")));
  } catch {

    console.warn("Ignoring unparseable SSE frame");
  }
}

export function openEventStream(url: string, options: EventStreamOptions): () => void {
  const controller = new AbortController();
  let stopped = false;
  let retryMs = INITIAL_RETRY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (status: StreamStatus) => {
    if (!stopped) options.onStatus?.(status);
  };

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

  const readStream = async (body: ReadableStream<Uint8Array>) => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;

      buffer += decoder.decode(value, { stream: true });

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

        if (res.status === 401 || res.status === 403) {
          setStatus("closed");
          return;
        }

        if (!res.ok || !res.body) throw new Error(`Stream failed (${res.status})`);

        setStatus("open");
        retryMs = INITIAL_RETRY_MS;
        await readStream(res.body);
      } catch {

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
