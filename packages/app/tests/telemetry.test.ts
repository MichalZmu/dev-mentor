import { afterEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  sdk: vi.fn(),
  exporter: vi.fn(),
  start: vi.fn(),
  shutdown: vi.fn(),
}));
vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: class {
    constructor(input: unknown) {
      mocks.sdk(input);
    }
    start = mocks.start;
    shutdown = mocks.shutdown;
  },
}));
vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: class {
    constructor(input: unknown) {
      mocks.exporter(input);
    }
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
test("telemetry is opt-in, validates endpoint and starts/shuts down once", async () => {
  vi.resetModules();
  const { startTelemetry } = await import("../server/telemetry");
  vi.stubEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", undefined);
  await startTelemetry();
  expect(mocks.sdk).not.toHaveBeenCalled();
  vi.stubEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "file:///private");
  await expect(startTelemetry()).rejects.toThrow("Invalid telemetry endpoint");
  const once = vi.spyOn(process, "once").mockImplementation(() => process);
  vi.stubEnv(
    "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
    "https://collector.example/traces",
  );
  await startTelemetry();
  await startTelemetry();
  expect(mocks.start).toHaveBeenCalledOnce();
  expect(mocks.exporter).toHaveBeenCalledWith({
    url: "https://collector.example/traces",
  });
  const callback = once.mock.calls[0]?.[1] as () => void;
  callback();
  expect(mocks.shutdown).toHaveBeenCalledOnce();
});
