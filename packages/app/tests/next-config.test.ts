import { afterEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ config: vi.fn() }));
vi.mock("dotenv", () => ({ config: mocks.config }));
import nextConfig from "../next.config";
afterEach(() => vi.unstubAllEnvs());
test.each(["development", "production"] as const)(
  "CSP restricts active content and varies development-only capabilities in %s",
  async (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    if (!nextConfig.headers) throw new Error("Security headers are missing");
    const routes = await nextConfig.headers();
    expect(routes).toHaveLength(1);
    expect(routes[0]?.source).toBe("/:path*");
    const headers = new Map(
      routes[0]?.headers.map((header) => [header.key, header.value]),
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    const policy = headers.get("Content-Security-Policy");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("form-action 'self'");
    if (mode === "development") {
      expect(policy).toContain(
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      );
      expect(policy).toContain("connect-src 'self' ws: wss:");
    } else {
      expect(policy).not.toContain("'unsafe-eval'");
      expect(policy).toContain("connect-src 'self';");
      expect(policy).not.toContain("ws:");
    }
  },
);
