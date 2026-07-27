"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-semibold tracking-tight transition-[transform,background,color,box-shadow,filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:shadow-[0_0_0_10px_rgba(88,167,255,0.08)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-[#2b8cff] via-[#58a7ff] to-[#a269ff] text-[#07111f] shadow-[0_12px_34px_-18px_rgba(88,167,255,0.9)] hover:brightness-110",
        secondary:
          "bg-muted/20 text-foreground border border-border/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-muted/30",
        outline:
          "border border-border/80 bg-transparent text-foreground hover:bg-muted/20",
        ghost: "bg-transparent text-foreground hover:bg-muted/20",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_12px_34px_-18px_rgba(244,63,94,0.55)] hover:brightness-110",
      },
      size: {
        sm: "h-10 px-4",
        md: "h-11 px-5",
        lg: "h-12 px-6",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
