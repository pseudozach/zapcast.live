"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, MonitorPlay, RefreshCw, Radio, Download } from "lucide-react";
import { motion } from "framer-motion";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { discoverZapcastStreams, type ZapcastStream } from "@/lib/nostr/zapcast";

function shortStreamId(streamId: string) {
  if (streamId.startsWith("zc1:")) {
    const [, publicKey] = streamId.split(":");
    return `zc1:${publicKey.slice(0, 10)}...${publicKey.slice(-6)}`;
  }
  return `${streamId.slice(0, 12)}...${streamId.slice(-6)}`;
}

function formatWhen(createdAt: number) {
  if (!createdAt) return "recently";
  const seconds = Math.max(1, Math.round(Date.now() / 1000 - createdAt));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function StreamList() {
  const [streams, setStreams] = useState<ZapcastStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading live ZapCast streams from Nostr...");

  async function refresh() {
    setLoading(true);
    setStatus("Loading live ZapCast streams from Nostr...");
    try {
      const result = await discoverZapcastStreams();
      setStreams(result);
      setStatus(result.length ? `${result.length} active stream${result.length === 1 ? "" : "s"} found.` : "No active streams found.");
    } catch (error) {
      setStreams([]);
      setStatus(error instanceof Error ? error.message : "Nostr discovery failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05080b]">
      <div className="page-grid pointer-events-none absolute inset-0" />
      <header className="relative z-20 border-b border-white/[.06] bg-[#05080b]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <SiteLogo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <a href="/">
                <ArrowLeft /> Back
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

      <section className="relative mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[.06] px-3 py-1.5 text-xs text-cyan-100">
              <Radio className="size-3.5 text-cyan-300" /> Nostr NIP-53 discovery
            </div>
            <h1 className="font-display text-4xl font-semibold text-white sm:text-5xl">Live ZapCast streams</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Browser viewing is gateway-assisted for quick demos. Use the desktop app to broadcast, relay, and participate in the peer-to-peer network.
            </p>
          </div>
          <Button onClick={refresh} disabled={loading} variant="outline">
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>

        <div className="mt-8 rounded-lg border border-white/[.07] bg-white/[.025] px-4 py-3 text-sm text-slate-400">{status}</div>

        <div className="mt-5 grid gap-3">
          {streams.map((stream, index) => (
            <motion.div key={stream.streamId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
              <Card className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white">
                      <span className="size-1.5 rounded-full bg-white" /> LIVE
                    </span>
                    <span className="text-xs text-slate-500">{formatWhen(stream.createdAt)}</span>
                    {stream.relay && <span className="truncate text-xs text-slate-600">{stream.relay}</span>}
                  </div>
                  <h2 className="mt-3 truncate font-display text-xl font-semibold text-white">{stream.title}</h2>
                  {stream.summary && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{stream.summary}</p>}
                  <div className="mt-3 flex items-center gap-2">
                    <code className="truncate rounded-md border border-white/[.07] bg-black/20 px-2 py-1 text-[11px] text-cyan-100">{shortStreamId(stream.streamId)}</code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(stream.streamId)}
                      className="inline-flex size-8 items-center justify-center rounded-full border border-white/10 text-slate-400 transition hover:text-white"
                      aria-label="Copy stream ID"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <a href={`/watch/${encodeURIComponent(stream.streamId)}`}>
                      <MonitorPlay /> Watch in Browser
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={`zapcast:${stream.streamId}`}>
                      <ExternalLink /> Open Desktop
                    </a>
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}
