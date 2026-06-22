import Image from "next/image";

export function SiteLogo({ href = "/" }: { href?: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2.5 font-display font-semibold tracking-tight text-white"
    >
      <Image
        src="/android-chrome-192x192.png"
        alt=""
        width={36}
        height={36}
        className="size-9 rounded-lg"
        priority
      />
      <span>ZapCast</span>
    </a>
  );
}
