import "server-only";
import { trace } from "@opentelemetry/api";
export function logEvent(
  level: "info" | "error",
  operation: string,
  requestId: string,
  code: string,
): void {
  const entry = {
    level,
    time: new Date().toISOString(),
    operation,
    requestId,
    code,
    traceId: trace.getActiveSpan()?.spanContext().traceId,
  };
  if (level === "error") console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}
