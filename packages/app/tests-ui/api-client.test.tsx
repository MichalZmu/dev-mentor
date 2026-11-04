import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import {
  ApiError,
  request,
  useResource,
  useAction,
  money,
  dateTime,
  formText,
  priceMinor,
} from "../components/api-client";
import { mockApi } from "./fixtures";

test("request preserves options and parses API envelopes, no-content and malformed responses", async () => {
  const fetcher = mockApi({
    "/ok": { answer: 42 },
    "/empty": new Response(null, { status: 204 }),
    "/bad": Response.json({ other: [] }),
    "/invalid": new Response("not-json"),
    "/array": Response.json([]),
  });
  expect(
    (
      await request<{ answer: number }>("/ok", {
        method: "PUT",
        headers: { "X-Test": "yes" },
      })
    ).data.answer,
  ).toBe(42);
  expect(fetcher).toHaveBeenCalledWith(
    "/api/v1/ok",
    expect.objectContaining({
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Test": "yes" },
    }),
  );
  expect(await request("/empty")).toEqual({ data: undefined });
  for (const path of ["/bad", "/invalid", "/array"])
    await expect(request(path)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 502,
    });
});
test.each([
  { error: { message: "No access", code: "FORBIDDEN" } },
  { error: { message: 4, code: 8 } },
  { error: [] },
  null,
])("request presents safe transport errors (%j)", async (body) => {
  mockApi({ "/fail": Response.json(body, { status: 403 }) });
  await expect(request("/fail")).rejects.toBeInstanceOf(ApiError);
  await expect(request("/fail")).rejects.toMatchObject({
    status: 403,
    code:
      body?.error &&
      !Array.isArray(body.error) &&
      typeof body.error.code === "string"
        ? "FORBIDDEN"
        : "REQUEST_FAILED",
  });
});
test("resource fetches, reloads, changes paths and resets nullable resources", async () => {
  const fetcher = mockApi({ "/one": 1, "/two": 2 });
  const hook = renderHook(
    ({ path }: { path: string | null }) => useResource<number>(path),
    { initialProps: { path: "/one" as string | null } },
  );
  expect(hook.result.current.loading).toBe(true);
  await waitFor(() => expect(hook.result.current.data).toBe(1));
  act(() => hook.result.current.reload());
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  hook.rerender({ path: "/two" });
  await waitFor(() => expect(hook.result.current.data).toBe(2));
  hook.rerender({ path: null });
  expect(hook.result.current.loading).toBe(false);
  expect(hook.result.current.data).toBeNull();
});
test("resource handles network errors and ignores stale successes and failures after abort", async () => {
  for (const rejection of [new Error("offline"), "offline"]) {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(rejection));
    const hook = renderHook(() => useResource("/fail"));
    await waitFor(() =>
      expect(hook.result.current.error).toBe(
        rejection instanceof Error ? "offline" : "Błąd połączenia.",
      ),
    );
    hook.unmount();
  }
  let complete: (response: Response) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    ),
  );
  const success = renderHook(() => useResource("/pending"));
  success.unmount();
  await act(async () => {
    complete(Response.json({ data: 1, nextCursor: "next" }));
  });
  let reject: (reason: unknown) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((_, fail) => {
          reject = fail;
        }),
    ),
  );
  const failure = renderHook(() => useResource("/pending"));
  failure.unmount();
  await act(async () => {
    reject(new Error("late"));
  });
});
test("resource preserves pagination cursor", async () => {
  mockApi({ "/page": Response.json({ data: [1], nextCursor: "cursor" }) });
  const hook = renderHook(() => useResource("/page"));
  await waitFor(() => expect(hook.result.current.nextCursor).toBe("cursor"));
});
test("actions serialize requests with stable retry keys and give success and error feedback", async () => {
  const fetcher = mockApi({ "/write": { id: 1 } });
  const hook = renderHook(() => useAction());
  await act(async () => {
    await hook.result.current.run(async () => {
      expect(await hook.result.current.mutate("/write", { value: 1 })).toEqual({
        id: 1,
      });
    });
  });
  expect(hook.result.current.notice).toBe("Zmiany zapisane.");
  await act(async () => {
    await hook.result.current.mutate("/write", { value: 1 });
    await hook.result.current.mutate("/write", { value: 2 }, "PATCH");
  });
  expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual(
    fetcher.mock.calls[1]?.[1]?.headers,
  );
  expect(fetcher.mock.calls[2]?.[1]?.headers).not.toEqual(
    fetcher.mock.calls[0]?.[1]?.headers,
  );
  for (const cause of [new Error("Rejected"), 42]) {
    await act(async () => {
      await hook.result.current.run(async () => {
        throw cause;
      }, "Saved");
    });
    expect(hook.result.current.error).toBe(
      cause instanceof Error ? "Rejected" : "Operacja nie powiodła się.",
    );
  }
  let finish: () => void = () => {};
  let pending: Promise<void> = Promise.resolve();
  act(() => {
    pending = hook.result.current.run(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
  });
  const second = vi.fn(async () => {});
  await act(async () => {
    await hook.result.current.run(second);
    finish();
    await pending;
  });
  expect(second).not.toHaveBeenCalled();
});
test("formatters retain precision and safely reject invalid values", () => {
  expect(money("1234567890123456789")).toContain(",89 PLN");
  expect(money("bad", "EUR")).toBe("— EUR");
  expect(dateTime("bad")).toBe("bad");
  expect(dateTime("2026-11-03T12:00:00Z", "UTC")).toContain("2026");
  const form = new FormData();
  form.set("text", "value");
  form.set("file", new File(["x"], "x.txt"));
  expect(formText(form, "text")).toBe("value");
  expect(formText(form, "file")).toBe("");
  expect(formText(form, "missing")).toBe("");
  expect(priceMinor("123,4")).toBe("12340");
  expect(priceMinor("2")).toBe("200");
  expect(() => priceMinor("1.234")).toThrow("kwotę");
});
