# M1a Implementation and Verification

Historical audit completed 2026-10-30 (Asia/Seoul), before the subsequently authorised continuation. **M1a operational acceptance remains open.** During the audit itself, no remote changes, commit or push occurred. The dated findings below retain that audit's evidence.

**Current continuation:** the 25 audit files were preserved in four commits and pushed through `6b39ca8`. The user then approved the two M1 SQL files; both are now applied and checked on the existing project. Auto-RLS EXECUTE warnings are resolved, while real email/Auth/Storage integration is still blocked by missing app credentials and authorised test mailboxes. No test accounts/data or Auth settings were changed. See [current M1/M2 report](m1b-m2-implementation.md) for exact remote history mapping, checks and new local-only investigation work. The connector assigned different migration timestamps; do not blindly run remote `db push`.

## Baseline and Environment

- Repository `liminal-cipher/trace-and-tell`, branch `main`, starting HEAD `7856a44caaeb4d699e121b3eb75880031d064f40`. Fetch confirmed 0 ahead / 0 behind; working tree initially clean.
- Read all six requested documents, local AGENTS and shared engineering policy. The policy matched fetched agents-sync main. Applied develop-software and Supabase guidance, current official docs and installed Next.js documentation.
- The four design documents retain their dated pre-implementation proposals; this report records observed implementation status.
- Windows / PowerShell. No Docker/psql executable, Docker Desktop at its normal installation path, Supabase process credentials or `.env.local` was found. No global software was installed.
- PGlite 0.5.13 reports PostgreSQL **18.6**; connected Supabase reports **17.11.0.003**. PGlite does not run GoTrue, PostgREST or Storage HTTP, or establish independent-connection concurrency.

## Delivered Source

Existing M1a provides server-side email Magic Link/PKCE, workspace creation/listing/renaming, JPEG/PNG/WebP uploads, typed notes, original retrieval, metadata revisions, optimistic conflicts and deletion/recovery. It uses Next.js App Router, TypeScript, Tailwind, Zod, SQL migrations and private Supabase Storage. No ORM or model SDK was added.

The static `/demo` uses fictional illustrations/text labelled synthetic fixtures, with no private query, write control or model endpoint. No real family records were used. This audit did not reconnect Figma or redesign the interface.

## Audit Findings

Severity reflects the actual boundary and consequence. No Critical application exploit or cross-user disclosure was reproduced. Hosted behaviour remains an external verification gate.

| Severity | Evidence and impact | Resolution |
| --- | --- | --- |
| High | Existing workspace RLS checked owner JWT claims without the backing session. A SQL regression deleted the session while retaining claims and still read the workspace. A stolen, unexpired bearer token could retain direct Data API reads after logout. This did not demonstrate a flaw in the app's online `getUser()` check. | Fixed locally: private helper checks caller session, owner and `not_after`; workspace RLS and dependent tables use it. Real Auth/Data API replay test prepared, not run. |
| Medium | Five invalid/insecure APP_ORIGIN configurations were accepted: remote HTTP, userinfo, path, query and fragment. Misconfiguration could produce non-Secure cookies or incorrect redirects. Callback also fell back to request origin. | Fixed: canonical HTTPS origin except local HTTP, shared cookie settings and no Host fallback. |
| Medium | Completed-upload finalisation returned before checking the submitted idempotency key. It violated receipt semantics, although it did not duplicate photos or bypass ownership. | Fixed: completed requests go through the RPC; receipt identity excludes only server-derived image verification fields. |
| Medium | One UI retry-key slot was replaced by another form operation. Retrying an unknown-outcome note/workspace save could duplicate it. | Fixed: retain each unresolved payload's key in memory until confirmed. No browser-storage persistence of private input. |
| Medium | Pagination treated a short page as exhaustion. With a Data API cap of 100, only 100 of 1,001 fixture rows were loaded, potentially hiding records or cleanup work. | Fixed: advance by received rows and continue to an empty page. Lower-cap regression passes. |
| Medium | Browser tests inherited service configuration and retained failure traces. `.env.local` could configure the server independently of test skip decisions; private traces could retain cookies/capabilities. No disclosure was observed. | Fixed: default runner/child clear Supabase configuration, opt-in validates exact local origins before startup, traces/video/automatic screenshots disabled. Capability-bearing failures are sanitised. |
| Low | Callback lacked explicit no-store; refresh proxy ignored additional SSR cache headers. | Fixed: callback no-store/no-referrer, refresh header forwarding and sanitised proxy failures. No cache disclosure was reproduced. |
| Low | Remote auto-RLS function has default PUBLIC EXECUTE and advisor warnings 0028/0029. | Least-privilege SQL prepared and locally tested. Ordinary SQL invocation is blocked by its event-trigger type; no escalation exploit demonstrated. Remote unchanged. |
| External verification | Official Storage advisory affects storage-api <=1.80.1, fixed in 1.80.2. Hosted runtime version was unavailable from this connector. | Require patched-runtime confirmation before service acceptance; do not infer status from PostgreSQL/npm versions. |

The [official Storage advisory](https://github.com/supabase/storage/security/advisories/GHSA-8rrf-w776-x75g) concerns signed resumable routes that could bypass token checks and overwrite private objects. This app uses ordinary signed PUT, but service-wide protection must still be checked. App RLS cannot repair a vulnerable Storage runtime.

## Changed Files

All paths are repository-relative and uncommitted in this audit.

| Files | Reason |
| --- | --- |
| `src/lib/errors.ts`, `src/lib/supabase.ts` | Origin validation; consistent HttpOnly/Lax/Secure host-only cookies; fail closed on invalid configuration |
| `src/proxy.ts`, `src/app/api/auth/login/route.ts`, `src/app/auth/callback/route.ts` | Canonical callback, cache headers and safe errors |
| `src/lib/archive.ts`, `supabase/migrations/20261028155626_persistent_archive.sql` | Completed-upload receipt enforcement and normalised request identity |
| `src/lib/retry-keys.ts`, `src/components/archive.tsx` | Independent unresolved command keys |
| `src/lib/pagination.ts` | Respect response caps lower than the requested page size |
| `supabase/migrations/20261029150829_m1a_security_hardening.sql` | Session-aware RLS and guarded auto-RLS EXECUTE revocation |
| `playwright.config.ts`, `tests/local-environment.ts` | Disconnected default, pre-start local-only guard, no sensitive traces |
| `tests/security.test.ts`, `tests/auth-routes.test.ts` | Origin, target, cookie settings, actor forgery, session denial and callback regressions |
| `tests/auto-rls.test.ts`, `tests/database.test.ts` | Event/ACL preservation, all migrations, revoked/expired/mismatched sessions, receipts and deletion/re-upload |
| `tests/file-access.test.ts`, `tests/recovery.test.ts`, `tests/retry-keys.test.ts` | Deletion/download race, failed cleanup/retry, completed receipt path and interleaved retry keys |
| `tests/e2e/private.spec.ts`, `tests/e2e/public.spec.ts` | Additional real-service cases and public callback cache checks; private cases currently skipped |
| `package.json` | Generate Next route types before typechecking a fresh checkout |
| `README.md`, `docs/m1a-implementation.md` | Current setup, evidence, limitations and remote plan |

Local-only CURRENT_TASK.md and generated AGENTS.md remain ignored in `.git/info/exclude`. No dependency/lockfile change was needed.

## Data and Security Boundaries

### Auth and Server Trust

Magic Links use PKCE and must open in the requesting browser. There is no browser Supabase client. Cookies are HttpOnly, host-only, SameSite=Lax and Secure on HTTPS; HTTP is allowed only on localhost/loopback. Actual HTTPS cookie delivery remains unverified.

Private routes call online `auth.getUser()` and reject anonymous Auth users. Only its verified `user.id` supplies `archive_command.actor`; Zod strips forged actor/role/path fields. Mutations require an exact Origin; JSON bodies have an actual streamed-byte limit. SameSite cookies and strict Origin checks protect cookie-authenticated mutations. Forging an Origin still requires a valid session. Callback redirects are fixed, do not accept `next`, and require successful PKCE exchange.

Current [SSR guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide) distinguishes online getUser from local JWT validation and documents refresh cache headers. The [Auth source](https://github.com/supabase/auth/blob/master/internal/api/auth.go) checks session existence. Hosted Auth version/refresh/logout are unverified. The new DB predicate also protects direct reads; it does not implement paid inactivity/single-session policy or change Auth settings.

User clients perform RLS reads. Separate per-request service clients perform authorised RPC/Storage operations. The service key bypasses RLS, remains server-only and is never returned. No user client is shared across requests; `/demo` does not construct one. Tests exercise forged actor fields and denial before privileged commands.

### Database, Grants and Revisions

All five app tables have RLS and explicit grants. Anonymous roles have no app-table access. Authenticated users receive owner-scoped SELECT on workspaces/assets and explicit column SELECT on revisions/intents; no direct writes, TRUNCATE, storage-key or receipt access. Service-role writes intentionally bypass RLS but are protected by app checks and transaction-level ownership checks. `archive_command` is SECURITY INVOKER, empty search path, service-role-only EXECUTE.

`archive_private.session_is_active()` is SECURITY DEFINER solely to read `auth.sessions` without granting that table to users. It accepts no caller-supplied IDs, uses signed Auth context, returns only a boolean and has an empty search path. PUBLIC/anon EXECUTE is revoked; authenticated EXECUTE is needed by RLS. The schema is not exposed in local configuration. **Confirm it is absent from hosted exposed schemas**; the connector did not expose that setting.

An owner advisory transaction lock serialises receipts, quota reservations, deduplication and revision writes. Workspace/asset row locks and expected revision checks reject stale changes. Revisions append; client roles cannot change history. Idempotency keys are actor-scoped; same requests return the existing result and changed payloads conflict. Service receipt replay can return an old result but cannot revive an asset; the app checks active state before completed finalisation.

Deduplication uses original-byte SHA-256 per workspace and active photo. Re-upload after deletion gets a new asset/path. SQL tests include disk-backed PGlite restart. Real PostgreSQL 17 concurrent connections and PostgREST behaviour are still unverified.

### Private Storage and Recovery

Both buckets are private, limited to 6 MiB JPEG/PNG/WebP. Restrictive policies deny direct clients even alongside a permissive policy. The server issues a non-upsert capability for one allocated staging path; commands cannot choose a bucket/path.

Finalisation checks exact size, actual format, complete decoding, animation and a 24-million-pixel ceiling, then hashes unchanged bytes. It writes an immutable original before the DB transaction. After copy-success/DB-failure, retry checks the existing hash before committing. DB success remains saved if staging cleanup fails. Tests inject these faults at the SDK HTTP boundary, not into real Supabase.

Intent validity is 10 minutes; the [documented signed capability](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl) lasts two hours. The pinned SDK documents that upsert is controlled at capability creation. The app records a 125-minute cleanup horizon and never extends finalisation time. A valid capability may recreate staging after cleanup, but cannot reactivate a completed/rejected/expired intent. Cleanup therefore stays pending until the horizon ends. Native token/path/upsert/replay behaviour and natural two-hour expiry are unverified.

Deletion commits pending before removal. Revision/original access is blocked; the download route rechecks RLS after Storage I/O. Removal failure is visible and retryable. Bytes already received, or a response authorised just before concurrent deletion, cannot be recalled; no linearizable recall guarantee is claimed.

Originals bypass the Next image optimiser and use authenticated private/no-store/nosniff responses, without public/signed-download links. Original EXIF/GPS bytes are preserved for the owner, not extracted into the demo or sent externally. This is not metadata sanitisation. Tombstones, revisions, intent metadata and receipts remain retained; deletion blocks access rather than erasing every database byte.

Cleanup is on demand after save/delete or via Retry file cleanup. There is no background scheduler; abandoned private objects consume storage until cleanup runs. This limitation remains open.

## Auto-RLS Advisor Investigation

Read-only catalogue evidence: `public.rls_auto_enable()` is owned by postgres, SECURITY DEFINER, returns event_trigger, has `search_path=pg_catalog`, ACL NULL and effective anon/authenticated EXECUTE. Neither client role can CREATE in public/auth/storage. Enabled `ensure_rls` runs on ddl_command_end for CREATE TABLE, CREATE TABLE AS and SELECT INTO, bound to that function. Its body enables RLS on public tables and catches/logs errors, so individual table RLS flags must still be checked.

Warnings [0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) identify unnecessary permissions, not proof of successful RPC body execution.

Local ordinary invocation fails with `trigger functions can only be called as triggers`, consistent with [PostgreSQL 17's invocation contract](https://www.postgresql.org/docs/17/event-trigger-definition.html). Inspected [PostgREST source](https://github.com/PostgREST/postgrest/blob/main/src/library/PostgREST/SchemaCache.hs) excludes trigger explicitly but does not establish exclusion of event_trigger: **do not claim the RPC is invisible**. Hosted discovery/invocation was not tested. Even if discoverable, the inspected PL/pgSQL function's normal invocation is blocked before its body. No remote execution probe was made.

Proposed least-privilege change:

```sql
revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;
```

The hardening migration checks function type/definer status and the enabled ensure_rls binding. Absence is tolerated for local stacks; unexpected existing shapes fail closed. It preserves the body, owner, search path, event binding and all other platform triggers. Local tests verify unchanged definition, both effective permissions false, and continued automatic RLS for all three DDL forms even when the DDL caller lacks function EXECUTE. PostgreSQL 17 hosted verification remains required after approval.

## Local Integration Setup

1. Use a disposable local Supabase stack with Docker already installed/running. `npx supabase start` reads supabase/config.toml and initialises migrations. Do not link these tests to the cloud project. No system-wide installation is performed by project scripts.
2. The **unapplied initial migration was revised**. Use a fresh local stack, or explicitly reset only a disposable local database after reviewing its contents. Do not silently reuse an older schema or reset a remote database.
3. For manual use, supply ignored `.env.local` from `.env.example`. For private Playwright, supply local SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY as process environment variables through a secret mechanism. Do not print values. Playwright does not load `.env.local` for service tests.
4. Set RUN_LOCAL_SUPABASE_E2E=1. Optionally set LOCAL_MAILPIT_URL (default http://127.0.0.1:54324). App test origin is http://127.0.0.1:3000. Exact local HTTP service origins are checked before startup; there is no remote override.
5. Run `npm run build`, then `npm run test:e2e`. Without opt-in, Supabase configuration is explicitly cleared in runner and child, overriding dotenv; public/unconfigured tests run only.
6. With a local stack available, also run `npx supabase migration list --local` and `npx supabase db lint --local`. These service commands were **not run** here.

Private tests use real local Mailpit, Auth, PostgreSQL/Data API and Storage. Added scenarios cover cookie flags, cross-user deletion, privileged RPC/receipt/path denial, payload conflict, revoked-token direct reads, interrupted upload/retry, signed path/bucket/token misuse, non-upsert replay, intent expiry and logout-cookie replay. Synthetic test data remains in the disposable stack. Traces/video/automatic screenshots stay disabled; never add credential-bearing attachments or debug output.

## Verification

Current results are separate from the previous implementation's historical 21-test result.

| Command / check | Result | Evidence |
| --- | --- | --- |
| Fetch / branch / status / tracking | passed | Initially clean main, 7856a44, 0 ahead / behind |
| `npm ci` | passed | 409 packages; 0 vulnerabilities. Warnings: unsupported ESLint 9 and uncovered optional unrs-resolver install script; no script approval/settings change |
| Baseline `npm run test` | passed | 21 tests before changes |
| Origin regression before fix | failed | Five insecure/non-origin values accepted; fixed and rerun |
| Revoked-session SQL regression before fix | failed | Workspace readable after session removal; fixed and rerun |
| Lower response-cap regression before fix | failed | Returned 100 of 1,001 rows; fixed and rerun |
| Intermediate checks | failed | Error-message assertion mismatch, ProcessEnv test typing and Fetch ok-property typing; corrected and rerun |
| Intermediate expanded test run | failed | Interrupted after a fault fixture ignored pagination offsets and repeated rows indefinitely. Fixed the fixture to honour offsets; final run passed |
| Final `npm run test` | passed | 48 tests in 8 files: 14 PGlite SQL/event tests, 34 validation/route/fault/retry/config tests; 14.50 seconds |
| `npm run typecheck` | passed | Next route generation and strict TypeScript |
| `npm run lint` | passed | No errors/warnings |
| `npm run build` | passed | Next 16.4.3 production build; static demo and dynamic private/Auth routes |
| `npm run test:e2e` | passed / not run | Actual Chromium: 6 public/unconfigured checks passed on desktop/mobile; 2 real private-service journeys skipped |
| `npm audit --omit=dev` | passed | 0 reported production vulnerabilities |
| Browser bundle scan | passed | No privileged Supabase variable/helper/RPC symbols in .next/static; no real credentials used |
| `git diff --check` | passed | No whitespace errors; Git reports normal LF-to-CRLF notices |
| Connected Supabase read-only catalogue/migrations/advisors | passed | State recorded below; no service writes |
| Docker/local Supabase start, migration, lint | not run | Docker and credentials unavailable; no automatic installation |
| Real Auth/Storage/PostgREST/private browser integration | not run | No local stack; remote writes not approved |
| Real PostgreSQL 17 concurrency and app restart with private data | not run | PGlite restart/serial execution is not this test |
| Native token expiry, hosted HTTPS/CDN, configured-secret bundle test | not run | Configured service and elapsed expiry/hosting checks needed |

No executable final check remains failed. Earlier failures are retained above. Passing local tests does not certify the private archive as operational.

## M1a Acceptance Matrix

Statuses cover the full acceptance condition, not merely one layer or a mock.

| Condition | Status | Evidence / remaining gate |
| --- | --- | --- |
| Create workspace, photo and typed note | blocked | Validation/SQL pass; real UI/Auth/Storage journey not run |
| Retrieve originals; reject wrong/corrupt/oversized files | blocked | JPEG/PNG/WebP decoder/fault checks pass; real retrieval unverified |
| Refresh/backend restart preserve metadata and revisions | blocked | PGlite disk restart passes; real app/Supabase restart not run |
| Partial failures preserve successes and retry safely | blocked | Copy/DB/cleanup faults pass; real network retry test prepared |
| Double click/retransmission and stale edits | blocked | SQL receipt/CAS and retry-key tests pass; independent-connection races outstanding |
| Auth/owner/revision/deletion enforced across API/DB/Storage | blocked | Unit/PGlite denial checks pass; real two-user/session isolation not run |
| Capability validity/expiry/misuse and delete/cleanup denial | blocked | Local deletion race/retry pass; actual token expiry/policies unverified |
| Synthetic demo isolated from private writes/data/Meta | verified | Static source and desktop/mobile browser checks; no model endpoint |
| Security gates and separate approval before deployment | blocked | Actual service acceptance and deployment approval absent |
| Actual browser use or explicit reporting of gaps | verified | Public paths exercised; private paths explicitly not run |
| README setup/test instructions reflect implementation | verified | Updated instructions and environment limitations |

## Remote Supabase Preflight and Approval Plan

### Read-only Observations

Target **trace-and-tell**, project **svwzgtsjwcvncxyvdhho**, Seoul ap-northeast-2, ACTIVE_HEALTHY, PostgreSQL 17.11.0.003.

- Applied migrations: 0. Public tables/views/materialised views: 0. Public functions: only rls_auto_enable(). Storage buckets: 0. Policies on public/storage: 0 at inspection.
- No conflicting app object or archive_private schema. Postgres has SELECT on auth.sessions; required id/user_id/not_after columns exist.
- Default privileges differ by creator: postgres defaults omit table CRUD but retain some non-CRUD privileges; supabase_admin defaults are broader. Explicit application REVOKE/GRANT is necessary.
- Security Advisor still reports both auto-RLS warnings. Remote permission changes have not been applied.
- The organisation connector confirms the Free plan. Remaining usage, Auth redirect/template/SMTP configuration, exposed API schemas and Storage runtime version were not available from these queries. No keys were retrieved.

The [October 30 Data API change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) requires explicit grants for new tables; these migrations already provide them. [PostgreSQL 17.11 compatibility changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) involve ltree, legacy pgcrypto encryption, btree_gist float/NaN and custom estimator operators, none used by M1a. Modern Node/browser TLS should not need changes for the announced [cipher removal](https://supabase.com/changelog/cbc-tls-ciphers-deprecated); hosted connectivity is still unverified.

### Exact Proposed Changes and Order

1. Prefer the disposable local real-service gate first. Confirm Storage >=1.80.2 or authoritative hosted patch status. Review the diff and recheck migration/object/ACL state immediately before application; stop on conflicts.
2. With **separate approval**, apply revised `supabase/migrations/20261028155626_persistent_archive.sql`: five tables/indexes, RLS/grants, service-only invoker RPC, two private buckets, four restrictive Storage policies. Finalisation receipts now store normalised request identity. The target has not applied it; this edited initial migration is not an upgrade path for an independently deployed database.
3. Apply `supabase/migrations/20261029150829_m1a_security_hardening.sql`: private schema/helper/ACL, session-aware workspace read policy and guarded auto-RLS EXECUTE revocation. Confirm archive_private is not exposed through PostgREST. Keep the app unavailable until both files and post-checks succeed.
4. Check all five RLS flags, policies, client column/table grants, bucket privacy/limits, RPC/helper scope and ensure_rls binding; rerun advisors. Verify anon/authenticated EXECUTE=false. Creating a disposable table to prove auto-RLS still works is DDL and needs explicit remote test approval.
5. With **separate Auth approval**, set the chosen exact HTTPS APP_ORIGIN, Site URL and `/auth/callback` allowlist. Verify the email template follows a PKCE code route, not a token-hash-only route unsupported by this callback. Avoid wildcard production redirects. SMTP/template/redirect changes are not part of SQL approval.
6. With **separate remote test-data approval**, create synthetic accounts/records in this exact project and execute the checks below. Do not remove the local-only guard: use a separately reviewed remote runner or supervised manual protocol and approved test mailboxes, without secret output.
7. Only after acceptance, separately consider Vercel configuration/deployment. No deployment, environment update, paid plan or model call is authorised by this report.

### Real-service Tests Still Required

- Real email delivery, same-browser PKCE, refresh/expiry/logout, old-cookie/JWT replay, HTTPS cookie flags, callback no-store and sanitised errors.
- User A's workspaces/photos/notes versus user B and anon across app/Data API/Storage. Deny write/delete, privileged RPC, receipts and object keys; try forged actor and cross-workspace asset/intent IDs.
- Concurrent same-key/different-key requests, revision conflict, duplicate bytes, and competing 20th/21st photo reservations over independent connections.
- Capability wrong path/bucket/token, upsert, reuse before/after completion/rejection/deletion and **natural native expiry**; separately verify the 10-minute intent deadline.
- Copy-success/DB-failure, DB-success/staging-failure, removal failure, immediate denial, visible pending state and eventual orphan cleanup after capability expiry.
- Save/reload/restart the app process, reopen original bytes, workspace names, notes, metadata and all revisions.
- Configured client bundles/HTTP responses, actual private CDN/cache behaviour and demo isolation. Synthetic data only, no Meta calls.

These checks are **not run**. Approval must distinguish both migrations, test users/data, email sending, Auth changes, destructive rollback and deployment. Migration approval alone does not authorise the other steps.

### Recovery and Rollback Limits

Each file has a transaction. Failure rolls back that file. If the initial migration commits and hardening fails, keep the app unavailable; inspect actual objects/history before retrying. Do not rerun a successful initial migration blindly or edit remote history manually.

Before approved application, retain schema/ACL/function definitions and a verified backup appropriate to the actual plan. For an empty unused installation, an approved rollback may remove only the four app Storage policies, empty archive buckets via supported Storage operations, RPC, receipts/intents/revisions/assets/workspaces in dependency order, then helper/schema. Never use broad schema CASCADE, drop ensure_rls, or alter Auth/platform schemas. Do not delete Storage catalogue rows instead of actual objects.

After records exist, prefer forward repair. Dropping tables loses revisions/receipts/tombstones; a DB backup does not restore deleted Storage bytes. Preserve data and original objects before destructive recovery. Reverting session RLS restores the revoked-token read window. Prefer leaving the auto-RLS revocation in place; restoring the previous PUBLIC grant restores warnings and needs a deliberate rollback decision. Migration-history repair and destructive recovery require separate approval.

### Auth and Cost Constraints

Default hosted SMTP sends only to team-authorised addresses and is currently limited to two messages/hour. Remote Magic Links need approved mailboxes or separately approved SMTP setup; see [SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp).

Published [Free limits](https://supabase.com/pricing): 500 MB database, 1 GB files, 5 GB egress, 50,000 MAU, two active projects, pause after one week inactive. The actual Free plan was confirmed; remaining quota was not. One workspace permits 120 MiB active originals; staging/duplicate copies, retained revisions and repeated downloads use more resources. Workspace quotas are not account-wide spending caps. SMTP, hosting, overages or plan changes can have separate costs; no paid change is authorised.

## Git Handoff

No staging, commit, push, remote branch, PR, merge or tag was created. After explicit approval, meaningful commit groups are:

1. Auth/origin/cache fixes and route/config tests.
2. Session RLS, auto-RLS ACL, receipt/retry fixes and SQL/recovery tests.
3. Safe browser-test configuration and expanded real local-service scenarios.
4. Current verification, setup and remote approval/rollback documentation.

The source is ready for the next **real Supabase integration validation attempt**, not certified for operation. Docker/local credentials, real-service tests, hosted version/configuration checks and remote approvals remain the blockers.
