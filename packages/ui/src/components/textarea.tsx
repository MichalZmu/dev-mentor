import type { ComponentProps, JSX } from "react";
import { cn } from "cn";
export function Textarea({
  className,
  ...props
}: ComponentProps<"textarea">): JSX.Element {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
