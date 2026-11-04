# Installer verification — 2026-11-04

Issue: https://github.com/MichalZmu/dev-mentor/issues/1
Branch: codex/idempotent-setup
Current result: implementation and full ordered release gate PASS after authorized remediation. Initial blocked-run evidence is retained below.

## Behavior verified
- Fresh temporary checkout has no node_modules: root npm run setup installs dependencies and prepares a new Compose PostgreSQL.
- Second invocation verifies/skips dependencies, preserves .env, skips completed seed and retains changed goals/roles/password hashes and row counts.
- PostgreSQL stop followed by setup restarts it without data loss.
- A separate database with migrations 001–004 upgrades through Migration202611040001.
- A synthetic trigger failure rolls back domain changes and completion marker; auth identities remain reusable with unchanged password hashes.
- Retry completes the failed database; legacy records without a completion marker retain edited goals/roles.
- Missing tsx entry point is repaired even when the dependency fingerprint matches.
- Unit regression uses a later calendar date and proves completed seed never regenerates availability.
- Bootstrap invokes npm using Node and npm_execpath with no shell, bash/cp or global tsx dependency.
- Static review: existing CLI commands and separate auth/migration URL precedence remain; SQL uses the transactional EntityManager context.

## Initial validation (before authorized remediation)
Commands were attempted in the configured order; later targeted reruns are noted.

| Command | Result |
| --- | --- |
| npm run format:check | FAIL (exit 2): existing formatting/template syntax errors in unchanged .agents/skills. |
| npm run lint | FAIL (exit 1): unchanged skill scripts; eight warnings and comments.js template parse error. |
| npm run typecheck | PASS, including rerun after final source changes. |
| npm run deps:check | PASS. |
| npm run test:coverage | PASS: 43 files, 434 unit tests; changed production files meet 100% lines/branches/functions/statements. Repeated after final source changes. |
| npm run build | PASS. |
| npm run test:browser:install | Attempted; hung at sudo. Own sudo/installer processes terminated. Wrapper exited 0, which does not prove system-library installation completed. |
| npm run test:integration | Initial 54/55: an existing test expected four applied migrations. Updated it to the exact five names. Targeted 30/30 passed; final full rerun 55/55 across eight files passed. |
| npx --no-install playwright install --with-deps chromium | Interrupted while waiting on sudo; exit 1. |
| npm run test:e2e | PASS: 6/6, desktop/mobile. |
| npm run security:check | PASS: runtime clean; existing unexpired development exceptions only. |

Changed TypeScript files/package.json: targeted Prettier PASS.
Changed TypeScript files: targeted ESLint PASS.
git diff --check: PASS.
Browser integration/E2E used existing Chromium and /tmp/devmentor-chrome-libs,
with AGENT_BROWSER_EXECUTABLE_PATH and LD_LIBRARY_PATH per the existing lessons.
No command in the gate was skipped. System dependency installation remains unverified.
All destructive database scenarios operated only on disposable test databases/Compose volumes.
Windows execution was checked by the shell-free invocation design and unit assertions, not on a Windows-hosted Node runtime.

## Initial blockers (resolved by the reverification below)
Fix baseline installed-skill formatting/lint through a separately scoped change and complete
browser prerequisite installation with suitable system permissions; rerun the full ordered gate.
The spec remains active and the journal in-progress because its full-gate acceptance criterion is unmet.


## Final reverification — 2026-11-04

All 11 configured commands passed in order; none skipped. The two browser installers
ran through WSL root to provision system packages; all application checks ran as zmudam.
sudoers and authentication policy were not changed. Browser cache ownership was restored
to zmudam. No temporary LD_LIBRARY_PATH or AGENT_BROWSER_EXECUTABLE_PATH overrides were used.

| Command | Result | Execution identity |
| --- | --- | --- |
| npm run format:check | PASS | zmudam |
| npm run lint | PASS | zmudam |
| npm run typecheck | PASS | zmudam |
| npm run deps:check | PASS | zmudam |
| npm run test:coverage | PASS | zmudam |
| npm run build | PASS | zmudam |
| npm run test:browser:install | PASS | root (browser prerequisites only) |
| npm run test:integration | PASS | zmudam |
| npx --no-install playwright install --with-deps chromium | PASS | root (browser prerequisites only) |
| npm run test:e2e | PASS | zmudam |
| npm run security:check | PASS | zmudam |

Results: 434 unit tests across 43 files with required 100% per-file coverage;
55 integration tests across eight files; six E2E tests on desktop/mobile.
Fresh installer and partial-failure scenarios again ran on disposable Compose/PostgreSQL only.
agent-browser default Chrome opened the real application and profile; ldd showed
no unresolved libraries for Playwright Chromium without a temporary library path.
Prettier/ESLint API assertions confirmed only installed skill templates are ignored,
and project tooling remains checked with the strict Promise/type rules.
git diff --check passed. CI and human review/QA are separate subsequent PR signals.
