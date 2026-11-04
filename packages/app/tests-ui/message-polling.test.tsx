import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useResource } from "../components/api-client";
import { MessagesPanel } from "../components/messages-panel";
import { user } from "./fixtures";

let visibility: DocumentVisibilityState = "visible";
beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility,
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
async function advance(milliseconds = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}
function deferred(): {
  promise: Promise<Response>;
  resolve: (value: Response) => void;
  reject: (reason: unknown) => void;
} {
  let resolve: (value: Response) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<Response>((success, failure) => {
    resolve = success;
    reject = failure;
  });
  return { promise, resolve, reject };
}
function setVisibility(value: DocumentVisibilityState): void {
  act(() => {
    visibility = value;
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

// MSG-P1/P2: background reads wait for completion and retain the readable page.
test("polling waits ten seconds after each completed read and never overlaps initial, manual or background reads", async () => {
  const initial = deferred();
  const background = deferred();
  const manual = deferred();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockReturnValueOnce(initial.promise)
    .mockReturnValueOnce(background.promise)
    .mockReturnValueOnce(manual.promise);
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() =>
    useResource<number[]>("/messages", "owner", 10_000),
  );
  await advance(30_000);
  expect(fetcher).toHaveBeenCalledTimes(1);
  initial.resolve(Response.json({ data: [1], nextCursor: "older" }));
  await advance();
  await advance(9_999);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(hook.result.current).toMatchObject({
    data: [1],
    loading: false,
    nextCursor: "older",
  });
  setVisibility("visible");
  await advance(30_000);
  expect(fetcher).toHaveBeenCalledTimes(2);
  act(() => hook.result.current.reload());
  expect(fetcher.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
  await advance(30_000);
  expect(fetcher).toHaveBeenCalledTimes(3);
  background.resolve(Response.json({ data: [999] }));
  await advance();
  expect(hook.result.current.data).toEqual([1]);
  manual.resolve(Response.json({ data: [2] }));
  await advance();
  expect(hook.result.current.data).toEqual([2]);
  hook.unmount();
});

// MSG-P3/P4: visibility, resource ownership and teardown control polling lifetime.
test("hidden tabs pause polling and resource switches abort stale successes and failures", async () => {
  const late = deferred();
  const failure = deferred();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ data: "a" }))
    .mockReturnValueOnce(late.promise)
    .mockResolvedValueOnce(Response.json({ data: "b" }))
    .mockReturnValueOnce(failure.promise)
    .mockResolvedValueOnce(Response.json({ data: "new-owner" }));
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(
    ({ path, owner }: { path: string | null; owner: string }) =>
      useResource<string>(path, owner, 10_000),
    {
      initialProps: { path: "/a" as string | null, owner: "one" },
    },
  );
  await advance();
  setVisibility("hidden");
  await advance(30_000);
  expect(fetcher).toHaveBeenCalledTimes(1);
  setVisibility("visible");
  await advance(10_000);
  expect(fetcher).toHaveBeenCalledTimes(2);
  hook.rerender({ path: "/b", owner: "one" });
  await advance();
  late.resolve(Response.json({ data: "stale" }));
  await advance();
  expect(hook.result.current.data).toBe("b");
  await advance(10_000);
  hook.rerender({ path: "/b", owner: "two" });
  await advance();
  failure.reject(new Error("old owner"));
  await advance();
  expect(hook.result.current).toMatchObject({
    data: "new-owner",
    error: "",
    refreshError: "",
  });
  hook.rerender({ path: null, owner: "two" });
  expect(hook.result.current.data).toBeNull();
  expect(hook.result.current.refreshError).toBe("");
  await advance(30_000);
  expect(fetcher).toHaveBeenCalledTimes(5);
  hook.unmount();
  setVisibility("visible");
  await advance(30_000);
  expect(fetcher).toHaveBeenCalledTimes(5);
});

test("unmount cancels an active refresh and ignores its late result", async () => {
  const late = deferred();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ data: [1] }))
    .mockReturnValueOnce(late.promise);
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() => useResource("/messages", "owner", 10_000));
  await advance();
  await advance(10_000);
  hook.unmount();
  expect(fetcher.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
  late.resolve(Response.json({ data: [2] }));
  await advance(30_000);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

// MSG-P5: transient refresh errors preserve history/cursors and recover automatically.
test.each([new Error("offline"), "offline"])(
  "background errors preserve data and cursor until the next successful poll (%s)",
  async (cause) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: [1], nextCursor: "older" }))
      .mockRejectedValueOnce(cause)
      .mockResolvedValueOnce(
        Response.json({ data: [2], nextCursor: "new-older" }),
      );
    vi.stubGlobal("fetch", fetcher);
    const hook = renderHook(() => useResource("/messages", "owner", 10_000));
    await advance();
    await advance(10_000);
    expect(hook.result.current).toMatchObject({
      data: [1],
      nextCursor: "older",
      loading: false,
      error: "",
      refreshError: cause instanceof Error ? "offline" : "Błąd połączenia.",
    });
    await advance(10_000);
    expect(hook.result.current).toMatchObject({
      data: [2],
      nextCursor: "new-older",
      refreshError: "",
    });
    hook.unmount();
  },
);

test("an initial failure retains explicit retry behavior and does not start background polling", async () => {
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() => useResource("/messages", "owner", 10_000));
  await advance(30_000);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(hook.result.current).toMatchObject({
    data: null,
    error: "offline",
    refreshError: "",
  });
  hook.unmount();
});

// MSG-P6: the actual panel receives another participant's message without losing a draft/history.
test("message panel polls new messages in place, preserves drafts on refresh failure and pauses on older history", async () => {
  const history = [
    {
      id: "old",
      conversationId: "c",
      senderId: "mentor",
      text: "Pierwsza wiadomość",
      createdAt: "2026-11-03T12:00:00Z",
    },
  ];
  let reads = 0;
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const path = String(input);
    if (path === "/api/v1/conversations")
      return Response.json({ data: [{ id: "c", mentorName: "Mentor" }] });
    if (path.includes("?cursor="))
      return Response.json({
        data: [{ ...history[0], id: "earlier", text: "Starsza historia" }],
      });
    reads++;
    if (reads === 2) throw new Error("offline");
    return Response.json({
      data:
        reads < 3
          ? history
          : [
              ...history,
              { ...history[0], id: "new", text: "Odpowiedź mentora" },
            ],
      nextCursor: "older",
    });
  });
  vi.stubGlobal("fetch", fetcher);
  const panel = render(<MessagesPanel user={user} />);
  await advance();
  const draft = screen.getByLabelText("Twoja wiadomość (do 2000 znaków)");
  fireEvent.change(draft, { target: { value: "Szkic odpowiedzi" } });
  await advance(10_000);
  expect(screen.getByText("Pierwsza wiadomość")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Nie udało się odświeżyć rozmowy",
  );
  expect(
    screen.getByRole("button", { name: "Starsze wiadomości" }),
  ).toBeVisible();
  expect(draft).toHaveValue("Szkic odpowiedzi");
  await advance(10_000);
  expect(screen.getByText("Odpowiedź mentora")).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(draft).toHaveValue("Szkic odpowiedzi");
  fireEvent.click(screen.getByRole("button", { name: "Starsze wiadomości" }));
  await advance();
  expect(screen.getByText("Starsza historia")).toBeVisible();
  const count = fetcher.mock.calls.length;
  await advance(30_000);
  expect(fetcher).toHaveBeenCalledTimes(count);
  fireEvent.click(screen.getByRole("button", { name: "Najnowsze wiadomości" }));
  await advance();
  await advance(10_000);
  expect(fetcher.mock.calls.length).toBe(count + 2);
  expect(draft).toHaveValue("Szkic odpowiedzi");
  panel.unmount();
});
