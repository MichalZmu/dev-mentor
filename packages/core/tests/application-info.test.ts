import { expect, test } from "vitest";
import { applicationInfo } from "../src/index";

test("public application information is immutable", () => {
  expect(applicationInfo.name).toBe("DevMentor");
  expect(applicationInfo.description).toBeTruthy();
  expect(Object.isFrozen(applicationInfo)).toBe(true);
});
