# Independent final product review

Role: delivery_reviewer /root/review_final.
Process: whirly-agentic-sdlc0.2.3, source_commit a46384578da42a90414e55b0d7165e27390d3a67.
Status: complete; no unresolved blocking findings for the authorized local-demo implementation.

## Inputs and reviewed state

Reviewed AGENTS.md, CLAUDE.md, lessons, the complete engineering task journal and specification AC-S1-S7/P1-P8/correction plans, the earlier engineering-review.md, base diff from HEAD3fed950619e17b6fa831cfd10a6abe6877935fe7 on main, current API/UI/domain/adapter/test/config/documentation source. Untracked product files are included in the manifest and review, not omitted from the tracked git diff.

Final manifest: .ai/runs/evidence/2026-11-03-engineering-final.json,213 files.
Source state SHA256:301e2d228e694de0439998103559202a7b359100be66ac8743536ec1cca24786.
Tracked diff SHA256:4f8066906c3f5047e7ecf059a5c4a9bbc9fda2d208bca93705df21b283a107a2.
The reviewer independently read all213 manifest entries and confirmed zero missing/changed files. API and room SHA256 also matched the independent near-now GREEN reproduction. A final manifest check will accompany the runtime evidence update.

No source, test, config or task journal was changed by this reviewer. Scope restrictions are instructions, without technical write isolation.

## Correction dispositions and independent evidence

- PAY1/AVL1/Q1: the six domain hashes exactly match the earlier independent PostgreSQL domain review. Its immutable funding selection, legacy extra-charge compensation, availability provenance/stale-slot refusal and migration/no-snapshot evidence remains current for that domain source scope. platform-repository.ts SHA256832c5509bf59c3aaad51c8deb33da16c33e5360fbf4916f2dbe1992c095df6aa.
- CAT1: separate opaque catalog cursor schema is bounded at2048; resource IDs remain bounded100. The actual returned UUID token longer than100 is accepted on page two, no duplicate/missing catalog IDs, malformed and oversized tokens rejected.
- CAT2: Catalog and MentorWorkspace now import one mentor-specialties option list with independent canonical values/display labels. Existing profile values are normalized for form selection and the repository compares specialties case-insensitively. The seeded frontend choice is covered by the actual UI E2E; final runtime execution belongs to the verifier.
- OWN1: owner-only billing/orders remains separate from participant session projections. Central sessionForActor redacts both checkout fields across session list/detail, dashboards and cancel/reschedule/complete mutation responses.
- PAGE1: all five affected consumers use scoped cursor pagination, previous/next controls, loading/error states and query/owner reset. Unit tests exercise21 resources per consumer, preserve query/opaque cursor encoding, owner/auth/resource changes, repeated-cursor guard, retry/back behavior and administration queue changes. The real support22-record desktop/mobile E2E is awaiting the independent runtime verifier.
- SCOUNT1: pending support-state counters and support/moderator/admin queue boundaries are covered through the real handler and PostgreSQL.
- R-ROOM1: resolved in R3, detailed below.

Independent command on frozen R3:
npx --no-install vitest run --config vitest.integration.config.ts tests/integration/catalog-contract.integration.test.ts
Result:6/6 PASS, fresh PostgreSQL18.6 and actual BetterAuth/Request/Response handlers. Log:/tmp/devmentor-final-review-contract-r3.log. It covers cursor, billing ownership/projection, mutation privacy, role-specific counts, owner/mentor/outsider/anonymous session detail, and a near-now join for both participants. The previous R2 reviewer run also passed5/5 before the new room regression; it is historical, not substituted for R3.

### R-ROOM1 - P2, found and resolved

Location before correction: packages/app/components/session-room.tsx:11; API orders GET and sessions join.

The room used the payment-owner /orders/{id} endpoint. A mentor could join a session but the resulting /room/{id} fetched404 and hid the room/notes form. Existing component mocks did not reveal the owner/participant mismatch.

Independent near-now RED on a new PostgreSQL/real BetterAuth:
owner join200/order200; mentor join200/order404; outsider join404/order404. Both participants received /room/review-room, but the room called /orders. GETsessions/id was404 before the correction.
Log:/tmp/devmentor-final-review-room-red.log.

Correction: GET/sessions/{id} delegates to the existing participant-authorized service.booking, then sessionForActor; SessionRoom reads this endpoint. Orders stays owner-only. OpenAPI, unit/realPG contracts and product E2E were extended. The E2E covers owner and mentor room rendering, independent persisted private notes and outsider404; the join window is separately checked in realPG.

Independent GREEN reran the same fresh-database/near-now scenario:
owner join200/order200/session200;
mentor join200/order404/session200 with checkoutId=null and checkoutUrl=null;
outsider join404/order404/session404.
The room now uses /sessions/{id} and no /orders request. API+room SHA matched before/after the test and match final manifest.
Log:/tmp/devmentor-final-review-room-green.log; runner:/tmp/devmentor-final-review-room.mts.
Each container and auth/ORM pool was cleaned in finally. Source checks in the runner are informational; endpoint status/projection evidence is taken from actual handler responses.

## Other review and limitations

No unresolved blocking finding established in final source/tests. The tentative final-attempt lease hypothesis was rejected after reading the complete claimJobs block: its terminal sweep already marks expired running attempts>=8 failed with LEASE_ATTEMPTS_EXHAUSTED. Repository hash was unchanged; this is not a finding.

Other reviewed risk areas include auth/session/MFA/origin boundaries, direct native signup restriction, text rendering, SQL-owned migrations and generated availability provenance, funding locks/refund snapshots, durable jobs/leases/reconciliation, dependency graph and strict lint/TS configuration, full coverage inclusion, pinned CI Actions and fail-on-skipped aggregate, OCI/runtime and operational documentation. Review is evidence-based assessment, not a claim that every possible defect is absent.

No npmci, shared build/.next, shared coverage, E2E server/port3100 or user database was used by this reviewer. Full quality/build/integration/E2E/security results belong to the separate verifier; OCI smoke belongs to root. Missing required checks are not PASS, and their completion is required before a readiness recommendation.

Real external Stripe/OAuth/SMTP and hosting/PITR/SLO remain explicitly unverified under the authorized local-demo scope. Branch protection/review settings are external and not created by a workflow file. This report is not integration/deployment approval.

## Secret-scan configuration delta review

Root added .gitleaks.toml after the product freeze to remove false positives from file SHA256 maps in three known evidence manifests. Reviewed configuration SHA256:6347035d53816c542f7105d24e207447dbe726332b306ff0c475a95aa6439d47, identical before and after independent probes. Product source stayed frozen; the combined manifest must be refreshed to include this new scanner configuration.

The extension preserves default rules and targets only generic-api-key with conditionAND: one of three exact manifest paths AND a full JSON path-to-64lowerhex entry line. The optional initial newline accommodates Gitleaks' captured currentLine shape; it does not permit arbitrary extra text. No global path exclusion, disabled default rule or general hex-secret exclusion was added.

Independent Docker Gitleaks8.30.1 probes, each with isolated readonly input/config and output outside the scanned directory:
- File-hash entry in an allowlisted manifest:exit0,0 findings.
- Synthetic api_key64hex in that same manifest:exit1,generic-api-key.
- Identical hash entry in another JSON file:exit1,generic-api-key.
- Synthetic high-entropy ghp token in the allowlisted manifest:exit1,github-pat.

All4 expected outcomes PASS. Evidence:/tmp/devmentor-review-gitleaks-okxrq0w_/summary.json; each case includes input and redacted tool log/findings. Fixtures are synthetic and grant no access. Initial config2446c602 still reported the legitimate hash; root's newline correction6347035d resolved that. The first sequential-alphabet GH fixture was unsuitable and replaced by a valid high-entropy synthetic sample; its initial absence was not treated as a configuration failure.

Primary implementation inspected for semantics:[Gitleaks8.30.1 config](https://raw.githubusercontent.com/gitleaks/gitleaks/v8.30.1/config/config.go) and [finding allowlist evaluation](https://raw.githubusercontent.com/gitleaks/gitleaks/v8.30.1/detect/detect.go). The source confirms default-rule merging and AND path/line evaluation. No blocking scanner-config finding remains. The full repository scan is root's separate verification.

## R4 mailbox transport and test-ingress delta review

Final combined R4 source state is542e40d87f6c8aa92fbc4fcef9f763f41bac9ea62444d9c79d1be0b0aabc8b97,213 manifest files. The reviewer independently recomputed every manifest entry and observed mismatches[]. The tracked diff hash remains174a2f508ee560aedd4dddb166a5da1e5a872a751258d56e210eb61b164b27bf. The Gitleaks6347035d configuration from the separately reviewed scanner delta is included and unchanged.

The production Next E2E exposed a real mailbox mismatch: Request.url may use the0.0.0.0 bind address while the browser's Host is localhost. R4 checks the transport Host first, only falls back to the Request URL when Host is absent, and accepts an anchored loopback authority pattern. An explicit wrong/empty Host cannot fall back to the URL. Forwarded host is never authorization input. APP_MODEdemo and the owner-cookie SHA256 database lookup remain mandatory.

Independent actual-handler/BetterAuth/PostgreSQL18.6 test on internal Request URLs0.0.0.0:
- Two separately registered owners each receive exactly one verification message, and their verification URLs are disjoint.
- Unknown owner and absent cookie each return200 with an empty mailbox.
- Foreign Host with forwarded localhost returns404.
- Absent/empty Host on the internal bind URL with forwarded localhost returns404.
- Production mode returns404.
The correct localhost transport Host succeeds despite an unrelated forwarded host. The script prints counts/status only, never verification tokens. Log:/tmp/devmentor-final-review-mailbox.log; runner:/tmp/devmentor-final-review-mailbox.mts. Auth HTTP SHA25623c14af47f05d6cce764667ca265eff3428f54098c66328be3ab2c8ce249bf85 matched before/after and the final manifest. Its own container and auth/ORM pools were closed in finally.

Unit source review covers valid IPv4/IPv6/case/port hosts and rejects userinfo, path, comma, repeated-port and localhost-suffix tricks. Existing mode/owner checks remain covered. RealPG auth regression expects same-client signup201,201,201,429 and separate-client201. This is a meaningful policy guard, not a disabled rate limit.

E2E fixtures now model distinct clients behind the documented trusted ingress with synthetic192.0.2.x/203.0.113.x single-address XFF values. Runtime auth.ts/rate-limit policy and Playwright parallelism are unchanged; no serialized workaround or added retry masking was introduced. The untrusted-forwarded-host mailbox cases remain denied. Actual Next/OCI/browser validation belongs to the independent verifier and root smoke, which must finish on this state before readiness.

The R3 room/catalog/ownership findings remain resolved: R4 changes mailbox transport validation and fixture client identity, not their API/domain/UI paths. No new blocking access-control or test-policy finding is established in R4.

## R5 mobile sizing and semantic filter-locator delta review

Latest frozen source state:752a07f91044dc020e3d81b4f792d0505acc57d9dac5807f1634a0b1ea571dd7,213 files; tracked diff636399f10f774a2d2180cf9539e4abbb69a7e47bf1314f3f4c3163173aa40d0d. All213 manifest hashes were independently recomputed with mismatches[].

The official browser diagnostic established a real mobile sizing defect: the mobile grid's1fr track retained an intrinsic minimum from the horizontal navigation/aside, expanding the document to835px while the configured client viewport was412px. The R5 CSS uses minmax(0,1fr) for the mobile workspace track and min-width0 on the direct aside. Navigation retains its own overflow:auto. This corrects the intrinsic sizing cause without clipping the document or hiding overflow.

The two changed E2E files now compare document scrollWidth against page.viewportSize().width, including before message send and on both support pages before clicking. The previous comparison against window.innerWidth could accept the already-expanded layout viewport; the new assertions detect that regression. No force-click, serialization, timeout increase, rate-limit change or assertion removal was introduced. The catalog uses the semantic combobox/name locator; the actual frontend filter/result assertion remains. The official diagnostic proved that implicit-label text included option text even though the accessible combobox name was correct.

Read-only visual inspection of the actual passed R5 mobile screenshots:
test-results/product-pagination-support-98a75-d-canonical-catalog-filters-mobile-chromium/support-page-two.png
test-results/product-booking-registrati-a8e07-yment-cancellation-and-IDOR-mobile-chromium/mentor-room.png
Both show a constrained single-column layout, readable form/room/private notes, and support page two with two records and usable Back control. Horizontal navigation is scoped to its own container. The focused skip link appears at the current viewport position within the full-page support screenshot and is expected focus feedback.

Independent verifier reports the standard host E2E passed6/6 on the fresh R5 build, both desktop/mobile in parallel, full booking/room/notes/IDOR and22-ticket pagination/back/canonical filter/keyboard. Root reports the final OCI4434515e581de589c1617253822824c294b4ebde8c9ffc33e54144c32e5a5f94 smoke and final Gitleaks scan passed; their final recorded evidence is to be read before concluding.

Two SERVICE_UNAVAILABLE log codes during the successful E2E are not yet classified. The timestamps are during the run, not shutdown. Successful traces were initially absent because retain-on-failure was configured. The verifier is running a temporary trace-on harness on unchanged source to correlate response URLs/request IDs. No harmless-prefetch or shutdown explanation is asserted without evidence. Final review disposition awaits that narrow diagnostic.

## Final persistence delta and completed review disposition

Final reviewed manifest is213files, source301e2d228e694de0439998103559202a7b359100be66ac8743536ec1cca24786, tracked diff4f8066906c3f5047e7ecf059a5c4a9bbc9fda2d208bca93705df21b283a107a2, HEAD3fed950619e17b6fa831cfd10a6abe6877935fe7/main. The reviewer independently checked all manifest entries again after the final runtime results: FINAL_MISMATCHES[].

The final two-file delta from R5 is README.md and tests/e2e/product-booking.spec.ts. The test registers an exact-method/path response wait before the normal click, requires201, asserts the message in .message-list article, reloads the page and asserts that history message again. Draft textarea text cannot satisfy this selector. README now puts browser installation and production build before integration. No production source/config/dependency/style changed in this delta.

Final independent verifier results were read from its machine record /tmp/devmentor-final-r6-results.json and actual /tmp/devmentor-final-r6-e2e.log:
- Fresh format, lint and typecheck PASS.
- All6E2E PASS with full traces,27.53s including setup, desktop/mobile concurrently on fresh PostgreSQL and the unchanged production build/worker.
- Reviewer independently parsed the raw six trace.zip network streams: exactly one messagePOST201 in each desktop/mobile booking trace and no received response5xx across all6traces. The verifier's sanitized network summary additionally records post-send GET200 and reload GET200, with history assertion targets P.prose-copy in an article, not TEXTAREA.
- SERVICE_UNAVAILABLE log count is0 in the final run. One unfinished GET/me/dashboard on navigation is recorded separately; it is not a failed mutation or received5xx.

Evidence:/tmp/devmentor-final-r6-network-summary.json and /tmp/devmentor-final-r6-network-traces/**/trace.zip. The earlier abort/error timing is a correlation because the browser never received headers for those aborted requests; the exact server exception was not instrumented. The confirmed defect was the false-positive E2E draft assertion and premature navigation. Waiting for actual201/history/reload closes the gap and removes the two error logs in final evidence. No prefetch cause, hidden retry, muted logging or production-code workaround is claimed.

The separate verifier's full396unit tests/100%four metrics over78implementation entries,54integration tests, dependency graph/npm-ls and dependency-audit evidence were executed on R4. Its explicit hash comparison transfers them across the subsequent CSS/E2E/docs-only changes, since all TypeScript implementation/unit/integration/dependency/security-policy inputs are byte-identical. R5 freshly rebuilt the production app with the final CSS and no environment/provider secrets; R6 only changes docs/E2E, so that production-build evidence remains applicable. Earlier failed rounds remain historical and are not relabeled as success.

Root's OCI evidence was read from .ai/runs/evidence/2026-11-03-engineering-oci.json: final runtime image sha256:4434515e581de589c1617253822824c294b4ebde8c9ffc33e54144c32e5a5f94, build/migrate/rerun/seed/UID1000/web/catalog/registration/mailbox/verification/login/native-HTTP foreignHost404/auth/session/worker PASS, disposable resources cleaned. The report explicitly transfers that evidence over the final README/E2E-only delta, with current source301e2d and no manifest mismatches. The corrected native HTTP host probe is supported by an echo-server control; Node26fetch did not send its attempted Host override, so the original negative probe was a harness failure, not a product-policy failure.

Root's final-source secret scans and the independently tested Gitleaks6347035d allowlist are recorded separately. The root will repeat the full scan after final workflow documentation changes; no source check or review is replaced by this note.

**Disposition: local-demo implementation is ready for the project's human integration decision; no unresolved blocking review finding remains in the reviewed final source/test state.** This is a readiness recommendation, not integration/deployment approval. Hosted CI/branch protection/review rules, real Stripe/OAuth/SMTP delivery, staging/production/backup-PITR/rollback/SLO are explicitly external and unverified. They remain required before public production use; local synthetic provider tests and OCI smoke do not claim those outcomes. Standard browser installer attempts required interactive sudo in this host, and final browser execution used the documented existing Chrome/library environment without skipping tests.
