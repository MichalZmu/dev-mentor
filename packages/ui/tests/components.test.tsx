import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Button, buttonVariants, cn } from "../src";
import { Card, CardTitle } from "../src/components/card";
import { Input } from "../src/components/input";
import { Textarea } from "../src/components/textarea";

test("shared controls retain semantics, variants, props and disabled behavior", () => {
  const click = vi.fn();
  render(
    <Card className="custom-card">
      <CardTitle className="custom-title">Title</CardTitle>
      <Button onClick={click}>Action</Button>
      <Button disabled>Disabled</Button>
      <Button asChild variant="outline" size="sm">
        <a href="/target">Link</a>
      </Button>
      <Input aria-label="Name" defaultValue="Anna" className="custom-input" />
      <Textarea aria-label="Note" defaultValue="Note" className="custom-note" />
    </Card>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Action" }));
  expect(click).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
  expect(screen.getByRole("link", { name: "Link" })).toHaveAttribute(
    "href",
    "/target",
  );
  expect(screen.getByRole("heading", { name: "Title" })).toHaveClass(
    "custom-title",
  );
  expect(screen.getByLabelText("Name")).toHaveValue("Anna");
  expect(screen.getByLabelText("Note")).toHaveValue("Note");
  expect(buttonVariants({ variant: "destructive", size: "icon" })).toContain(
    "bg-destructive",
  );
  expect(cn("px-1", "px-2")).toBe("px-2");
});
