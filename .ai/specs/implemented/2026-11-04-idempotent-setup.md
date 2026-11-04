# Idempotent local demo setup

Issue: https://github.com/MichalZmu/dev-mentor/issues/1
Created: 2026-11-04

## Goal and scope
Provide root npm run setup on a clean checkout without tsx. Reuse npm ci,
db:up, db:check, migrate and seed:demo. Preserve existing configuration and data.
No system tool installation, production setup, data reset, web/worker startup or CI execution.

## Acceptance
- Exact pinned Node/npm; built-in-only bootstrap before dependency installation.
- Install missing/stale/incomplete dependencies; verify graph and entry points.
- Copy only a missing root .env; process variables win; reject invalid/nonlocal/demo-incompatible configuration safely.
- Wait for PostgreSQL, check connection, apply pending auth/domain migrations on every run.
- Seed completion belongs to the target database, is atomic with domain data and locked.
- Preserve accounts/passwords and existing roles/goals; resume partial failures.
- Show stage status, safe remediation and nonzero failure; print web/worker commands.
- Document automatic and manual paths. Cover all changed code at 100% per file.
- Verify fresh setup, repeat, changed data, restart, failure/retry, new database and migration upgrade on isolated PostgreSQL.

## Plan and dependencies
1. Add built-in Node bootstrap and package script.
2. Add versioned seed-state migration and entity registration, transactional seed and CLI result.
3. Unit regressions, then isolated PostgreSQL/CLI integration including a fresh dependency-free checkout.
4. Update README/runbook and lessons; run every configured validation command in order and inspect diff.

## Risks and recovery
Preserve separate auth/migration URLs and env precedence. Never print child error output or credentials.
Raw seed SQL must carry the transaction context. A legacy/partial seed has no marker:
recover insert-only and keep existing user data. Auth identities can commit before domain failure;
retry reuses them. Existing commands remain available; no destructive rollback in setup.

## Verification update
The existing read-only-CWD migration integration asserted exactly four applied migrations.
The added seed-state migration correctly makes five; update that test to assert the exact
five names for both programmatic and CLI migration paths. No production scope change.

## Validation before review
All acceptance criteria and the full ordered validation gate passed after authorized
gate remediation. Unit coverage434/434, integration55/55, E2E6/6, build, format/lint,
typecheck, dependency checks, both browser installers and security audit passed.
Evidence: ../../runs/evidence/2026-11-04-idempotent-setup-verification.md

## Authorized gate remediation — 2026-11-04
The user authorized repairing the two remaining blockers and resuming PR publication.
- Exclude only the installed .agents/skills distribution from application Prettier/ESLint checks.
  It contains intentionally unexpanded templates such as {{SLUG_JSON}}; do not edit vendor files.
- Install browser system prerequisites with the WSL root entry point because sudo requires
  interactive authentication. Do not change sudoers or store credentials.
- Repeat every configured gate command in order, running only prerequisite installers
  with elevated system privileges and all application checks as the normal workspace user.
- Verify actual browsers without temporary LD_LIBRARY_PATH workarounds, inspect diff,
  finalize artifacts and continue om-open-pr once the new result is ready.

## Review remediation — 2026-11-04
The user approved fixing both findings on PR #2.
1. Add a regression with a runtime entry point and an internal module missing while
   package manifests and npm ls remain valid.
2. Verify CLI dependencies by importing their modules in a bounded child Node process
   using react-server and tsx, before marking an installation reusable and after npm ci.
   Import only dependency/server modules without calling auth/DB initializers or CLI entry points.
3. On failure, reinstall once through the existing npm ci branch and recheck; if still
   broken, fail safely in the dependencies stage without touching PostgreSQL.
4. Add real PostgreSQL rollback/up evidence for Migration202611040001 with existing
   data preserved and a safe subsequent seed.
5. Re-run full ordered gate, inspect diff and push the fixes to the same PR.
The specification is active again until these acceptance criteria are verified.

Validation adjustment: the installed MikroORM IMigrator has no getExecutedMigrations API.
The downgrade test reads the actual mikro_orm_migrations table using the same SQL
pattern as the existing read-only-CWD integration test.


## Current result after review fixes
Both review findings are addressed. The runtime probe and its failure/reinstall
paths have unit regressions proven to fail before the fix; real setup tests repair
missing dotenv/pg modules even though npm ls succeeds. Real PostgreSQL down/up
preserves existing user/booking/payment data and supports safe reseeding.
The full ordered gate passed: 438 unit tests and required coverage, 56 integration
tests, six E2E tests, format/lint/type/dependency checks, build, browser installers
and security audit. No checks skipped.
Evidence: ../../runs/evidence/2026-11-04-idempotent-setup-review-fixes.md
