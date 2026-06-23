import type { Metadata } from "next";
import { DownloadPage, type DownloadAsset, type DownloadRelease, type PlatformId } from "@/components/download-page";

export const metadata: Metadata = {
  title: "Download ZapCast — macOS, Windows, and Linux",
  description:
    "Download the latest ZapCast desktop app for Apple Silicon, Intel Mac, Windows, or Linux.",
};

export const revalidate = 60;

const owner = "pseudozach";
const repo = "zapcast";
const releasesUrl = `https://github.com/${owner}/${repo}/releases`;
const latestReleaseApiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

const fallbackRelease: DownloadRelease = {
  tagName: "v0.2.0",
  releaseUrl: `${releasesUrl}/tag/v0.2.0`,
  assets: {
    "mac-arm": {
      name: "ZapCast-0.2.0-arm64.dmg",
      size: 198653738,
      url: "https://github.com/pseudozach/zapcast/releases/download/v0.2.0/ZapCast-0.2.0-arm64.dmg",
    },
    "mac-intel": {
      name: "ZapCast-0.2.0-x64.dmg",
      size: 203204990,
      url: "https://github.com/pseudozach/zapcast/releases/download/v0.2.0/ZapCast-0.2.0-x64.dmg",
    },
    windows: {
      name: "ZapCastSetup.exe",
      size: 224842240,
      url: "https://github.com/pseudozach/zapcast/releases/download/v0.2.0/ZapCastSetup.exe",
    },
    linux: {
      name: "ZapCast-0.2.0-x64.AppImage",
      size: 209783344,
      url: "https://github.com/pseudozach/zapcast/releases/download/v0.2.0/ZapCast-0.2.0-x64.AppImage",
    },
  },
};

type GitHubAsset = {
  name?: unknown;
  size?: unknown;
  browser_download_url?: unknown;
};

type GitHubRelease = {
  tag_name?: unknown;
  html_url?: unknown;
  assets?: unknown;
};

function assetFor(release: GitHubRelease, platform: PlatformId): DownloadAsset | undefined {
  if (!Array.isArray(release.assets)) return undefined;

  const patterns: Record<PlatformId, RegExp[]> = {
    "mac-arm": [/arm64\.dmg$/i],
    "mac-intel": [/x64\.dmg$/i],
    windows: [/setup\.exe$/i],
    linux: [/x64\.appimage$/i],
  };

  const asset = release.assets.find((candidate): candidate is GitHubAsset => {
    if (!candidate || typeof candidate !== "object") return false;
    const name = (candidate as GitHubAsset).name;
    return typeof name === "string" && patterns[platform].some((pattern) => pattern.test(name));
  });

  if (
    !asset ||
    typeof asset.name !== "string" ||
    typeof asset.browser_download_url !== "string" ||
    typeof asset.size !== "number"
  ) {
    return undefined;
  }

  return {
    name: asset.name,
    size: asset.size,
    url: asset.browser_download_url,
  };
}

function normalizeRelease(release: GitHubRelease): DownloadRelease {
  if (typeof release.tag_name !== "string" || typeof release.html_url !== "string") {
    return fallbackRelease;
  }

  return {
    tagName: release.tag_name,
    releaseUrl: release.html_url,
    assets: {
      "mac-arm": assetFor(release, "mac-arm") ?? fallbackRelease.assets["mac-arm"],
      "mac-intel": assetFor(release, "mac-intel") ?? fallbackRelease.assets["mac-intel"],
      windows: assetFor(release, "windows") ?? fallbackRelease.assets.windows,
      linux: assetFor(release, "linux") ?? fallbackRelease.assets.linux,
    },
  };
}

async function getRelease(): Promise<DownloadRelease> {
  const pinnedTag = process.env.ZAPCAST_RELEASE_TAG?.trim();
  const apiUrl = pinnedTag
    ? `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(pinnedTag)}`
    : latestReleaseApiUrl;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "zapcast.live",
      },
      next: { revalidate },
    });

    if (!response.ok) return fallbackRelease;

    return normalizeRelease((await response.json()) as GitHubRelease);
  } catch {
    return fallbackRelease;
  }
}

export default async function Page() {
  const release = await getRelease();

  return <DownloadPage release={release} />;
}
