// Server-sent events for "something changed, re-read": the event data is a
// type and id only. EventSource reconnects on its own, so streams end after
// five minutes rather than letting a proxy cut them mid-event.

const PING_MS = 20_000;
const MAX_MS = 5 * 60_000;
const enc = new TextEncoder();

// ponytail: per-process counter; a second instance would allow its own share.
const g = globalThis as { tcgmartStreams?: Map<string, number> };
const open = (g.tcgmartStreams ??= new Map<string, number>());

export type Send = (data: object) => void;

/**
 * A text/event-stream response that runs `start` and calls its cleanup when
 * the client leaves or the stream times out. Over the per-key cap it is a 429.
 */
export function sseResponse(
  signal: AbortSignal,
  cap: { key: string; max: number },
  start: (send: Send) => Promise<() => void>,
): Response {
  const n = open.get(cap.key) ?? 0;
  if (n >= cap.max) return new Response(null, { status: 429 });
  open.set(cap.key, n + 1);
  let finish = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(ctl) {
      let closed = false;
      let stop = () => {};
      const write = (s: string) => {
        if (!closed) ctl.enqueue(enc.encode(s));
      };
      const ping = setInterval(() => write(": ping\n\n"), PING_MS);
      const timeout = setTimeout(() => finish(), MAX_MS);
      finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        clearTimeout(timeout);
        stop();
        const left = (open.get(cap.key) ?? 1) - 1;
        if (left > 0) open.set(cap.key, left);
        else open.delete(cap.key);
        try {
          ctl.close();
        } catch {
          // The client cancelled first; the stream is already closed.
        }
      };
      if (signal.aborted) return finish();
      signal.addEventListener("abort", () => finish());
      write("retry: 3000\n: open\n\n");
      let unsubscribe: () => void;
      try {
        unsubscribe = await start((d) =>
          write(`data: ${JSON.stringify(d)}\n\n`),
        );
      } catch {
        // LISTEN failed: free the slot so the client's retry can get one.
        return finish();
      }
      if (closed) unsubscribe();
      else stop = unsubscribe;
    },
    cancel: () => finish(),
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
