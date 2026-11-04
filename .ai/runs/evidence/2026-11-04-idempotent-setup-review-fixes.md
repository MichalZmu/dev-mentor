# PR #2 — review fixes, 2026-11-04

Reviewed head: e9abff5b6a44d0197b5b45aba928bb09577d2b87
Scope: both findings from the user-requested om-code-review; no new migration SQL.

## Dependency completeness
The isolated review fixture demonstrated npm ls=0 after deleting a runtime module,
while setup repeatedly skipped npm ci and failed later. Three new unit regression
cases failed before the fix. After the fix all 31 setup unit tests passed.

A bounded child Node process imports dotenv, the public DB entry, BetterAuth
crypto/migration modules and the application auth module with react-server/tsx.
It does not call auth/DB initializers or CLI entry points, so it cannot migrate or seed.
A cached install is reusable only after the probe; failure enters the single existing
npm ci path and rechecks. A failed post-install probe exits safely at dependencies.

The real fresh-checkout/Compose integration deletes tsx/dist/cli.mjs,
dotenv/lib/main.js and pg/lib/client.js with package metadata intact. Each case
first confirms npm ls succeeds, then verifies automatic repair, skipped completed
seed and preserved account hashes.

## Migration evidence
A separate disposable PostgreSQL integration starts from migrations 001–004 with
an edited legacy user, applies the seed marker migration and seeds data. It performs
the actual down operation, verifies marker-table removal and four retained migration
history entries, and compares users/bookings/payments. After reapplying up, it
verifies successful seeding, idempotent repeat and unchanged existing data.

The first test draft used getExecutedMigrations, which the installed IMigrator does
not provide. The test now reads the real migration history table using the existing
repository SQL pattern; its targeted execution passed.

## Validation history
The first browser installer attempt stalled on temporary Ubuntu DNS resolution
failure and hit its timeout. DNS recovered without persistent network configuration
changes; the retry succeeded. Integration is repeated after that completed
prerequisite to retain the configured ordering.

Final ordered gate: PASS after the DNS retry. All 11 commands ran successfully;
none skipped. Browser installers ran as WSL root; application checks ran as zmudam.


## Final validation

| Command | Result |
| --- | --- |
| npm run format:check | PASS |
| npm run lint | PASS |
| npm run typecheck | PASS |
| npm run deps:check | PASS |
| npm run test:coverage | PASS |
| npm run build | PASS |
| npm run test:browser:install | PASS |
| npm run test:integration | PASS |
| npx --no-install playwright install --with-deps chromium | PASS |
| npm run test:e2e | PASS |
| npm run security:check | PASS |

438 unit tests across 43 files passed with 100% lines, branches, functions and
statements for scripts/setup.ts and the unchanged per-file thresholds.
Full integration passed 56 tests across nine files, including both runtime
entry/internal-module corruption cases and actual migration down/up. All six
desktop/mobile E2E tests and security audit passed.

The application checks used no LD_LIBRARY_PATH or AGENT_BROWSER_EXECUTABLE_PATH
workaround. The first installer timeout and the corrected initial test API
assumption are retained above; both were resolved before the final gate.
Static review confirmed a single bounded reinstall path, module-only imports
without CLI side effects, and no schema/public-contract changes. git diff --check passed.
