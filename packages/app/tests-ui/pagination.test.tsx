import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { usePaginatedResource } from "../components/api-client";
import { Pagination } from "../components/shared";
import { MessagesPanel } from "../components/messages-panel";
import { SessionsPanel } from "../components/sessions-panel";
import { SupportPanel } from "../components/account-panels";
import { AdminWorkspace } from "../components/admin-workspace";
import { MentorProfile } from "../components/mentor-profile";
import { booking, mentor, mockApi, supportCase, user } from "./fixtures";

function pages(path: string, items: unknown[]): ReturnType<typeof mockApi> {
  return mockApi({
    [path]: Response.json({ data: items.slice(0, 20), nextCursor: "page-two" }),
    [path + "?cursor=page-two"]: Response.json({
      data: items.slice(20),
      nextCursor: null,
    }),
    "/me": { ...user, roles: ["admin"] },
    ["/mentors/" + mentor.id]: mentor,
    ["/mentors/" + mentor.id + "/availability"]: [],
  });
}

test.each(["sessions", "support", "admin", "reviews", "conversations"])(
  "%s exposes resource21 and preserves previous navigation",
  async (kind) => {
    const items = Array.from({ length: 21 }, (_, i) => {
      const id = "resource-" + i;
      if (kind === "sessions") return { ...booking, id };
      if (kind === "support" || kind === "admin")
        return { ...supportCase, id, payload: { name: id, description: id } };
      if (kind === "reviews")
        return {
          id,
          authorName: id,
          comment: id,
          rating: 5,
          createdAt: booking.startsAt,
        };
      return { id, mentorName: id };
    });
    const path =
      kind === "sessions"
        ? "/me/sessions"
        : kind === "support"
          ? "/me/support-tickets"
          : kind === "admin"
            ? "/admin/mentor-applications"
            : kind === "reviews"
              ? "/mentors/" + mentor.id + "/reviews"
              : "/conversations";
    const fetcher = pages(path, items);
    if (kind === "sessions") render(<SessionsPanel user={user} />);
    else if (kind === "support") render(<SupportPanel userId={user.id} />);
    else if (kind === "admin") render(<AdminWorkspace />);
    else if (kind === "reviews") render(<MentorProfile id={mentor.id} />);
    else render(<MessagesPanel user={user} />);
    const next = await screen.findByRole("button", { name: "Następna strona" });
    expect(
      screen.getByRole("button", { name: "Poprzednia strona" }),
    ).toBeDisabled();
    fireEvent.click(next);
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/v1" + path + "?cursor=page-two",
        expect.any(Object),
      ),
    );
    await waitFor(() => expect(screen.getByText("Strona 2")).toBeVisible());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Następna strona" }),
      ).toBeDisabled(),
    );
    if (kind !== "sessions")
      expect(screen.getAllByText(/resource-20/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Poprzednia strona" }));
    await waitFor(() => expect(screen.getByText("Strona 1")).toBeVisible());
    if (kind === "admin") {
      fireEvent.click(screen.getByRole("button", { name: "Następna strona" }));
      await screen.findByText("Strona 2");
      fireEvent.click(
        screen.getByRole("button", { name: "Zgłoszenia pomocy" }),
      );
      await waitFor(() =>
        expect(fetcher).toHaveBeenCalledWith(
          "/api/v1/admin/support-tickets",
          expect.any(Object),
        ),
      );
      expect(screen.queryByText("Strona 2")).not.toBeInTheDocument();
    }
  },
);

test("pagination hook scopes cursors, preserves query, ignores repeated cursors and resets on reload and auth", async () => {
  const fetcher = mockApi({
    "/items?sort=price": Response.json({
      data: [1],
      nextCursor: "cursor & one",
    }),
    "/items?sort=price&cursor=cursor+%26+one": Response.json({
      data: [2],
      nextCursor: "cursor & one",
    }),
    "/other": [],
  });
  const hook = renderHook(
    ({ path, owner }: { path: string | null; owner: string }) =>
      usePaginatedResource<number>(path, owner),
    {
      initialProps: {
        path: "/items?sort=price&cursor=discarded" as string | null,
        owner: "one",
      },
    },
  );
  act(() => {
    hook.result.current.nextPage();
    hook.result.current.previousPage();
  });
  await waitFor(() => expect(hook.result.current.data).toEqual([1]));
  const staleNext = hook.result.current.nextPage;
  act(() => hook.result.current.nextPage());
  await waitFor(() => expect(hook.result.current.data).toEqual([2]));
  const calls = fetcher.mock.calls.length;
  act(() => hook.result.current.nextPage());
  expect(fetcher.mock.calls).toHaveLength(calls);
  const stalePrevious = hook.result.current.previousPage;
  hook.rerender({ path: "/other", owner: "two" });
  await waitFor(() => expect(hook.result.current.data).toEqual([]));
  expect(hook.result.current.pageNumber).toBe(1);
  act(() => staleNext());
  act(() => stalePrevious());
  hook.rerender({ path: "/items?sort=price", owner: "one" });
  await waitFor(() => expect(hook.result.current.data).toEqual([1]));
  act(() => hook.result.current.nextPage());
  await waitFor(() => expect(hook.result.current.data).toEqual([2]));
  act(() => {
    window.dispatchEvent(new Event("devmentor-auth-change"));
  });
  await waitFor(() => expect(hook.result.current.data).toEqual([1]));
  expect(hook.result.current.pageNumber).toBe(1);
  act(() => hook.result.current.retry());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  hook.rerender({ path: null, owner: "one" });
  expect(hook.result.current.data).toBeNull();
  expect(hook.result.current.loading).toBe(false);
});

test("pagination hook exposes recoverable errors without losing page history", async () => {
  const fetcher = mockApi({
    "/items": Response.json({ data: [1], nextCursor: "next" }),
    "/items?cursor=next": new Error("offline"),
  });
  const hook = renderHook(() => usePaginatedResource<number>("/items"));
  await waitFor(() => expect(hook.result.current.data).toEqual([1]));
  act(() => hook.result.current.nextPage());
  await waitFor(() => expect(hook.result.current.error).toBe("offline"));
  expect(hook.result.current.nextCursor).toBeNull();
  act(() => hook.result.current.retry());
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  act(() => hook.result.current.previousPage());
  await waitFor(() => expect(hook.result.current.data).toEqual([1]));
});

test("pagination controls disable in-flight and failed navigation and omit a single page", () => {
  const previousPage = vi.fn();
  const nextPage = vi.fn();
  const props = {
    label: "Test",
    pageNumber: 2,
    hasPrevious: true,
    nextCursor: "next",
    loading: false,
    error: "",
    previousPage,
    nextPage,
  };
  const view = render(<Pagination {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Następna strona" }));
  fireEvent.click(screen.getByRole("button", { name: "Poprzednia strona" }));
  expect(nextPage).toHaveBeenCalledOnce();
  expect(previousPage).toHaveBeenCalledOnce();
  view.rerender(<Pagination {...props} loading />);
  expect(
    screen.getByRole("button", { name: "Następna strona" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Poprzednia strona" }),
  ).toBeDisabled();
  view.rerender(<Pagination {...props} error="offline" />);
  expect(
    screen.getByRole("button", { name: "Następna strona" }),
  ).toBeDisabled();
  view.rerender(
    <Pagination {...props} nextCursor={null} hasPrevious={false} />,
  );
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});

test("conversation ownership change clears selected conversation and history cursor", async () => {
  const fetcher = mockApi({
    "/conversations": [
      { id: "first", mentorName: "First" },
      { id: "second", mentorName: "Second" },
    ],
    "/conversations/first/messages": [],
    "/conversations/second/messages": Response.json({
      data: [],
      nextCursor: "old-messages",
    }),
    "/conversations/second/messages?cursor=old-messages": [],
  });
  const view = render(<MessagesPanel user={user} />);
  fireEvent.click(await screen.findByRole("button", { name: /Second/ }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Starsze wiadomości" }),
  );
  await screen.findByRole("button", { name: "Najnowsze wiadomości" });
  view.rerender(<MessagesPanel user={{ ...user, id: "new-owner" }} />);
  await screen.findByRole("button", { name: /First/ });
  await waitFor(() =>
    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/v1/conversations/first/messages",
      expect.any(Object),
    ),
  );
  expect(
    screen.queryByRole("button", { name: "Najnowsze wiadomości" }),
  ).not.toBeInTheDocument();
});
