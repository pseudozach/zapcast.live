import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-white/[.09] bg-white/[.035] backdrop-blur-xl", className)} {...props} />;
}
