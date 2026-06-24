"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Download, ExternalLink, MonitorPlay, QrCode, Radio, RotateCcw, Wallet, Wifi, WifiOff, Zap } from "lucide-react";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { normalizeZapcastStreamId } from "@/lib/nostr/zapcast";

type GatewayMessage =
  | { type: "reset"; reason?: string }
  | { type: "init"; seq: number; mime: string; payment?: PaymentMetadata | null; dataBase64: string }
  | { type: "chunk"; seq: number; timestamp: number; durationMs: number; mime: string; payment?: PaymentMetadata | null; dataBase64: string }
  | {
      type: "stats";
      connectedPeers: number;
      browserClients: number;
      latestSeq: number;
      gatewayLatencyMs: number;
      warmStart?: { initBytes: number; chunks: number; startSeq: number; endSeq: number } | null;
    }
  | { type: "error"; message: string };

type Segment = Extract<GatewayMessage, { type: "init" | "chunk" }>;

type PaymentMetadata = {
  type?: string;
  chain?: string;
  asset?: string;
  address?: string;
  lightningAddress?: string;
};

type DebugState = {
  latestSeq: number;
  playingSeq: number;
  bufferSeconds: number;
  skippedChunks: number;
  gatewayConnected: boolean;
  gatewayPeers: number;
  latencyEstimate: number;
  browserClients: number;
  lastReceived: string;
  lastAppended: string;
  lastAppendBytes: number;
  mime: string;
  initMime: string;
  mimeSupported: string;
  mediaSourceState: string;
  bufferedRange: string;
  videoError: string;
  warmStart: string;
  lastBox: string;
};

const defaultGateway = "ws://localhost:8787";

function gatewayBaseUrl() {
  return (process.env.NEXT_PUBLIC_ZAPCAST_GATEWAY_WS || defaultGateway).replace(/\/$/, "");
}

function base64ToUint8Array(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function shortStreamId(streamId: string) {
  if (streamId.startsWith("zc1:")) {
    const [, publicKey] = streamId.split(":");
    return `zc1:${publicKey.slice(0, 12)}...${publicKey.slice(-8)}`;
  }
  return `${streamId.slice(0, 14)}...${streamId.slice(-8)}`;
}

export function WatchViewer({ rawStreamId }: { rawStreamId: string }) {
  const streamId = useMemo(() => normalizeZapcastStreamId(decodeURIComponent(rawStreamId)), [rawStreamId]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const initRef = useRef<Segment | null>(null);
  const pendingRef = useRef<Map<number, Segment>>(new Map());
  const expectedSeqRef = useRef(1);
  const appendingRef = useRef(false);
  const appendingSegmentRef = useRef<Segment | null>(null);
  const positionedRef = useRef(false);
  const [playbackRun, setPlaybackRun] = useState(0);
  const [status, setStatus] = useState("Connecting to gateway...");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedPayment, setCopiedPayment] = useState("");
  const [payment, setPayment] = useState<PaymentMetadata | null>(null);
  const [debug, setDebug] = useState<DebugState>({
    latestSeq: 0,
    playingSeq: 0,
    bufferSeconds: 0,
    skippedChunks: 0,
    gatewayConnected: false,
    gatewayPeers: 0,
    latencyEstimate: 0,
    browserClients: 0,
    lastReceived: "",
    lastAppended: "",
    lastAppendBytes: 0,
    mime: "",
    initMime: "",
    mimeSupported: "",
    mediaSourceState: "",
    bufferedRange: "",
    videoError: "",
    warmStart: "",
    lastBox: "",
  });

  useEffect(() => {
    if (!("MediaSource" in window)) {
      setError("This browser does not support MediaSource playback for ZapCast browser viewing.");
      setStatus("Unsupported browser");
      return;
    }

    resetPlaybackRefs();
    const mediaSource = new MediaSource();
    const objectUrl = URL.createObjectURL(mediaSource);
    mediaSourceRef.current = mediaSource;
    if (videoRef.current) videoRef.current.src = objectUrl;

    mediaSource.addEventListener(
      "sourceopen",
      () => {
        setStatus("Waiting for init segment...");
        setDebug((value) => ({ ...value, mediaSourceState: mediaSource.readyState }));
        if (initRef.current) appendInit(initRef.current);
      },
      { once: true },
    );
    mediaSource.addEventListener("sourceended", () => setStatus("Media stream ended."));
    mediaSource.addEventListener("sourceclose", () => {
      appendingRef.current = false;
      appendingSegmentRef.current = null;
      setDebug((value) => ({ ...value, mediaSourceState: "closed" }));
    });
    connectGateway();

    const metricsTimer = setInterval(updateBufferMetrics, 1000);
    return () => {
      clearInterval(metricsTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
      const sourceBuffer = sourceBufferRef.current;
      try {
        sourceBuffer?.abort();
      } catch {
        // ignore cleanup races while the browser tears down MediaSource
      }
      sourceBufferRef.current = null;
      appendingRef.current = false;
      appendingSegmentRef.current = null;
      positionedRef.current = false;
      mediaSourceRef.current = null;
      URL.revokeObjectURL(objectUrl);
    };
  }, [streamId, playbackRun]);

  function connectGateway() {
    const previous = wsRef.current;
    wsRef.current = null;
    previous?.close();
    setError("");
    setStatus("Connecting to gateway...");
    const url = `${gatewayBaseUrl()}/stream?streamId=${encodeURIComponent(streamId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      setStatus("Gateway connected. Joining live stream...");
      setDebug((value) => ({ ...value, gatewayConnected: true }));
    };
    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      setStatus("Gateway disconnected");
      setDebug((value) => ({ ...value, gatewayConnected: false }));
    };
    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      setError("Could not connect to the ZapCast gateway.");
    };
    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      try {
        const message = JSON.parse(String(event.data)) as GatewayMessage;
        handleGatewayMessage(message);
      } catch {
        setError("Gateway sent an invalid message.");
      }
    };
  }

  function handleGatewayMessage(message: GatewayMessage) {
    if (message.type === "error") {
      setError(message.message);
      return;
    }
    if (message.type === "reset") {
      setStatus("Stream reset detected. Rebuilding player...");
      restartViewer();
      return;
    }
    if (message.type === "stats") {
      setDebug((value) => ({
        ...value,
        latestSeq: message.latestSeq,
        gatewayPeers: message.connectedPeers,
        latencyEstimate: message.gatewayLatencyMs,
        browserClients: message.browserClients,
        warmStart: message.warmStart
          ? `${message.warmStart.startSeq}-${message.warmStart.endSeq} (${message.warmStart.chunks})`
          : value.warmStart,
      }));
      return;
    }
    if (message.type === "init") {
      initRef.current = message;
      if (message.payment) setPayment(message.payment);
      setDebug((value) => ({
        ...value,
        lastReceived: `${message.type} seq ${message.seq}`,
        lastAppendBytes: base64ByteLength(message.dataBase64),
        mime: message.mime,
        lastBox: mp4FirstBox(message.dataBase64),
      }));
      console.info("[zapcast-watch] received init", {
        seq: message.seq,
        mime: message.mime,
        bytes: base64ByteLength(message.dataBase64),
        box: mp4FirstBox(message.dataBase64),
      });
      appendInit(message);
      return;
    }

    if (message.payment) setPayment(message.payment);
    if (!initRef.current) {
      setStatus("Waiting for init segment...");
      setError("Gateway sent media chunks before the init segment. Restart the broadcaster and gateway, then create a new stream.");
      console.warn("[zapcast-watch] chunk before init", { seq: message.seq, bytes: base64ByteLength(message.dataBase64) });
      return;
    }
    pendingRef.current.set(message.seq, message);
    setDebug((value) => ({
      ...value,
      latestSeq: Math.max(value.latestSeq, message.seq),
      lastReceived: `${message.type} seq ${message.seq}`,
      lastAppendBytes: base64ByteLength(message.dataBase64),
      mime: message.mime,
      lastBox: mp4FirstBox(message.dataBase64),
    }));
    drainQueue();
  }

  function appendInit(segment: Segment) {
    const mediaSource = mediaSourceRef.current;
    if (!mediaSource || mediaSource.readyState !== "open" || sourceBufferRef.current) return;

    const mime = segment.mime || "video/mp4";
    const initMime = mimeFromInitSegment(segment.dataBase64, mime);
    const hasVideo = initHasVideo(segment.dataBase64);
    const supported = MediaSource.isTypeSupported(initMime);
    setDebug((value) => ({
      ...value,
      mime,
      initMime,
      mimeSupported: supported ? "yes" : "no",
      mediaSourceState: mediaSource.readyState,
    }));
    console.info("[zapcast-watch] init mime", {
      declared: mime,
      derived: initMime,
      supported,
      hasVideo,
      boxes: mp4Markers(segment.dataBase64),
    });
    if (!hasVideo) {
      setError("ZapCast init segment is audio-only. Restart the broadcaster with the updated desktop app so init.mp4 includes the H.264 video track.");
      setStatus("Audio-only init segment");
      return;
    }
    if (!supported) {
      setError(`This browser cannot play ${initMime}. Try the ZapCast desktop app.`);
      setStatus("Unsupported codec");
      return;
    }

    const sourceBuffer = mediaSource.addSourceBuffer(initMime);
    sourceBuffer.mode = "segments";
    sourceBufferRef.current = sourceBuffer;
    sourceBuffer.addEventListener("updateend", () => {
      if (!isActiveSourceBuffer(sourceBuffer)) return;
      appendingRef.current = false;
      appendingSegmentRef.current = null;
      updateBufferMetrics();
      drainQueue();
    });
    sourceBuffer.addEventListener("error", () => {
      const segment = appendingSegmentRef.current;
      appendingRef.current = false;
      appendingSegmentRef.current = null;
      const detail = segment ? `${segment.type} seq ${segment.seq}` : "unknown segment";
      console.error("[zapcast-watch] sourcebuffer error", {
        detail,
        mime: segment?.mime,
        mediaSourceState: mediaSourceRef.current?.readyState,
        videoError: videoRef.current?.error,
      });
      setError(`MediaSource failed while appending ${detail}. Reconnect will rebuild playback from the live edge.`);
    });
    appendSegment(segment);
    setStatus("Buffering live video...");
  }

  function drainQueue() {
    if (!isActiveSourceBuffer(sourceBufferRef.current) || appendingRef.current) return;
    const pending = pendingRef.current;
    let next = pending.get(expectedSeqRef.current);

    if (!next && pending.size > 0) {
      const available = Math.min(...pending.keys());
      if (available > expectedSeqRef.current) {
        const skipped = available - expectedSeqRef.current;
        expectedSeqRef.current = available;
        setDebug((value) => ({ ...value, skippedChunks: value.skippedChunks + skipped }));
        next = pending.get(available);
      }
    }

    if (!next) return;
    pending.delete(next.seq);
    appendSegment(next);
    expectedSeqRef.current = next.seq + 1;
  }

  function appendSegment(segment: Segment) {
    const sourceBuffer = sourceBufferRef.current;
    if (!isActiveSourceBuffer(sourceBuffer) || appendingRef.current) return;
    appendingRef.current = true;
    appendingSegmentRef.current = segment;
    try {
      sourceBuffer.appendBuffer(base64ToUint8Array(segment.dataBase64));
      setDebug((value) => ({
        ...value,
        lastAppended: `${segment.type} seq ${segment.seq}`,
        lastAppendBytes: base64ByteLength(segment.dataBase64),
        mediaSourceState: mediaSourceRef.current?.readyState || "",
        lastBox: mp4FirstBox(segment.dataBase64),
      }));
      if (segment.type === "chunk") {
        setDebug((value) => ({ ...value, playingSeq: segment.seq }));
        setStatus("Playing live");
        keepNearLiveEdge();
      }
    } catch (appendError) {
      appendingRef.current = false;
      appendingSegmentRef.current = null;
      setError(appendError instanceof Error ? appendError.message : "Failed to append media segment.");
    }
  }

  function restartViewer() {
    setPlaybackRun((value) => value + 1);
  }

  function resetPlaybackRefs() {
    initRef.current = null;
    pendingRef.current.clear();
    expectedSeqRef.current = 1;
    appendingRef.current = false;
    appendingSegmentRef.current = null;
    sourceBufferRef.current = null;
    setDebug((value) => ({
      ...value,
      playingSeq: 0,
      bufferSeconds: 0,
      skippedChunks: 0,
      gatewayConnected: false,
      lastReceived: "",
      lastAppended: "",
      lastAppendBytes: 0,
      mime: "",
      initMime: "",
      mimeSupported: "",
      mediaSourceState: "",
      bufferedRange: "",
      videoError: "",
      warmStart: "",
      lastBox: "",
    }));
  }

  function handleVideoError() {
    const video = videoRef.current;
    const code = video?.error?.code;
    const messages: Record<number, string> = {
      1: "Video playback was aborted.",
      2: "A network error interrupted video playback.",
      3: "The browser could not decode the ZapCast media segment.",
      4: "The browser does not support this ZapCast media format.",
    };
    const message = code ? messages[code] || `Video playback failed with media error ${code}.` : "Video playback failed.";
    console.error("[zapcast-watch] video error", {
      code,
      message,
      mediaError: video?.error,
      networkState: video?.networkState,
      readyState: video?.readyState,
      currentTime: video?.currentTime,
      buffered: video?.buffered ? bufferedRanges(video.buffered) : "",
    });
    setDebug((value) => ({ ...value, videoError: code ? `${code}` : "unknown" }));
    setError(message);
  }

  function keepNearLiveEdge() {
    const video = videoRef.current;
    const sourceBuffer = sourceBufferRef.current;
    const buffered = safeBuffered(sourceBuffer);
    if (!video || !buffered || buffered.length === 0) return;
    const end = buffered.end(buffered.length - 1);
    const latency = end - video.currentTime;
    positionAtBufferedStart(video, buffered);
    if (latency > 10) video.currentTime = Math.max(0, end - 4);
    if (!video.paused) return;
    video.play().catch(() => undefined);
  }

  function updateBufferMetrics() {
    const video = videoRef.current;
    const sourceBuffer = sourceBufferRef.current;
    const buffered = safeBuffered(sourceBuffer);
    if (!video || !buffered || buffered.length === 0) return;
    const end = buffered.end(buffered.length - 1);
    const seconds = Math.max(0, end - video.currentTime);
    positionAtBufferedStart(video, buffered);
    setDebug((value) => ({
      ...value,
      bufferSeconds: Number(seconds.toFixed(1)),
      bufferedRange: bufferedRanges(buffered),
      mediaSourceState: mediaSourceRef.current?.readyState || "",
    }));
  }

  function positionAtBufferedStart(video: HTMLVideoElement, buffered: TimeRanges) {
    if (positionedRef.current || buffered.length === 0) return;
    const start = buffered.start(0);
    const end = buffered.end(0);
    if (video.currentTime < start || video.currentTime > end) video.currentTime = Math.min(end, start + 0.05);
    positionedRef.current = true;
  }

  function safeBuffered(sourceBuffer: SourceBuffer | null) {
    if (!isActiveSourceBuffer(sourceBuffer)) return null;
    try {
      return sourceBuffer.buffered;
    } catch {
      return null;
    }
  }

  function isActiveSourceBuffer(sourceBuffer: SourceBuffer | null): sourceBuffer is SourceBuffer {
    const mediaSource = mediaSourceRef.current;
    if (!mediaSource || !sourceBuffer || mediaSource.readyState === "closed") return false;
    for (let index = 0; index < mediaSource.sourceBuffers.length; index += 1) {
      if (mediaSource.sourceBuffers[index] === sourceBuffer) return true;
    }
    return false;
  }

  async function copyStreamId() {
    await navigator.clipboard?.writeText(streamId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  async function copyPaymentValue(key: string, value: string) {
    await navigator.clipboard?.writeText(value);
    setCopiedPayment(key);
    setTimeout(() => setCopiedPayment(""), 1200);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05080b]">
      <div className="page-grid pointer-events-none absolute inset-0" />
      <header className="relative z-20 border-b border-white/[.06] bg-[#05080b]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <SiteLogo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <a href="/streams">
                <ArrowLeft /> Streams
              </a>
            </Button>
            <Button asChild size="sm">
              <a href="/download">
                <Download /> Desktop App
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[1fr_360px] lg:px-8 lg:py-10">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-bold tracking-widest text-white">
              <Radio className="size-3.5" /> LIVE
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[.08] bg-white/[.04] px-3 py-1.5 text-xs text-slate-300">
              {debug.gatewayConnected ? <Wifi className="size-3.5 text-emerald-300" /> : <WifiOff className="size-3.5 text-rose-300" />}
              {status}
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/[.08] bg-black shadow-[0_30px_100px_rgba(0,0,0,.35)]">
            <video ref={videoRef} controls playsInline autoPlay muted onError={handleVideoError} className="aspect-video w-full bg-black" />
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <PaymentTarget
              icon="lightning"
              label="Lightning address"
              value={payment?.lightningAddress || ""}
              qrValue={payment?.lightningAddress ? `lightning:${payment.lightningAddress}` : ""}
              copied={copiedPayment === "lightning"}
              onCopy={() => payment?.lightningAddress && copyPaymentValue("lightning", payment.lightningAddress)}
            />
            <PaymentTarget
              icon="arc"
              label="Arc testnet address"
              value={payment?.address || ""}
              qrValue={payment?.address ? `ethereum:${payment.address}` : ""}
              copied={copiedPayment === "arc"}
              onCopy={() => payment?.address && copyPaymentValue("arc", payment.address)}
            />
          </div>

          <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold text-white">ZapCast browser viewer</h1>
              <code className="mt-2 block truncate text-xs text-cyan-100">{shortStreamId(streamId)}</code>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copyStreamId} variant="outline">
                {copied ? <Check /> : <Copy />} Copy Stream ID
              </Button>
              <Button asChild variant="outline">
                <a href={`zapcast:${streamId}`}>
                  <ExternalLink /> Open in Desktop
                </a>
              </Button>
              <Button onClick={restartViewer} variant="outline">
                <RotateCcw /> Reconnect
              </Button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full border border-cyan-300/15 bg-cyan-300/[.07] text-cyan-300">
                <MonitorPlay className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-white">Gateway status</h2>
                <p className="text-xs text-slate-500">Browser viewers do not relay.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 text-sm">
              <Metric label="gateway connected" value={debug.gatewayConnected ? "yes" : "no"} />
              <Metric label="gateway peers" value={debug.gatewayPeers} />
              <Metric label="browser clients" value={debug.browserClients} />
              <Metric label="latency estimate" value={`${debug.latencyEstimate} ms`} />
              <Metric label="warm start" value={debug.warmStart || "-"} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold text-white">Debug</h2>
            <div className="mt-4 grid gap-2 text-sm">
              <Metric label="latest seq" value={debug.latestSeq} />
              <Metric label="playing seq" value={debug.playingSeq} />
              <Metric label="buffer seconds" value={debug.bufferSeconds.toFixed(1)} />
              <Metric label="skipped chunks" value={debug.skippedChunks} />
              <Metric label="last received" value={debug.lastReceived || "-"} />
              <Metric label="last appended" value={debug.lastAppended || "-"} />
              <Metric label="append bytes" value={debug.lastAppendBytes || 0} />
              <Metric label="first box" value={debug.lastBox || "-"} />
              <Metric label="mime" value={debug.mime || "-"} />
              <Metric label="init mime" value={debug.initMime || "-"} />
              <Metric label="mime supported" value={debug.mimeSupported || "-"} />
              <Metric label="media source" value={debug.mediaSourceState || "-"} />
              <Metric label="buffered" value={debug.bufferedRange || "-"} />
              <Metric label="video error" value={debug.videoError || "-"} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold text-white">Desktop app</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Broadcasting and true P2P relaying still require ZapCast desktop. The browser viewer is gateway-assisted for casual viewing.
            </p>
            <Button asChild className="mt-5 w-full">
              <a href="/download">
                <Download /> Download Desktop App
              </a>
            </Button>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[.06] py-2 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[180px] truncate text-right font-mono text-xs text-cyan-100" title={String(value)}>{value}</span>
    </div>
  );
}

function PaymentTarget({
  icon,
  label,
  value,
  qrValue,
  copied,
  onCopy,
}: {
  icon: "lightning" | "arc";
  label: string;
  value: string;
  qrValue: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const Icon = icon === "lightning" ? Zap : Wallet;
  const href = qrValue || "#";

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className="size-4 text-cyan-300" />
        {label}
      </div>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex h-10 items-center overflow-hidden rounded-md border border-white/[.08] bg-black/20">
            <input
              readOnly
              value={value || "Not broadcast"}
              className="min-w-0 flex-1 bg-transparent px-3 font-mono text-xs text-cyan-100 outline-none"
              aria-label={label}
            />
            <button
              type="button"
              onClick={onCopy}
              disabled={!value}
              className="grid size-10 place-items-center border-l border-white/[.08] text-slate-400 transition hover:text-white disabled:opacity-40"
              aria-label={`Copy ${label}`}
              title={`Copy ${label}`}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>
        <a
          href={href}
          className="grid size-20 shrink-0 place-items-center rounded-md border border-white/[.08] bg-white p-1 transition hover:opacity-90"
          title={value ? `Open ${label}` : `${label} unavailable`}
          aria-label={value ? `Open ${label} QR` : `${label} unavailable`}
        >
          {value ? (
            <img src={qrImageUrl(qrValue)} alt="" className="size-full" />
          ) : (
            <QrCode className="size-8 text-slate-500" />
          )}
        </a>
      </div>
    </Card>
  );
}

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(value)}`;
}

function base64ByteLength(value: string) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}

function bufferedRanges(ranges: TimeRanges) {
  const values: string[] = [];
  for (let index = 0; index < ranges.length; index += 1) {
    values.push(`${ranges.start(index).toFixed(2)}-${ranges.end(index).toFixed(2)}`);
  }
  return values.join(", ");
}

function mp4FirstBox(value: string) {
  try {
    const bytes = base64ToUint8Array(value.slice(0, 24));
    if (bytes.byteLength < 8) return "";
    const size = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    const type = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    return `${type}:${size}`;
  } catch {
    return "";
  }
}

function mimeFromInitSegment(value: string, fallback: string) {
  const bytes = base64ToUint8Array(value);
  const codecs: string[] = [];
  const avc = avcCodec(bytes);
  if (avc) codecs.push(avc);
  else if (containsAscii(bytes, "avc3")) codecs.push("avc3.42E01E");
  else if (containsAscii(bytes, "avc1")) codecs.push(codecFromFallback(fallback, "avc1") || "avc1.42E01E");

  if (containsAscii(bytes, "mp4a")) codecs.push(codecFromFallback(fallback, "mp4a") || "mp4a.40.2");
  if (!codecs.length) return fallback;
  return `video/mp4; codecs="${codecs.join(",")}"`;
}

function initHasVideo(value: string) {
  const bytes = base64ToUint8Array(value);
  return containsAscii(bytes, "avc1") || containsAscii(bytes, "avc3") || containsAscii(bytes, "hvc1") || containsAscii(bytes, "hev1") || containsAscii(bytes, "vp09");
}

function avcCodec(bytes: Uint8Array) {
  const offset = findAscii(bytes, "avcC");
  if (offset < 0 || offset + 11 >= bytes.byteLength) return "";
  const profile = bytes[offset + 5];
  const compatibility = bytes[offset + 6];
  const level = bytes[offset + 7];
  return `avc1.${hexByte(profile)}${hexByte(compatibility)}${hexByte(level)}`;
}

function codecFromFallback(fallback: string, prefix: string) {
  const match = fallback.match(new RegExp(`${prefix}\\.[^,"\\s]+`, "i"));
  return match?.[0] || "";
}

function mp4Markers(value: string) {
  const bytes = base64ToUint8Array(value);
  return ["ftyp", "moov", "trak", "avc1", "avc3", "avcC", "mp4a", "esds"]
    .filter((marker) => containsAscii(bytes, marker))
    .join(",");
}

function containsAscii(bytes: Uint8Array, text: string) {
  return findAscii(bytes, text) >= 0;
}

function findAscii(bytes: Uint8Array, text: string) {
  const needle = [...text].map((char) => char.charCodeAt(0));
  for (let index = 0; index <= bytes.byteLength - needle.length; index += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return index;
  }
  return -1;
}

function hexByte(value: number) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}
