# Independent product review — R1, findings for R2

Role: delivery_reviewer (/root/review_product). Process: whirly-agentic-sdlc 0.2.3, source_commit a46384578da42a90414e55b0d7165e27390d3a67.
Inputs: AGENTS/CLAUDE/lessons; `.ai/specs/2026-11-03-engineering-standards.md` AC-S1–S7/P1–P8; public API, core policies/service/ports, the complete named SQL repository, versioned migrations, auth/payment/worker implementations, UI consumers and deployment documentation.

Initial reviewed source state: HEAD 3fed950619e17b6fa831cfd10a6abe6877935fe7; manifest `.ai/runs/evidence/2026-11-03-engineering-standards-r1.json`, state ed772b05277d9cdcc244b9e53eeb2c9cf05a75afcc596dba71afca0cf1d59aaa. Root started R2 corrections after the first findings; later reproductions therefore do not represent a full review of R2 and require a new fingerprint/delta review. No product source, test or configuration was changed by this reviewer.

## Blocking findings

### R-PAY1 — P1: switching an initiated PSP order to credit loses the external charge

Location: `packages/db/src/platform-repository.ts`, R1 lines 573–598, 609–610 and 1440.

A held booking accepts a PSP checkout and, under a different idempotency key, a credit checkout. Credit decrements the package, confirms the booking and sets the same payment to paid. A later valid PSP paid event then returns at `payment.state === "paid"` without recording or refunding the additional charge.

Real PostgreSQL reproduction: purchase and pay a package; create a hold; checkout via PSP and attach an open checkout; checkout the same hold via credit with a different key; process the corresponding paid PSP event. Observed: credits=3, payment.state=paid, provider_payment_id=null, refunds=0. This consumes a credit while ignoring the external charge.

Expected: persist an immutable payment-method selection atomically when PSP checkout is requested, including the gateway-before-attach interval, or implement a deliberate compensated switch. Reject conflicting method selection without consuming a credit. A check limited to checkoutId is insufficient for an in-flight checkout.

### R-AVL1 — P2: removed recurring availability reopens after an occupied hold expires

Location: `packages/db/src/platform-repository.ts`, R1 lines 1099–1103; public availability query around 418 and createHold slot lookup around 507.

Rule changes preserve generated slots occupied by held/confirmed bookings. Once the booking expires or is cancelled, public availability still returns those preserved slots and createHold accepts their IDs, even when the originating rule has been removed or excluded.

Real PostgreSQL reproduction: create and expand a weekly 16:00 rule; hold its generated slot; save an empty rule set; expire the hold; request availability and create a fresh hold with that slot ID. Observed: ruleCount=0, old slot available=true, new booking state=held.

Expected: preserve existing bookings while revoking the removed generated availability for new reservations. Cover stale slot IDs, expiry/cancellation, rule removal and calendar exceptions.

### R-CAT1 — P2: the API rejects its own catalog cursor

Location: `packages/app/server/api.ts`, R1 lines 35 and 182; catalog cursor encoder in `packages/db/src/platform-repository.ts`.

The catalog validates cursor with the resource ID schema (max100), but a normal UUID mentor ID with recommended sort and rating0 produces a base64url cursor of length104.

Real handler + PostgreSQL reproduction with 22 profiles: GET /mentors?limit=20 => 200,20items,nextCursor length104; GET with that exact nextCursor =>422 VALIDATION_ERROR fieldErrors.cursor.

Expected: a separately bounded cursor schema compatible with every server-generated cursor and a transport-level page-two regression using normal UUID IDs.

### R-CAT2 — P2: specialty options do not match canonical stored values

Location: `packages/app/components/catalog.tsx`, Frontend option; `packages/db/src/seed.ts` specialty frontend; repository exact specialty predicate.

The UI sends Frontend, whereas the demo profile stores frontend and repository filtering is case-sensitive.

Real handler + PostgreSQL reproduction: GET /mentors?specialty=Frontend =>200,data=[]; GET /mentors?specialty=frontend =>200,data=[demo-mentor].

Expected: shared canonical option values (with independent display labels) consistently used by catalog, application and profile forms and seed; verify the actual UI-selected value against the real API.

### R-OWN1 — P2: participant session DTO bypasses payment-owner boundaries

Location: `packages/app/server/api.ts`, /me/billing, /me/sessions, /me/dashboard.nextSession and /mentor/dashboard.sessions; repository bookings includes mentee OR mentor participant and returns checkoutUrl/checkoutId.

The direct order endpoint correctly rejects the mentor, but billing returns the mentee's order as the mentor's own payment history. Session endpoints also expose the mentee's bearer checkout URL/ID to the mentor participant.

Real Better Auth + PostgreSQL + direct HTTP-handler reproduction: mentor login200; GET /me/billing200 includes another mentee's order; GET /orders/{sameId}404. A pending order with an attached private checkout URL was then returned with both checkoutUrl and checkoutId by GET /me/sessions200 and GET /mentor/dashboard200.

Expected: billing lists only orders owned by the acting mentee. Centralize a transport projection so non-owner participants retain session/calendar/price/state fields while private payment URL/ID fields are removed or null across every session response, including dashboard nextSession. Add owner/participant tests across all affected endpoints.

### R-PAGE1 — P2: panel consumers make resources beyond page one inaccessible

Locations: `packages/app/components/sessions-panel.tsx` (useResource /me/sessions); `messages-panel.tsx` conversation list; `admin-workspace.tsx` cases; `account-panels.tsx` own support tickets; `mentor-profile.tsx` reviews.

These consumers fetch a paginated endpoint but ignore its nextCursor and have no next-page/load-more control. Catalog consumes nextCursor (subject to R-CAT1), and message history itself has older-page support; the conversation list does not.

Real authenticated handler reproduction with 22 mentor-participant bookings: first /me/sessions page200 contains20 and nextCursor=review-page-18; the second page200 contains2. SessionsPanel never requests that page. Because the bounded API sorts resource IDs, hidden records can include upcoming sessions, not only old history. The same source pattern hides cases, conversations, support tickets and reviews beyond20.

Expected: expose and preserve cursor navigation for every paginated collection, reset cursors when filters/collection change, and test at least21 resources. Do not remove pagination or raise limits to hide this issue.

## Non-blocking observation

S-COUNT1 (P3): /admin/overview counts support cases with status=open, while support insertion uses the cases default pending and decideCase expects pending. Thus openTickets remains0 despite unresolved support cases. Align the count with the actual state machine and add a counter regression. The queue still lists the cases, so this does not independently prevent the local workflow.

## Evidence, scope and limitations

All reproductions used new PostgreSQL18.6 Testcontainers and synthetic identities/data, with guaranteed ORM/auth-pool/container cleanup. Catalog and owner reproductions invoked the actual Request/Response handler, not mocked repositories. Later experiments used a fresh temporary working directory and removed it. The first domain reproduction generated only its own `.snapshot-review_isolated.json` through Migrator; the reviewer identified and removed exactly that artifact. Root separately tracks the general unwanted-snapshot issue Q1.

The reviewer did not run npmci, build, port3100, shared E2E or shared coverage. Independent quality/runtime verification belongs to verify_product. The supplied independent370unit/100% result is evidence of coverage, not proof against the six reproduced/structural product defects above.

Other reviewed areas included shared SQL EXCLUDE/half-open intervals, durable inbox/outbox, idempotency keys, money/policy snapshots, late-payment savepoints, auth/session revocation/MFA/origin controls, raw signed webhook handling, refunds/leases/reconciliation, participant messages and private notes, append-only moderation audit, explicit migrations/roles, UI data flow and OCI/runbook shape. No additional concrete blocking issue was established in those paths during this pass. A trailing-slash native signup probe returned404; no bypass was found there.

Real Stripe/OAuth/SMTP delivery, hosting/PITR/SLO and public deployment remain unverified by design of the authorized local demo. Baseline CSP explicitly allows Next inline hydration and does not claim a nonce policy. Runtime verifier results and an R2 delta review are still required before readiness can be recommended.


## R2 delta review — frozen domain only, 2026-11-03

The R1 findings above are historical. This pass reviews the actual domain corrections for R-PAY1, R-AVL1 and Q1 only. API/UI corrections and the global product runtime/quality gate are outside this handoff and remain pending. No source, tests, configuration or task journal was changed by this reviewer.

Reviewed source scope: every TypeScript file under packages/core/src, packages/db/src and packages/db/migrations, plus packages/db/mikro-orm.config.ts. SHA256 of the sorted compact JSON mapping relative paths to content SHA256 is `2212a0011bcb7814f793c6351ec8370402396bd2059fca2880094961e96fd67d`. The six files changed against R1 are:

- packages/core/src/policies.ts — 7bdb07fc6e58d667d343ee356a1051799778891a62b83e26800cafa6bb2d3ace
- packages/db/migrations/Migration202611030004.ts — d69966924c47c3e778aaa79ab675f2dd3f4c50df8c8b72713a309d792fa32df5
- packages/db/mikro-orm.config.ts — e5bfb222c5b2450037d101f1b67d6b4e3b795af4eee837fbb3b58cfd1e73e4a9
- packages/db/src/entities.ts — 2139e783cd35262926d312e7f2c1a0000ec144e586e02675f27a6865f8638d56
- packages/db/src/migrate.ts — 5b973dfd5d0905f6b33fcc2dc4c508ab61baec4caad538223c472e2e49aaf275
- packages/db/src/platform-repository.ts — 832c5509bf59c3aaad51c8deb33da16c33e5360fbf4916f2dbe1992c095df6aa

The domain hashes remained unchanged between the source review and the end of the controlled PostgreSQL reproductions. This fingerprint is not the R1 manifest and is not a fingerprint of the still-changing app/UI.

### Finding dispositions and independent behavior evidence

**R-PAY1: resolved in this domain scope.** The booking/payment row locks protect immutable checkout_mode selection and outbox enqueue in one transaction, before checkout attachment. A fresh PostgreSQL18.6 reproduction observed checkout_mode=psp, checkout_id=null and exactly one checkout.start job; a different-key credit request failed PAYMENT_MODE_LOCKED. A simultaneous PSP/credit attempt had exactly one successful funding source and one PAYMENT_MODE_LOCKED result. No external provider call was made.

The legacy repair was reproduced against a credit-settled18000PLN-minor order with an attached old PSP checkout and a verified-event-shaped24000PLN-minor charge. Repeated paid events produced exactly one extra_charge refund and one refund job, with provider_payment_id=pi_legacy_extra_r2 and refund amount24000. The session payment remained paid18000 with its provider_payment_id null, and package credits stayed unchanged. pendingRefunds returned the separate24000 snapshot. A refund result claiming18000 was rejected PAYMENT_MISMATCH; the matching24000 result succeeded. After completing this synthetic credit session, totals including the seeded completed session remained gross36000, fee5400, net/settled/available30600. The extra-charge refund therefore did not incorrectly exclude the legitimate credit earnings.

**R-AVL1: resolved in this domain scope.** The generated active column is manual_offered OR rule_offered; recurring expansion revives only current rule offers, rule updates retire rule provenance, and availability/createHold/reschedule query active offers. On real PostgreSQL, removing a rule retired three generated IDs; stale unoccupied/expired IDs and a reschedule target all failed NOT_FOUND. The existing held booking expired normally and the existing confirmed booking retained its state/time. A manual slot sharing the same start as a rule had both provenance flags; retiring the rule preserved the manual offer. A false calendar exception also rejected its previously generated slot ID before a new calendar read and did not reopen it after expansion.

**Q1: resolved in this domain scope.** snapshot:false is explicit in programmatic and CLI migration configuration. On one fresh database, programmatic migrations completed and reran from /sys. On a separate PostgreSQL18.6 container, the reviewer initialized schema versions001–003 with synthetic persisted legacy data, then invoked the actual MikroORM CLI twice from /sys. The CLI upgraded to004 and reran successfully. Snapshot filenames in the repository root, migrations directory and /sys were unchanged. Migration004 backfilled queued-without-checkout and attached PSP payments to psp, settled credit to credit, unselected hold to null; existing refunds acquired their original provider/currency/kind=booking; existing manual and rule slots acquired the expected independent provenance flags.

**New blocking findings: none established in the frozen domain delta.** This is a review disposition for R-PAY1/R-AVL1/Q1, not integration/deployment approval. The remaining R1 API/UI findings require their own frozen delta review; the independent verifier must still run the full required checks against the final combined fingerprint.

Both reviewer PostgreSQL containers/pools were closed in finally blocks. The temporary reviewer CWD was verified empty and removed. No shared server, port3100, npmci, build, coverage output or global test run was used. The parent-supplied owner tests/coverage results were read as supporting evidence rather than substituted for these independent reproductions. Real Stripe calls remain unverified under the authorized local-demo scope.
