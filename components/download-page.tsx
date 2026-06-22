"use client";

import { useEffect, useState, type ComponentType } from "react";
import { motion } from "framer-motion";
import {
  Apple,
  ArrowLeft,
  Check,
  Cpu,
  Download,
  ExternalLink,
  Github,
  Monitor,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PlatformId = "mac-arm" | "mac-intel" | "windows" | "linux";

type DownloadOption = {
  id: PlatformId;
  name: string;
  detail: string;
  file: string;
  size: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
};

const releaseUrl = "https://github.com/pseudozach/zapcast/releases";

const downloads: DownloadOption[] = [
  {
    id: "mac-arm",
    name: "macOS",
    detail: "Apple Silicon",
    file: "ZapCast-0.1.0-arm64.dmg",
    size: "187.6 MB",
    url: "https://github.com/pseudozach/zapcast/releases/download/v0.1.0/ZapCast-0.1.0-arm64.dmg",
    icon: Apple,
  },
  {
    id: "mac-intel",
    name: "macOS",
    detail: "Intel",
    file: "ZapCast-0.1.0-x64.dmg",
    size: "192.0 MB",
    url: "https://github.com/pseudozach/zapcast/releases/download/v0.1.0/ZapCast-0.1.0-x64.dmg",
    icon: Apple,
  },
  {
    id: "windows",
    name: "Windows",
    detail: "64-bit installer",
    file: "ZapCastSetup.exe",
    size: "212.3 MB",
    url: "https://github.com/pseudozach/zapcast/releases/download/v0.1.0/ZapCastSetup.exe",
    icon: Monitor,
  },
  {
    id: "linux",
    name: "Linux",
    detail: "x64 AppImage",
    file: "ZapCast-0.1.0-x64.AppImage",
    size: "197.9 MB",
    url: "https://github.com/pseudozach/zapcast/releases/download/v0.1.0/ZapCast-0.1.0-x64.AppImage",
    icon: Terminal,
  },
];

type NavigatorWithUAData = Navigator & {
  userAgentData?: {
    platform?: string;
    getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
  };
};

function detectPlatform(): PlatformId | null {
  const nav = navigator as NavigatorWithUAData;
  const value = `${nav.userAgentData?.platform ?? ""} ${nav.platform ?? ""} ${nav.userAgent}`.toLowerCase();

  if (/android|iphone|ipad|ipod/.test(value)) return null;
  if (value.includes("win")) return "windows";
  if (value.includes("linux") || value.includes("x11")) return "linux";
  if (value.includes("mac")) return "mac-arm";
  return null;
}

function DownloadCard({ option, recommended }: { option: DownloadOption; recommended: boolean }) {
  const Icon = option.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: downloads.indexOf(option) * 0.06 }}
    >
      <Card
        className={cn(
          "glass-highlight relative flex h-full flex-col overflow-hidden p-6 transition duration-300",
          recommended
            ? "border-cyan-300/35 bg-cyan-300/[.075] shadow-[0_0_50px_rgba(34,211,238,.09)]"
            : "hover:-translate-y-1 hover:border-white/20 hover:bg-white/[.05]",
        )}
      >
        {recommended && (
          <span className="absolute right-4 top-4 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.13em] text-cyan-200">
            Recommended
          </span>
        )}
        <span className="grid size-12 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[.07] text-cyan-300">
          <Icon className="size-5" />
        </span>
        <div className="mt-7">
          <h2 className="font-display text-xl font-semibold text-white">{option.name}</h2>
          <p className="mt-1 text-sm text-slate-400">{option.detail}</p>
        </div>
        <div className="mt-8 border-t border-white/[.07] pt-5">
          <p className="truncate font-mono text-[11px] text-slate-500">{option.file}</p>
          <p className="mt-1 text-[11px] text-slate-600">v0.1.0 · {option.size}</p>
        </div>
        <Button asChild variant={recommended ? "default" : "outline"} className="mt-6 w-full">
          <a href={option.url}>
            <Download /> Download
          </a>
        </Button>
      </Card>
    </motion.div>
  );
}

export function DownloadPage() {
  const [platform, setPlatform] = useState<PlatformId | null>(null);

  useEffect(() => {
    const detected = detectPlatform();
    setPlatform(detected);

    const nav = navigator as NavigatorWithUAData;
    if (detected === "mac-arm" && nav.userAgentData?.getHighEntropyValues) {
      nav.userAgentData
        .getHighEntropyValues(["architecture"])
        .then(({ architecture }) => {
          if (architecture && /x86|x64/.test(architecture.toLowerCase())) setPlatform("mac-intel");
        })
        .catch(() => undefined);
    }
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05080b]">
      <div className="page-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-[-28rem] h-[48rem] w-[72rem] -translate-x-1/2 rounded-full bg-cyan-400/[.09] blur-[120px]" />

      <header className="relative z-20 border-b border-white/[.06] bg-[#05080b]/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <SiteLogo />
          <Button asChild variant="ghost" size="sm">
            <a href="/">
              <ArrowLeft /> Back to site
            </a>
          </Button>
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-5 pb-24 pt-20 lg:px-8 lg:pb-32 lg:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[.06] px-3 py-1.5 text-xs text-cyan-100">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_9px_#34d399]" />
            Desktop release v0.1.0
          </div>
          <h1 className="text-gradient font-display text-5xl font-semibold tracking-[-.055em] sm:text-7xl">
            Download ZapCast.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Stream from RTMP, join peer-to-peer broadcasts, relay video chunks, and manage tips and rewards from one desktop app.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {downloads.map((option) => (
            <DownloadCard key={option.id} option={option} recommended={platform === option.id} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 flex flex-col items-center gap-5"
        >
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-cyan-300" />Direct GitHub release downloads</span>
            <span className="flex items-center gap-2"><Cpu className="size-3.5 text-cyan-300" />Desktop MVP</span>
            <span className="flex items-center gap-2"><Check className="size-3.5 text-cyan-300" />No account required to install</span>
          </div>
          <a
            href={releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-200"
          >
            <Github className="size-4" /> or download directly from GitHub <ExternalLink className="size-3" />
          </a>
        </motion.div>
      </section>

      <footer className="relative border-t border-white/[.06]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-5 py-8 sm:flex-row lg:px-8">
          <SiteLogo />
          <p className="text-center text-xs text-slate-600">Available for macOS, Windows, and Linux.</p>
          <a className="text-xs text-slate-500 transition hover:text-white" href="https://github.com/pseudozach/zapcast" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
