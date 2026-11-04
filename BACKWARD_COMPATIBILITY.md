# Backward compatibility

## Protected surfaces

DevMentor is a private npm workspace application. Public package exports are
contracts between workspace consumers, not a promise of published npm releases.
Inventory and update actual consumers when changing these surfaces.

| Surface and source                                                                                            | Breaking changes                                                                                                          | Required change path                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP API: `packages/app/app/api/v1/[...path]/route.ts`, `packages/app/server/api.ts`, `docs/api/openapi.json` | Removed routes/fields, changed error codes, status codes, pagination, date/money formats, required inputs or access rules | Update OpenAPI and clients together, add contract and denied-path tests; preserve the current API or introduce an explicit version/migration path before incompatible rollout.                                            |
| Authentication: `packages/app/app/api/auth/[...all]/route.ts` and server auth adapters                        | Changed session/cookie semantics, login/MFA/reset behavior or account permissions                                         | Specify the transition, update affected UI, test real authentication and session invalidation; independent review is required.                                                                                            |
| Package APIs: `exports` in core/db/ui manifests and their exported declarations                               | Removed/renamed exports, incompatible inputs/results, leaked internal/server dependencies                                 | Update all workspace consumers and unit tests in the same change, run deps:check/typecheck/build; preserve package direction and server/client boundaries.                                                                |
| PostgreSQL: `packages/db/src`, registered entity schemas and versioned migrations                             | Dropped/renamed data, stricter constraints, incompatible stored states or currency/time representations                   | Add a new versioned MikroORM migration; do not rewrite applied migrations. Test fresh-install and existing-data upgrades on isolated PostgreSQL; document backup, rollout and safe rollback/forward repair.               |
| Payments and async integrations: core ports, payment adapters and inbox/outbox                                | Changed provider-event mapping, idempotency keys, retry/ack semantics, money snapshots or job payloads                    | Support in-flight persisted work through the transition, test duplicate/late events and retries, reconcile financial invariants and document recovery. Real provider validation must be distinguished from demo evidence. |
| Configuration and CLI: root `package.json`, `.env.example`, db/app CLI entry points and operations runbook    | Changed env names, required values, script flags, exit behavior or supported toolchain                                    | Update examples, manifests, root lockfile and runbook; explain transition/defaults without committing secrets; verify relevant CLI entry points.                                                                          |
| Agent pipeline: `.ai/agentic.config.json`, installed tracker/browser descriptors, SDLC and journal format     | Removed/renamed config keys, paths or operations, weaker gates, incompatible journal/spec layout                          | Keep config and SDLC consistent, preserve existing custom settings on reconfiguration, verify referenced operations and skill coverage; do not bypass AGENTS rules.                                                       |

## Review and rollout

The specification and PR identify affected consumers, intended compatibility,
migration order, verification and recovery. A maintainer must explicitly approve
a deliberate contract break before integration. For workspace-only changes,
coordinate all consumers in one verified PR; external clients require a stated
versioning/deprecation plan rather than an assumed transition period.
Tests must cover old persisted data and in-flight work where relevant.

Security fixes can tighten access, but must document the intended denial and
exercise valid, unauthorized and wrong-scope paths. Never preserve a data leak
for compatibility. Review migration rollback safety separately from code rollback;
avoid destructive down migrations as a routine recovery strategy.

Keep documentation grounded in current exports, handlers and storage. The
separate `docs/mentoring-concept/` prototype describes design intent and cannot
replace implementation evidence or the current OpenAPI contract.
