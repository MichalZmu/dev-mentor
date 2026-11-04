import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@devmentor/core";
import { logEvent } from "./log";

export function response(data: unknown, status = 200): Response {
  return Response.json(
    { data },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
export function empty(): Response {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
export function errorResponse(
  error: unknown,
  requestId: string = randomUUID(),
): Response {
  let status = 503;
  let code = "SERVICE_UNAVAILABLE";
  let message = "Usługa jest chwilowo niedostępna.";
  let fieldErrors: Record<string, string[]> | undefined;
  if (error instanceof DomainError) {
    status = error.status;
    code = error.code;
    message = "Nie można wykonać operacji: " + code;
  }
  if (error instanceof z.ZodError) {
    status = 422;
    code = "VALIDATION_ERROR";
    message = "Sprawdź wprowadzone dane.";
    fieldErrors = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] = ["Nieprawidłowa wartość."];
    }
  }
  if (status >= 500) logEvent("error", "http.request", requestId, code);
  return Response.json(
    {
      error: {
        code,
        message,
        requestId,
        ...(fieldErrors ? { fieldErrors } : {}),
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}
export async function jsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new DomainError("JSON_REQUIRED", 400);
  if (Number(request.headers.get("content-length")) > 32_768)
    throw new DomainError("BODY_TOO_LARGE", 413);
  const body = await request.text();
  if (Buffer.byteLength(body) > 32_768)
    throw new DomainError("BODY_TOO_LARGE", 413);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new DomainError("INVALID_JSON", 400);
  }
}
export function assertOrigin(request: Request, origin: string): void {
  if (request.headers.get("origin") !== new URL(origin).origin)
    throw new DomainError("ORIGIN_FORBIDDEN", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new DomainError("ORIGIN_FORBIDDEN", 403);
}
export function idempotencyKey(request: Request): string {
  return z
    .string()
    .min(8)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .parse(request.headers.get("idempotency-key"));
}
