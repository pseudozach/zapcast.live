import type { Metadata } from "next";
import { StreamList } from "@/components/streams/stream-list";

export const metadata: Metadata = {
  title: "Live ZapCast Streams",
  description: "Discover live ZapCast NIP-53 streams and watch in the browser through the ZapCast gateway.",
};

export default function StreamsPage() {
  return <StreamList />;
}
