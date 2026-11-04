import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import {
  AccountNav,
  Badge,
  Feedback,
  Field,
  LoadState,
  Status,
  TextField,
} from "../components/shared";
import { mockApi, user } from "./fixtures";

test("fields expose optional constraints, hints and feedback states accessibly", () => {
  render(
    <>
      <Field label="Hinted" hint="Explanation">
        <input />
      </Field>
      <TextField label="Basic" name="basic" />
      <TextField
        label="Constrained"
        name="full"
        defaultValue="12"
        minLength={1}
        maxLength={3}
        min="1"
        max="20"
        placeholder="Number"
        required={false}
        type="number"
      />
      <Feedback busy error="Failure" notice="Saved" />
      <Badge>Badge</Badge>
      <Status value="confirmed" />
      <Status value="new-status" />
    </>,
  );
  expect(screen.getByText("Explanation")).toBeVisible();
  expect(screen.getByLabelText("Constrained")).toHaveValue(12);
  expect(screen.getByRole("alert")).toHaveTextContent("Failure");
  expect(screen.getAllByRole("status")).toHaveLength(2);
  expect(screen.getByText("new-status")).toBeVisible();
});
test("load state prioritizes loading and error, supports retry and empty results", () => {
  const retry = vi.fn();
  const view = render(
    <LoadState loading error="Error" retry={retry}>
      Content
    </LoadState>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Wczytywanie");
  view.rerender(
    <LoadState loading={false} error="Error" retry={retry}>
      Content
    </LoadState>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
  expect(retry).toHaveBeenCalledOnce();
  view.rerender(
    <LoadState loading={false} error="" retry={retry} empty>
      Content
    </LoadState>,
  );
  expect(screen.getByText(/Nie ma jeszcze danych/)).toBeVisible();
  view.rerender(
    <LoadState loading={false} error="" retry={retry}>
      Content
    </LoadState>,
  );
  expect(screen.getByText("Content")).toBeVisible();
});
test("account navigation reflects authentication, demo mode and auth change events", async () => {
  const fetcher = mockApi({ "/me": user, "/config": { mode: "demo" } });
  render(<AccountNav />);
  expect(
    await screen.findByRole("link", { name: "Mój panel" }),
  ).toHaveAttribute("href", "/dashboard");
  expect(screen.getByText("Demo")).toBeVisible();
  window.dispatchEvent(new Event("devmentor-auth-change"));
  expect(fetcher).toHaveBeenCalled();
});
test("anonymous navigation offers sign in", async () => {
  mockApi({ "/me": null, "/config": { mode: "production" } });
  render(<AccountNav />);
  expect(
    await screen.findByRole("link", { name: "Zaloguj się" }),
  ).toBeVisible();
});
