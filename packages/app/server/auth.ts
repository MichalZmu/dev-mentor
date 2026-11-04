import "server-only";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { Pool } from "pg";
import { runtimeEnvironment, type RuntimeEnvironment } from "./env";
import { deliverEmail } from "./email";

type Auth = ReturnType<typeof betterAuth>;
export interface AuthRuntime {
  auth: Auth;
  pool: Pool;
  env: RuntimeEnvironment;
}
export function createAuthRuntime(env: RuntimeEnvironment): AuthRuntime {
  const pool = new Pool({
    connectionString: env.AUTH_DATABASE_URL ?? env.DATABASE_URL,
    options: "-c search_path=auth",
    max: env.DB_AUTH_POOL_MAX,
  });
  const options: BetterAuthOptions = {
    appName: "DevMentor",
    baseURL: env.APP_URL,
    basePath: "/api/auth",
    secret: env.AUTH_SECRET ?? "local-demo-only-do-not-use-in-production-2026",
    database: pool,
    trustedOrigins: [env.APP_URL],
    socialProviders:
      env.OAUTH_GOOGLE_CLIENT_ID && env.OAUTH_GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.OAUTH_GOOGLE_CLIENT_ID,
              clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
    advanced: {
      useSecureCookies: env.APP_MODE === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.APP_MODE === "production",
      },
    },
    user: {
      changeEmail: {
        enabled: true,
        updateEmailWithoutVerification: false,
        sendChangeEmailConfirmation: async ({ user, url }) => {
          await deliverEmail(pool, env, {
            to: user.email,
            subject: "Potwierdź zmianę adresu DevMentor",
            text: "Potwierdź zmianę adresu: " + url,
            url,
          });
        },
      },
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieCache: { enabled: false },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 1800,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        const url = new URL("/auth", env.APP_URL);
        url.searchParams.set("mode", "confirm");
        url.searchParams.set("token", token);
        await deliverEmail(pool, env, {
          to: user.email,
          subject: "Zresetuj hasło DevMentor",
          text: "Otwórz jednorazowy link, aby zmienić hasło: " + url.href,
          url: url.href,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 1800,
      sendVerificationEmail: async ({ user, url }) => {
        await deliverEmail(pool, env, {
          to: user.email,
          subject: "Potwierdź e-mail DevMentor",
          text: "Potwierdź adres e-mail: " + url,
          url,
        });
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/request-password-reset": { window: 60, max: 5 },
      },
    },
    plugins: [twoFactor({ issuer: "DevMentor" })],
    logger: { disabled: true },
  };
  return { auth: betterAuth(options), pool, env };
}
let singleton: AuthRuntime | undefined;
export function getAuthRuntime(): AuthRuntime {
  return (singleton ??= createAuthRuntime(runtimeEnvironment()));
}
export async function closeAuthRuntime(): Promise<void> {
  const current = singleton;
  singleton = undefined;
  await current?.pool.end();
}
