# Code review

## Priorities and evidence

Review correctness, authorization and isolation first, then durable data and
payment behavior, compatibility, tests and maintainability. Read
[AGENTS.md](AGENTS.md), [SDLC.md](SDLC.md) and
[BACKWARD_COMPATIBILITY.md](BACKWARD_COMPATIBILITY.md). Findings name a concrete
trigger, consequence, file location and required correction; distinguish
observed failures from untested assumptions.

## DevMentor checks

- Preserve `app → core/db/ui` and `db → core`; core is independent, and ui
  imports no other project package, even for types. Use public exports.
  New use cases belong in core; UI receives data and callbacks through props.
- Read the installed Next.js guide under `node_modules/next/dist/docs/`
  before changing framework code. Keep DB, secrets and Awilix server-side,
  import containers through `packages/app/server/services.ts`, inject services
  explicitly, and isolate EntityManager/request state.
- Validate external `unknown` inputs at runtime. Check authenticated role,
  ownership and participant scope at each endpoint, including denied and
  cross-user paths. Preserve demo loopback and APP_MODE boundaries.
- Review booking overlap constraints, hold expiry, concurrent updates,
  idempotency, immutable money snapshots and inbox/outbox retry behavior.
  Test real PostgreSQL races; an availability read cannot replace SQL protection.
- Use versioned MikroORM migrations with explicit schema registration.
  Exercise fresh databases and upgrades with existing data. Document safe
  recovery; do not run destructive tests against a developer database.
- Preserve strict TypeScript, explicit public return types, handled promises,
  type-only imports and package boundaries. Local lint exceptions need reasons.
- Changed and new functions require 100% lines, branches, functions and
  statements per implementation file. Do not ignore files or lower thresholds.
  Server Vitest uses the real `server-only` boundary with `react-server`;
  React component tests run separately in jsdom.
- UI changes require a running-app check: keyboard, mobile, loading, empty,
  errors, permission denial and long content. Use shared ui/shadcn components.
  Real E2E assertions must prove persisted results, not only draft inputs.
- Logs contain UTC, requestId, operation and safe codes. Exclude credentials,
  SQL/driver errors and private user data. Security checks block runtime
  vulnerabilities and new tooling advisories; dev exceptions are specific,
  owned, justified and unexpired in `security-exceptions.json`.
- CI uses pinned action SHAs, minimal permissions and no deployment secrets for
  untrusted PRs. Require independent review and `ci-required` on the host.
  A workflow file alone does not enforce branch protection.
- Follow the task's SDD acceptance criteria, append its journal entry before
  every commit, and record reusable lessons when needed. Architecture changes
  update README and AGENTS along with manifests and exports.

## Validation and decision

Run the ordered `validation.commands` in
[.ai/agentic.config.json](.ai/agentic.config.json); [SDLC.md](SDLC.md) records
their prerequisites. Missing infrastructure is a failed gate, not a skipped pass.
Report checks not run and relevant coverage limits. Review both code and
validation failures in one pass.

- **Blocker:** exploitable authorization/data leak, lost or corrupt money/data,
  broken protected contract without a coordinated path, failed mandatory gate,
  or a bypass of required protection. Request changes.
- **Major:** reproducible functional defect or missing required regression
  evidence that can affect users. Request changes.
- **Minor:** bounded maintainability or presentation issue; explain its impact.
  Avoid speculative findings or stylistic preferences already settled by tools.

Use one pipeline label, one priority and one risk label, with categories/meta
as described in SDLC. Auth, money, migrations, isolation and shared-contract
changes infer high risk. Pin QA evidence to the tested head; never grant
`qa-approved` merely because review or CI passed.
