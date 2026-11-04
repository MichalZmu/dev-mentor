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

## Current result
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
