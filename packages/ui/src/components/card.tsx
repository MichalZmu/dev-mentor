import type { ComponentProps, JSX } from "react";
import { cn } from "cn";
export function Card({
  className,
  ...props
}: ComponentProps<"section">): JSX.Element {
  return (
    <section
      data-slot="card"
      className={cn(
        "rounded-2xl border bg-card p-6 text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
export function CardTitle({
  className,
  ...props
}: ComponentProps<"h2">): JSX.Element {
  return (
    <h2
      data-slot="card-title"
      className={cn("text-xl font-semibold tracking-tight", className)}
      {...props}
    />
  );
}
