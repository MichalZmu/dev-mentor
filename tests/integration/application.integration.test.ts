import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  startTestApplication,
  type TestApplication,
} from "../support/application";

const run = promisify(execFile);
let app: TestApplication | undefined;
const session = "devmentor-ci-" + process.pid;
async function browser(...args: string[]): Promise<string> {
  const result = await run(
    process.execPath,
    [
      resolve("node_modules/agent-browser/bin/agent-browser.js"),
      "--session",
      session,
      ...(process.env.AGENT_BROWSER_CDP
        ? ["--cdp", process.env.AGENT_BROWSER_CDP]
        : []),
      ...args,
    ],
    { timeout: 60_000 },
  );
  return result.stdout;
}
beforeAll(async () => {
  app = await startTestApplication();
});
afterAll(async () => {
  try {
    await browser("close");
  } finally {
    await app?.stop();
  }
});
test("production API reads the disposable PostgreSQL and enforces authentication", async () => {
  if (!app) throw new Error("Test application setup failed");
  const catalog = await fetch(app.url + "/api/v1/mentors");
  expect(catalog.status).toBe(200);
  const body: unknown = await catalog.json();
  expect(body).toMatchObject({
    data: [
      expect.objectContaining({ id: "demo-mentor", name: "Anna Kowalska" }),
    ],
  });
  const privatePage = await fetch(app.url + "/api/v1/me");
  expect(privatePage.status).toBe(401);
});
test("agent-browser renders a database-backed mentor and opens the profile", async () => {
  if (!app) throw new Error("Test application setup failed");
  await mkdir("test-results", { recursive: true });
  try {
    await browser("open", app.url + "/mentors");
    await browser("wait", "--text", "Anna Kowalska");
    const snapshot = await browser("snapshot", "-i");
    expect(snapshot).toContain("Anna Kowalska");
    await writeFile("test-results/agent-browser-catalog.txt", snapshot);
    await browser(
      "find",
      "role",
      "link",
      "click",
      "--name",
      "Anna Kowalska",
      "--exact",
    );
    await browser("wait", "--url", "**/mentors/demo-mentor");
    await browser("wait", "--text", "Frontend z dobrym planem rozwoju");
    expect(await browser("get", "url")).toContain("/mentors/demo-mentor");
    await browser("screenshot", "test-results/agent-browser-profile.png");
  } catch (error) {
    await browser("screenshot", "test-results/agent-browser-failure.png").catch(
      () => undefined,
    );
    throw error;
  }
});
