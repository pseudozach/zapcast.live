# ZapCast Live

Marketing site for [ZapCast](https://zapcast.live), a desktop application for viewer-powered live streaming. Creators can broadcast from an RTMP source, distribute low-latency video over a peer-to-peer network, receive tips, and reward viewers who help relay the stream.

This repository contains the public landing page. It does not contain the ZapCast desktop application or peer-to-peer streaming implementation.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui conventions with Radix UI primitives
- Framer Motion
- Lucide icons

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer

## Local development

Clone the repository and install its dependencies:

```bash
git clone https://github.com/pseudozach/zapcast.live.git
cd zapcast.live
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Available scripts

```bash
npm run dev     # Start the local development server
npm run build   # Create and validate a production build
npm run start   # Serve the production build
```

Run `npm run build` before opening a pull request. The build includes TypeScript validation and static page generation.

## Project structure

```text
app/
  globals.css             Global theme, effects, and Tailwind import
  layout.tsx              Root layout and site metadata
  page.tsx                Landing-page route
  download/page.tsx       Platform-aware desktop download route
components/
  download-page.tsx       Download cards and platform detection
  landing-page.tsx        Reusable landing-page sections and visuals
  ui/                     shadcn-style UI primitives
lib/
  utils.ts                Shared class-name helper
```

The landing page is implemented as a single route and assembled from reusable components including `Navbar`, `LiveDashboard`, `FeatureCard`, `HowItWorks`, `ArchitectureDiagram`, `ScreenshotPlaceholder`, and `CTASection`.

## Links and downloads

GitHub links on the landing page point to this repository:

```ts
const githubUrl = "https://github.com/pseudozach/zapcast.live";
```

The `/download` route pulls release metadata from the ZapCast desktop app repository at runtime/build time using the GitHub Releases API:

```text
https://api.github.com/repos/pseudozach/zapcast/releases/latest
```

By default it shows GitHub's latest non-draft, non-prerelease release and maps the release assets by filename:

- `*arm64.dmg` for macOS Apple Silicon
- `*x64.dmg` for macOS Intel
- `*Setup.exe` for Windows
- `*x64.AppImage` for Linux

The route is cached with ISR and revalidates every hour on Vercel. If GitHub is temporarily unavailable, the page falls back to the last known `v0.2.0` links.

To pin the page to a specific release instead of auto-following latest, set one environment variable in Vercel:

```bash
ZAPCAST_RELEASE_TAG=v0.2.0
```

Remove that variable to return to automatic latest-release behavior.

## Deployment

The site is ready for Vercel with no custom build configuration.

1. Import `pseudozach/zapcast.live` into Vercel.
2. Keep the detected framework preset set to **Next.js**.
3. Use `npm run build` as the build command.
4. Add `zapcast.live` under the project domains.

No environment variables are currently required.

For another Node-compatible host:

```bash
npm install
npm run build
npm run start
```

## Content guidelines

ZapCast is presented as a working desktop MVP and a product vision for unstoppable livestreaming through peer-to-peer distribution. Copy should remain technically accurate:

- Do not claim production scale, anonymity, or complete censorship resistance.
- Explain resilience as peer-to-peer replication without traditional CDN dependency.
- Describe Arc wallet functionality accurately without overclaiming production payment guarantees.
- Distinguish current functionality from future payment integrations.

## License

No license has been specified. All rights are reserved unless a license is added to this repository.
