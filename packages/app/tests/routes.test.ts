import { expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), api: vi.fn() }));
vi.mock("@/server/auth-http", () => ({ handleNativeAuth: mocks.auth }));
vi.mock("@/server/api", () => ({ handleApi: mocks.api }));
import * as auth from "../app/api/auth/[...all]/route";
import * as api from "../app/api/v1/[...path]/route";
test("route modules expose the same guarded handlers for each supported verb", () => {
  expect(auth.GET).toBe(mocks.auth);
  expect(auth.POST).toBe(mocks.auth);
  for (const handler of [api.GET, api.POST, api.PUT, api.PATCH, api.DELETE])
    expect(handler).toBe(mocks.api);
});
