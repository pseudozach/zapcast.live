import type { Metadata } from "next";
import { WatchViewer } from "@/components/watch/watch-viewer";

export const metadata: Metadata = {
  title: "Watch ZapCast Stream",
  description: "Watch a live ZapCast stream in the browser through the ZapCast gateway.",
};

export default async function WatchPage({ params }: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await params;
  return <WatchViewer rawStreamId={streamId} />;
}
