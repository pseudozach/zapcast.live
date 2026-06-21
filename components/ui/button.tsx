import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-cyan-300 text-slate-950 shadow-[0_0_32px_rgba(103,232,249,.22)] hover:bg-cyan-200 hover:shadow-[0_0_42px_rgba(103,232,249,.32)]",
        outline: "border border-white/14 bg-white/[.04] text-white backdrop-blur hover:border-white/25 hover:bg-white/[.08]",
        ghost: "text-slate-300 hover:bg-white/[.06] hover:text-white",
      },
      size: {
        default: "h-11 px-5",
        lg: "h-13 px-7 text-[15px]",
        sm: "h-9 px-4 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
