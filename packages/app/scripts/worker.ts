import { config } from "dotenv";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { database } from "@devmentor/db";
import { runWorkerOnce } from "../server/worker";
import { closeAuthRuntime } from "../server/auth";
import { logEvent } from "../server/log";
config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
try {
  do {
    try {
      const result = await runWorkerOnce();
      logEvent(
        "info",
        "worker.tick",
        "worker",
        "PROCESSED_" + result.processed + "_FAILED_" + result.failed,
      );
    } catch {
      logEvent("error", "worker.tick", "worker", "WORKER_UNAVAILABLE");
      if (process.argv.includes("--once")) process.exitCode = 1;
    }
    if (process.argv.includes("--once")) break;
    await setTimeout(1000);
  } while (!stopped);
} finally {
  await closeAuthRuntime();
  await database.close();
}
