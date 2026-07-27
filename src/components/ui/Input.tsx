"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-2xl border border-border/80 bg-muted/20 px-4 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-muted-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:shadow-[0_0_0_10px_rgba(88,167,255,0.08)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
