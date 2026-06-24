export type NostrEvent = {
  id?: string;
  pubkey?: string;
  created_at?: number;
  kind?: number;
  tags?: string[][];
  content?: string;
};

export type ZapcastStream = {
  eventId: string;
  pubkey: string;
  streamId: string;
  title: string;
  summary: string;
  status: string;
  createdAt: number;
  relay: string;
};

export const defaultNostrRelays = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.snort.social",
  "wss://nostr.wine",
];

export function normalizeZapcastStreamId(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("zapcast:") ? trimmed.slice("zapcast:".length) : trimmed;
}

export function extractZapcastStreamId(event: NostrEvent) {
  const explicit = tagValue(event, "zapcast");
  if (explicit) return normalizeZapcastStreamId(explicit);

  const streaming = tagValues(event, "streaming").find((value) => value === "zapcast" || value.startsWith("zapcast:"));
  if (streaming?.startsWith("zapcast:")) return normalizeZapcastStreamId(streaming);

  const d = tagValue(event, "d");
  if (d && isZapcastStreamId(d)) return normalizeZapcastStreamId(d);
  return "";
}

export function parseZapcastLiveEvent(event: NostrEvent, relay = ""): ZapcastStream | null {
  if (event.kind !== 30311) return null;
  if (!hasTagValue(event, "t", "zapcast")) return null;
  const streamId = extractZapcastStreamId(event);
  if (!streamId || !isZapcastStreamId(streamId)) return null;
  const status = tagValue(event, "status") || "live";
  if (status.toLowerCase() === "ended") return null;

  return {
    eventId: event.id || "",
    pubkey: event.pubkey || "",
    streamId,
    title: tagValue(event, "title") || "ZapCast live stream",
    summary: tagValue(event, "summary") || event.content || "",
    status,
    createdAt: Number(event.created_at || 0),
    relay,
  };
}

export async function discoverZapcastStreams({
  relays = defaultNostrRelays,
  limit = 50,
  timeoutMs = 5000,
}: {
  relays?: string[];
  limit?: number;
  timeoutMs?: number;
} = {}) {
  const streams = await Promise.all(relays.map((relay) => queryRelay(relay, limit, timeoutMs).catch(() => [])));
  const byStreamId = new Map<string, ZapcastStream>();

  for (const stream of streams.flat()) {
    const existing = byStreamId.get(stream.streamId);
    if (!existing || stream.createdAt > existing.createdAt) byStreamId.set(stream.streamId, stream);
  }

  return [...byStreamId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function queryRelay(relay: string, limit: number, timeoutMs: number) {
  return new Promise<ZapcastStream[]>((resolve) => {
    const subId = `zapcast-${Math.random().toString(36).slice(2)}`;
    const streams: ZapcastStream[] = [];
    const ws = new WebSocket(relay);
    const done = () => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // ignore close races
      }
      resolve(streams);
    };
    const timer = setTimeout(done, timeoutMs);

    ws.onopen = () => {
      ws.send(JSON.stringify(["REQ", subId, { kinds: [30311], "#t": ["zapcast"], limit }]));
    };
    ws.onerror = done;
    ws.onmessage = (message) => {
      try {
        const payload = JSON.parse(String(message.data));
        if (payload[0] === "EVENT" && payload[1] === subId) {
          const stream = parseZapcastLiveEvent(payload[2], relay);
          if (stream) streams.push(stream);
        }
        if (payload[0] === "EOSE" && payload[1] === subId) done();
      } catch {
        // ignore malformed relay messages
      }
    };
  });
}

function tagValue(event: NostrEvent, name: string) {
  return tagValues(event, name)[0] || "";
}

function tagValues(event: NostrEvent, name: string) {
  return (event.tags || []).filter((tag) => tag[0] === name && tag[1]).map((tag) => tag[1]);
}

function hasTagValue(event: NostrEvent, name: string, value: string) {
  return tagValues(event, name).some((item) => item.toLowerCase() === value.toLowerCase());
}

function isZapcastStreamId(value: string) {
  return /^zc1:[a-f0-9]{64}:[a-f0-9]{64}$/i.test(value) || /^[a-f0-9]{64}$/i.test(value);
}
