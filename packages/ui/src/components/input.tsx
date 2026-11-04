import type { ComponentProps, JSX } from "react";
import { cn } from "cn";
export function Input({
  className,
  ...props
}: ComponentProps<"input">): JSX.Element {
  return (
    <input
      data-slot="input"
      className={cn(
        "flex min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
