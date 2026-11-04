import "server-only";
import { z } from "zod";

const schema = z
  .object({
    APP_MODE: z.enum(["demo", "production"]).default("production"),
    APP_URL: z.url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1),
    AUTH_DATABASE_URL: z.string().optional(),
    AUTH_SECRET: z.string().min(32).optional(),
    SMTP_URL: z.string().optional(),
    OAUTH_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    OAUTH_GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    MEETING_BASE_URL: z.url().optional(),
    EMAIL_FROM: z.string().default("DevMentor <noreply@example.test>"),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    DB_AUTH_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  })
  .superRefine((env, context) => {
    const url = new URL(env.APP_URL);
    if (
      Boolean(env.OAUTH_GOOGLE_CLIENT_ID) !==
      Boolean(env.OAUTH_GOOGLE_CLIENT_SECRET)
    )
      context.addIssue({
        code: "custom",
        message: "OAuth provider requires paired client credentials.",
      });
    if (
      env.APP_MODE === "production" &&
      (!env.AUTH_SECRET || url.protocol !== "https:")
    )
      context.addIssue({
        code: "custom",
        message: "Production requires AUTH_SECRET and HTTPS APP_URL.",
      });
    if (
      env.APP_MODE === "demo" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      context.addIssue({
        code: "custom",
        message: "Demo requires a loopback APP_URL.",
      });
  });
export type RuntimeEnvironment = z.infer<typeof schema>;
export function runtimeEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): RuntimeEnvironment {
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      "Invalid server configuration. Check required environment variables.",
    );
  return result.data;
}
