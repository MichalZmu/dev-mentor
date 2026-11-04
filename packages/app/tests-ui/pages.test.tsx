import { render, screen, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import Home from "../app/page";
import RootLayout, { metadata } from "../app/layout";
import Loading from "../app/loading";
import NotFound from "../app/not-found";
import ErrorPage from "../app/error";
import AdminPage from "../app/admin/page";
import AuthPage from "../app/auth/page";
import CheckoutPage from "../app/checkout/page";
import DashboardPage from "../app/dashboard/page";
import MentorPage from "../app/mentor/page";
import MentorsPage from "../app/mentors/page";
import ProfilePage from "../app/mentors/[id]/page";
import RoomPage from "../app/room/[id]/page";
import { mockApi } from "./fixtures";
import type * as Shared from "../components/shared";

vi.mock("../components/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof Shared>()),
  AccountNav: () => <nav>Account</nav>,
}));
vi.mock("../components/admin-workspace", () => ({
  AdminWorkspace: () => <div>Admin workspace</div>,
}));
vi.mock("../components/auth-form", () => ({
  AuthForm: () => <div>Auth form</div>,
}));
vi.mock("../components/checkout-status", () => ({
  CheckoutStatus: () => <div>Checkout status</div>,
}));
vi.mock("../components/dashboard", () => ({
  Dashboard: () => <div>Dashboard workspace</div>,
}));
vi.mock("../components/mentor-workspace", () => ({
  MentorWorkspace: () => <div>Mentor workspace</div>,
}));
vi.mock("../components/catalog", () => ({
  Catalog: () => <div>Mentor catalog</div>,
}));
vi.mock("../components/mentor-profile", () => ({
  MentorProfile: ({ id }: { id: string }) => <div>Profile {id}</div>,
}));
vi.mock("../components/session-room", () => ({
  SessionRoom: ({ id }: { id: string }) => <div>Room {id}</div>,
}));

test("home exposes product paths and mentor entry points", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Twój kolejny",
  );
  expect(
    screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/mentors?q=")),
  ).toHaveLength(3);
});
test("layout includes metadata, language, skip link and footer navigation", () => {
  const html = renderToStaticMarkup(
    <RootLayout>
      <main id="main">Child content</main>
    </RootLayout>,
  );
  expect(html).toContain('lang="pl"');
  expect(html).toContain('href="#main"');
  expect(html).toContain("Child content");
  expect(metadata.title).toMatchObject({ template: "%s | DevMentor" });
});
test("loading, not-found and error pages provide useful recovery actions", () => {
  const view = render(<Loading />);
  expect(screen.getByRole("status")).toHaveTextContent("Przygotowujemy");
  view.rerender(<NotFound />);
  expect(screen.getByRole("link", { name: "Znajdź mentora" })).toHaveAttribute(
    "href",
    "/mentors",
  );
  const reset = vi.fn();
  view.rerender(
    <ErrorPage error={new Error("Private message")} reset={reset} />,
  );
  expect(screen.getByRole("alert")).not.toHaveTextContent("Private message");
  fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
  expect(reset).toHaveBeenCalledOnce();
});
test.each([
  { Page: AdminPage, text: "Admin workspace" },
  { Page: AuthPage, text: "Auth form" },
  { Page: CheckoutPage, text: "Checkout status" },
  { Page: DashboardPage, text: "Dashboard workspace" },
  { Page: MentorPage, text: "Mentor workspace" },
  { Page: MentorsPage, text: "Mentor catalog" },
])("route composes its view: $text", ({ Page, text }) => {
  mockApi();
  render(<Page />);
  expect(screen.getByText(text)).toBeVisible();
});
// Next recommends E2E for async Server Components. These unit checks test only
// parameter forwarding by awaiting the inner element; production rendering is E2E.
test.each([
  { Page: ProfilePage, text: "Profile item-1" },
  { Page: RoomPage, text: "Room item-1" },
])(
  "dynamic route forwards promised parameters: $text",
  async ({ Page, text }) => {
    const tree = Page({ params: Promise.resolve({ id: "item-1" }) });
    const children = tree.props as { children: ReactElement[] };
    const suspense = children.children.at(-1);
    if (!suspense) throw new Error("Missing suspense");
    const inner = (
      suspense.props as {
        children: ReactElement<{ params: Promise<{ id: string }> }>;
      }
    ).children;
    const renderContent = inner.type as (props: {
      params: Promise<{ id: string }>;
    }) => Promise<ReactElement>;
    render(await renderContent(inner.props));
    expect(screen.getByText(text)).toBeVisible();
  },
);
