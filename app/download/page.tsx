import type { Metadata } from "next";
import { DownloadPage } from "@/components/download-page";

export const metadata: Metadata = {
  title: "Download ZapCast — macOS, Windows, and Linux",
  description:
    "Download the ZapCast desktop app for Apple Silicon, Intel Mac, Windows, or Linux.",
};

export default function Page() {
  return <DownloadPage />;
}
