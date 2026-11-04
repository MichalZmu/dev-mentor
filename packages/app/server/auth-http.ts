import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@devmentor/core";
import { getAuthRuntime } from "./auth";
import { assertOrigin, empty, errorResponse, jsonBody, response } from "./http";
import { authenticate, withPlatform } from "./platform";

function cookiesAfter(headers: Headers, result: Headers): Headers {
  const cookies = new Map<string, string>();
  for (const entry of (headers.get("cookie") ?? "").split(";")) {
    const index = entry.indexOf("=");
    if (index > 0)
      cookies.set(entry.slice(0, index).trim(), entry.slice(index + 1).trim());
  }
  for (const entry of result.getSetCookie()) {
    const pair = entry.slice(0, (entry + ";").indexOf(";"));
    const index = pair.indexOf("=");
    if (index > 0) cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }
  const merged = new Headers(headers);
  merged.set(
    "cookie",
    [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
  );
  return merged;
}
function mailboxCookie(request: Request): string | undefined {
  return /(?:^|;\s*)devmentor_demo_mailbox=([a-f0-9]{64})(?:;|$)/.exec(
    request.headers.get("cookie") ?? "",
  )?.[1];
}
const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
export async function handleNativeAuth(request: Request): Promise<Response> {
  try {
    const { auth, env, pool } = getAuthRuntime();
    if (request.method !== "GET") assertOrigin(request, env.APP_URL);
    const path = new URL(request.url).pathname;
    if (path.endsWith("/sign-up/email"))
      return errorResponse(new DomainError("USE_REGISTER_ENDPOINT", 400));
    if (path.endsWith("/change-email") && env.APP_MODE === "demo") {
      const session = await auth.api.getSession({ headers: request.headers });
      const owner = mailboxCookie(request);
      if (session && owner) {
        const body = z
          .object({ newEmail: z.email() })
          .passthrough()
          .parse(await request.clone().json());
        await pool.query(
          `insert into auth.demo_mailbox_owner(email,owner_hash) select lower($1),$2 where not exists(select 1 from auth."user" where lower(email)=lower($1)) on conflict(email) do nothing`,
          [body.newEmail, digest(owner)],
        );
      }
    }
    const result = await auth.handler(request);
    if (
      result.ok &&
      /\/two-factor\/verify-(?:totp|otp|backup-code)$/.test(path)
    ) {
      const session = await auth.api.getSession({
        headers: cookiesAfter(request.headers, result.headers),
        query: { disableCookieCache: true },
      });
      if (session)
        await pool.query(
          "insert into auth.mfa_session(session_id, verified_at) values($1,now()) on conflict(session_id) do update set verified_at=excluded.verified_at",
          [session.session.id],
        );
    }
    if (result.status >= 500)
      return errorResponse(new Error("Authentication unavailable"));
    result.headers.set("Cache-Control", "no-store");
    return result;
  } catch (error) {
    return errorResponse(error);
  }
}
export async function handleAuthWrapper(
  request: Request,
  path: string,
): Promise<Response> {
  const { auth, pool, env } = getAuthRuntime();
  assertOrigin(request, env.APP_URL);
  const raw = await jsonBody(request);
  let target = "";
  let body: Record<string, unknown> = {};
  let owner: string | undefined;
  if (path === "login") {
    body = z
      .object({ email: z.email(), password: z.string().min(1).max(128) })
      .strict()
      .parse(raw);
    target = "sign-in/email";
  } else if (path === "register") {
    const input = z
      .object({
        email: z.email().max(254),
        password: z.string().min(12).max(128),
        name: z.string().trim().min(2).max(100),
        termsVersion: z.string().min(1).max(50),
      })
      .strict()
      .parse(raw);
    body = {
      email: input.email,
      password: input.password,
      name: input.name,
      callbackURL: "/auth",
    };
    target = "sign-up/email";
    if (env.APP_MODE === "demo") {
      owner = mailboxCookie(request) ?? randomBytes(32).toString("hex");
      await pool.query(
        `insert into auth.demo_mailbox_owner(email, owner_hash)
        select lower($1),$2 where not exists(select 1 from auth."user" where lower(email)=lower($1)) on conflict(email) do nothing`,
        [input.email, digest(owner)],
      );
    }
  } else if (path === "password-reset") {
    body = z.object({ email: z.email() }).strict().parse(raw);
    target = "request-password-reset";
  } else if (path === "password-reset/confirm") {
    body = z
      .object({
        token: z.string().min(1).max(500),
        newPassword: z.string().min(12).max(128),
      })
      .strict()
      .parse(raw);
    target = "reset-password";
  } else if (path === "logout") {
    z.object({}).strict().parse(raw);
    target = "sign-out";
  } else throw new DomainError("NOT_FOUND", 404);
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  const native = await auth.handler(
    new Request(new URL("/api/auth/" + target, env.APP_URL), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
  if (path === "password-reset" && native.status === 429)
    throw new DomainError("RATE_LIMITED", 429);
  if (native.status >= 500)
    throw new Error("Authentication transport unavailable");
  if (path === "password-reset")
    return response(
      { message: "Jeśli konto istnieje, wysłaliśmy instrukcję." },
      202,
    );
  if (!native.ok)
    throw new DomainError(
      native.status === 429
        ? "RATE_LIMITED"
        : path === "login"
          ? "INVALID_CREDENTIALS_OR_EMAIL_UNVERIFIED"
          : "AUTH_REQUEST_REJECTED",
      native.status === 429 ? 429 : path === "login" ? 401 : 422,
    );
  const resultBody: unknown = await native
    .clone()
    .json()
    .catch(() => ({}));
  let result: Response;
  if (path === "logout") result = empty();
  else if (path === "register")
    result = response(
      {
        emailVerificationRequired: true,
        demoMailboxAvailable: env.APP_MODE === "demo",
      },
      201,
    );
  else if (path === "login") {
    if (
      typeof resultBody === "object" &&
      resultBody !== null &&
      "twoFactorRedirect" in resultBody &&
      resultBody.twoFactorRedirect
    )
      result = response({ twoFactorRedirect: true });
    else {
      const authenticated = new Request(request.url, {
        headers: cookiesAfter(request.headers, native.headers),
      });
      const user = await withPlatform(async (service, repository) =>
        service.profile(await authenticate(authenticated, repository)),
      );
      result = response({ user });
    }
  } else result = response({ success: true });
  for (const value of native.headers.getSetCookie())
    result.headers.append("set-cookie", value);
  if (owner)
    result.headers.append(
      "set-cookie",
      `devmentor_demo_mailbox=${owner}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`,
    );
  return result;
}
export async function demoMailbox(request: Request): Promise<Response> {
  const { env, pool } = getAuthRuntime();
  // Next may normalize Request.url to the bind address. The transport Host
  // takes precedence; forwarded host headers never authorize the demo mailbox.
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (
    env.APP_MODE !== "demo" ||
    !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i.test(host)
  )
    throw new DomainError("NOT_FOUND", 404);
  const owner = mailboxCookie(request);
  if (!owner) return response([]);
  const result = await pool.query<{
    id: string;
    subject: string;
    url: string | null;
    createdAt: string;
  }>(
    `select id,subject,url,created_at as "createdAt" from auth.demo_mailbox where owner_hash=$1 order by created_at desc limit 20`,
    [digest(owner)],
  );
  return response(result.rows);
}
