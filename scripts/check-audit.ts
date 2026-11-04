import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Exception {
  id: string;
  owner: string;
  reason: string;
  expires: string;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Only explicitly listed, unexpired, development-only advisories may be accepted. */
export function assessAudit(
  audit: unknown,
  lock: unknown,
  exceptions: readonly Exception[],
  now: Date,
): string[] {
  const errors: string[] = [];
  if (
    !record(audit) ||
    audit.error ||
    !record(audit.vulnerabilities) ||
    !record(audit.metadata) ||
    !record(audit.metadata.vulnerabilities) ||
    typeof audit.metadata.vulnerabilities.total !== "number"
  )
    return ["Invalid or unavailable npm audit report"];
  if (!record(lock) || !record(lock.packages))
    return ["Invalid lockfile metadata"];
  const packages = lock.packages;
  const accepted = new Map<string, Exception>();
  for (const exception of exceptions) {
    if (
      !/^GHSA-[a-z0-9-]+$/.test(exception.id) ||
      !exception.owner.trim() ||
      !exception.reason.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(exception.expires) ||
      !Number.isFinite(Date.parse(exception.expires + "T00:00:00Z"))
    ) {
      errors.push("Incomplete security exception metadata");
      continue;
    }
    if (now >= new Date(exception.expires + "T00:00:00Z"))
      errors.push(`Security exception expired: ${exception.id}`);
    accepted.set(exception.id, exception);
  }
  for (const [name, value] of Object.entries(audit.vulnerabilities)) {
    if (
      !record(value) ||
      !Array.isArray(value.via) ||
      !Array.isArray(value.nodes) ||
      value.nodes.length === 0
    ) {
      errors.push(`Missing vulnerability metadata: ${name}`);
      continue;
    }
    const devOnly = value.nodes.every(
      (node: unknown) =>
        typeof node === "string" &&
        record(packages[node]) &&
        packages[node].dev === true,
    );
    if (!devOnly)
      errors.push(`Vulnerable runtime or unclassified dependency: ${name}`);
    for (const via of value.via) {
      if (typeof via === "string") {
        if (!Object.hasOwn(audit.vulnerabilities, via))
          errors.push(`Unresolved advisory chain: ${name}`);
      } else if (record(via) && typeof via.url === "string") {
        const match =
          /^https:\/\/github\.com\/advisories\/(GHSA-[a-z0-9-]+)$/.exec(
            via.url,
          );
        const id = match?.[1];
        if (!id || !accepted.has(id))
          errors.push(`Unaccepted advisory: ${id ?? name}`);
      } else errors.push(`Missing advisory identity: ${name}`);
    }
  }
  return errors;
}
function audit(omitDev: boolean): unknown {
  const result = spawnSync(
    "npm",
    ["audit", "--json", ...(omitDev ? ["--omit=dev"] : [])],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.error || (result.status !== 0 && result.status !== 1))
    throw new Error("npm audit could not complete");
  try {
    return JSON.parse(result.stdout) as unknown;
  } catch {
    throw new Error("npm audit returned invalid JSON");
  }
}
export function checkAudit(): void {
  const lock: unknown = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const exceptions = JSON.parse(
    readFileSync("security-exceptions.json", "utf8"),
  ) as Exception[];
  const runtime = audit(true);
  const full = audit(false);
  const errors = [
    ...assessAudit(runtime, lock, [], new Date()),
    ...assessAudit(full, lock, exceptions, new Date()),
  ];
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
  else
    console.log(
      "Audit passed: runtime clean; only documented, unexpired development exceptions.",
    );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    checkAudit();
  } catch {
    console.error("Security check failed: audit or metadata unavailable.");
    process.exitCode = 1;
  }
}
