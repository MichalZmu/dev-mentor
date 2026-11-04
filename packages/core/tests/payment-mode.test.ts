import { expect, test } from "vitest";
import { assertPaymentMode } from "../src/policies";
test("checkout funding locks on the first accepted request, independently of idempotency key", () => {
  assertPaymentMode(null, "psp");
  assertPaymentMode(null, "credit");
  assertPaymentMode("psp", "psp");
  assertPaymentMode("credit", "credit");
  expect(() => assertPaymentMode("psp", "credit")).toThrow(
    "PAYMENT_MODE_LOCKED",
  );
  expect(() => assertPaymentMode("credit", "psp")).toThrow(
    "PAYMENT_MODE_LOCKED",
  );
  expect(() => assertPaymentMode(null, "other")).toThrow(
    "INVALID_PAYMENT_MODE",
  );
});
