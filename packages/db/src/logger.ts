type LogEvent = {
  level: "info" | "error";
  requestId: string;
  operation: "database.check";
  code: "DATABASE_OK" | "DATABASE_UNAVAILABLE";
};

/** An allowlist prevents driver errors, URLs and arbitrary payloads reaching logs. */
export function serializeLog(event: LogEvent): string {
  return JSON.stringify({
    level: event.level,
    time: new Date().toISOString(),
    requestId: event.requestId,
    operation: event.operation,
    code: event.code,
  });
}
