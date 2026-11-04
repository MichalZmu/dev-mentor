import { expect, test } from "vitest";
import { assessAudit } from "../../scripts/check-audit";

const id = "GHSA-g3hv-75wg-m249";
const exception = {
  id,
  owner: "maintainer",
  reason: "upstream API compatibility",
  expires: "2026-11-17",
};
const report = {
  vulnerabilities: {
    minimatch: {
      nodes: ["node_modules/minimatch"],
      via: [{ url: `https://github.com/advisories/${id}` }],
    },
  },
  metadata: { vulnerabilities: { total: 1 } },
};
const lock = { packages: { "node_modules/minimatch": { dev: true } } };
const now = new Date("2026-11-03T00:00:00Z");
test("only the documented dev advisory is accepted", () => {
  expect(assessAudit(report, lock, [exception], now)).toEqual([]);
  expect(assessAudit(report, lock, [], now)).toContain(
    `Unaccepted advisory: ${id}`,
  );
});
test("exceptions never allow runtime dependencies or missing classification", () => {
  expect(
    assessAudit(
      report,
      { packages: { "node_modules/minimatch": { dev: false } } },
      [exception],
      now,
    ),
  ).toContain("Vulnerable runtime or unclassified dependency: minimatch");
  expect(assessAudit(report, { packages: {} }, [exception], now)).toContain(
    "Vulnerable runtime or unclassified dependency: minimatch",
  );
});
test("expired exceptions and absent metadata fail closed", () => {
  expect(
    assessAudit(report, lock, [exception], new Date("2026-11-17T00:00:00Z")),
  ).toContain(`Security exception expired: ${id}`);
  expect(
    assessAudit(report, lock, [{ ...exception, owner: "" }], now),
  ).toContain("Incomplete security exception metadata");
  expect(assessAudit({}, lock, [exception], now)).toContain(
    "Invalid or unavailable npm audit report",
  );
  expect(
    assessAudit(
      { ...report, error: { message: "network failed" } },
      lock,
      [],
      now,
    ),
  ).toContain("Invalid or unavailable npm audit report");
});

test("malformed reports, locks and advisory metadata fail closed", () => {
  for (const value of [
    null,
    [],
    { vulnerabilities: {} },
    { ...report, metadata: {} },
    { ...report, metadata: { vulnerabilities: { total: "1" } } },
  ]) {
    expect(assessAudit(value, lock, [], now)).toContain(
      "Invalid or unavailable npm audit report",
    );
  }
  for (const value of [null, [], {}, { packages: null }])
    expect(assessAudit(report, value, [], now)).toContain(
      "Invalid lockfile metadata",
    );
  for (const value of [
    null,
    {},
    { via: [], nodes: [] },
    { via: [], nodes: "bad" },
    { via: {}, nodes: ["n"] },
  ]) {
    expect(
      assessAudit(
        { ...report, vulnerabilities: { broken: value } },
        lock,
        [],
        now,
      ),
    ).toContain("Missing vulnerability metadata: broken");
  }
  for (const value of [
    { ...exception, id: "CVE-1" },
    { ...exception, reason: " " },
    { ...exception, expires: "tomorrow" },
    { ...exception, expires: "2026-99-99" },
  ]) {
    expect(assessAudit(report, lock, [value], now)).toContain(
      "Incomplete security exception metadata",
    );
  }
  const transitive = { nodes: ["node_modules/minimatch"], via: ["minimatch"] };
  expect(
    assessAudit(
      { ...report, vulnerabilities: { ...report.vulnerabilities, transitive } },
      lock,
      [exception],
      now,
    ),
  ).toEqual([]);
  expect(
    assessAudit({ ...report, vulnerabilities: { transitive } }, lock, [], now),
  ).toContain("Unresolved advisory chain: transitive");
  for (const value of [null, 1, {}, { url: 1 }]) {
    expect(
      assessAudit(
        {
          ...report,
          vulnerabilities: {
            minimatch: { ...report.vulnerabilities.minimatch, via: [value] },
          },
        },
        lock,
        [],
        now,
      ),
    ).toContain("Missing advisory identity: minimatch");
  }
  expect(
    assessAudit(
      {
        ...report,
        vulnerabilities: {
          minimatch: {
            ...report.vulnerabilities.minimatch,
            via: [{ url: "https://example.test/advisory" }],
          },
        },
      },
      lock,
      [],
      now,
    ),
  ).toContain("Unaccepted advisory: minimatch");
  expect(
    assessAudit(
      {
        ...report,
        vulnerabilities: {
          minimatch: { ...report.vulnerabilities.minimatch, nodes: [42] },
        },
      },
      lock,
      [],
      now,
    ),
  ).toContain("Vulnerable runtime or unclassified dependency: minimatch");
});
