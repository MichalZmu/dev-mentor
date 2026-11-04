import { startTestApplication } from "./application";

const port = Number(process.argv[2] ?? "3200");
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Use a TCP port between 1024 and 65535.");
// Signals received during migrations are remembered and cleaned up once startup completes.
let interrupted = false;
let stop: (() => Promise<void>) | undefined;
const shutdown = (): void => {
  interrupted = true;
  if (stop)
    void stop().then(() => {
      process.exitCode = 0;
    });
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
try {
  const app = await startTestApplication(port);
  stop = app.stop;
  if (interrupted) await app.stop();
  else
    console.log(
      `Disposable DevMentor: ${app.url} (Ctrl+C stops the app and PostgreSQL)`,
    );
} catch {
  console.error(
    "Disposable DevMentor startup failed. Verify Docker, migrations and npm run build.",
  );
  process.exitCode = 1;
}
