import "server-only";
let started = false;
export async function startTelemetry(): Promise<void> {
  if (started || !process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) return;
  const url = new URL(process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Invalid telemetry endpoint");
  const [{ NodeSDK }, { OTLPTraceExporter }] = await Promise.all([
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/exporter-trace-otlp-http"),
  ]);
  const sdk = new NodeSDK({
    serviceName: "devmentor",
    traceExporter: new OTLPTraceExporter({ url: url.href }),
  });
  sdk.start();
  started = true;
  process.once("SIGTERM", () => {
    void sdk.shutdown();
  });
}
