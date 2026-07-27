import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border/80 bg-muted/20 px-2.5 py-1 text-xs font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}
