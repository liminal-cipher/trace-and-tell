# M1a Implementation and Verification

Reviewed 2026-10-29 (Asia/Seoul). Baseline: fetched `main` at `0b8edf9225c7347195180704cf4e0f6416e350b4`. This record describes the M1a source implementation and local verification. No remote migration, deployment, paid/model call, or account change was performed.

## Delivered Source

- Next.js App Router, TypeScript, Tailwind and Zod, with pinned dependencies and no ORM.
- Server-side email Magic Link / PKCE flow, HttpOnly session cookies, refresh proxy, verified Auth user checks, logout and same-origin mutation checks. Anonymous Auth accounts are rejected.
- Workspace creation, listing and compare-and-swap renaming; original typed notes; JPEG/PNG/WebP staged direct uploads; original retrieval; metadata and note revisions; confirmation before deletion.
- SQL transactions, owner serialisation, idempotency receipts, original-byte SHA-256 deduplication per workspace, immutable user-visible revisions and optimistic concurrency checks.
- A separate static read-only collection with original CSS illustrations and fictional notes. It reads no private tables, permits no writes and has no model endpoint.
- English responsive UI, labelled local previews, upload progress/failure/retry, database recovery controls, metadata history and a keyboard-accessible record dialog. Korean input is preserved.

The public illustration and note fixtures were created for this implementation. No external photograph, actual person, family record, or paid image/model service was used. The design follows the museum/archive direction described in the repository. The Figma connector reached its Starter-plan call limit before returning design context; exact visual comparison with the existing Figma frames was **not run**.

## Changed Files

| Area | Files |
| --- | --- |
| App pages and presentation | `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/demo/page.tsx`, `src/app/login/page.tsx`, `src/app/archive/page.tsx` |
| Auth / API routes | `src/app/auth/callback/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/archive/route.ts`, `src/app/api/archive/assets/[id]/file/route.ts`, `src/proxy.ts` |
| UI components | `src/components/archive.tsx`, `src/components/archive-image.tsx`, `src/components/record-dialog.tsx`, `src/components/login.tsx` |
| Server/domain code | `src/lib/archive.ts`, `src/lib/supabase.ts`, `src/lib/contracts.ts`, `src/lib/errors.ts`, `src/lib/image-validation.ts`, `src/lib/pagination.ts` |
| SQL / local services | `supabase/migrations/20261028155626_persistent_archive.sql`, `supabase/config.toml`, `supabase/.gitignore` |
| Tests | `tests/database.test.ts`, `tests/image-validation.test.ts`, `tests/recovery.test.ts`, `tests/e2e/public.spec.ts`, `tests/e2e/private.spec.ts`, `tests/server-only.ts` |
| Tooling / environment | `package.json`, `package-lock.json`, `tsconfig.json`, `next-env.d.ts`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `vercel.json`, `.env.example`, `.gitignore` |
| Documentation | `README.md`, `docs/m1a-implementation.md` |

`CURRENT_TASK.md` and the Next.js-generated `AGENTS.md` are local-only and excluded using `.git/info/exclude`.

## Data and Security Boundaries

The migration creates `workspaces`, `assets`, `asset_revisions`, `upload_intents`, and `command_receipts`. All five have RLS enabled and explicit grants. Authenticated users have owner-scoped read access; revisions become unreadable as soon as their asset leaves `active`. Storage keys and receipt payloads are not granted to client roles.

Client roles cannot write directly to the tables or execute `archive_command`. This preserves the revision, idempotency and quota invariants even if someone bypasses the app UI. Mutations use a **SECURITY INVOKER**, service-role-only RPC after `auth.getUser()` verification and user-scoped ownership checks. The RPC independently checks the supplied, server-derived actor against workspace ownership inside the transaction. There is no publicly executable SECURITY DEFINER function. The service key is also used for the narrowly defined Storage copy/read/cleanup operations; it bypasses RLS and therefore must remain server-only. The application never accepts an actor, bucket or storage path from a client command.

Both `archive-staging` and `archive-originals` are private buckets with a 6 MiB limit and a JPEG/PNG/WebP MIME allowlist. Restrictive Storage policies deny direct client reads, inserts, updates and deletes for these buckets even if another permissive policy exists. A server-issued signed upload capability permits only the allocated staging path. It cannot read private records or create an active Asset.

The browser receives a scoped upload URL, never a Supabase API key. Originals are served by an authenticated app route with a fresh RLS check before and after Storage I/O, plus `private, no-store` headers. There are no public original URLs or signed download links to outlive deletion. Bytes that have already been downloaded cannot be recalled.

## Upload, Retry and Deletion Contract

1. The server reserves one of 20 photo slots per workspace and records a 10-minute intent. Pending intents count towards the limit; expired ones are released. Typed notes do not consume photo slots.
2. The browser uploads directly to the staging bucket. The original is not active yet.
3. The server reads the stored bytes, checks the declared size, decodes the full image with Sharp, verifies actual JPEG/PNG/WebP format and rejects animated, damaged or over-24-million-pixel images. It hashes the unmodified original bytes; EXIF dates are not inferred or published.
4. The server copies to an immutable original path without upsert, then commits the Asset and first revision in a PostgreSQL transaction. If the copy succeeds and the transaction fails, retry checks the existing copy and can complete without overwriting it. Concurrent requests deduplicate inside the transaction.
5. Cleanup is separate from saving. A committed record stays saved when cleanup fails; the UI reports the pending cleanup. Rejected and expired intents remain recoverable state records. `Retry verification` can finish an upload after a browser refresh if its bytes arrived before expiry.

Supabase signed upload capabilities last **two hours**, independently of the app's 10-minute finalisation deadline. See the [official signed upload reference](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl). The app never renews finalisation time. A replayed capability can at most write its staging key; it cannot reactivate an expired, completed or deleted record. Cleanup keeps sweeping until the capability lifetime plus a five-minute margin ends. The actual token expiry and replay behaviour still require real Storage verification.

Deletion first commits `pending`, immediately blocking all original/revision reads. It then removes files and records `deleted` only after success. File removal errors leave the record visibly pending. Tombstones and revision rows remain in the database but are no longer readable through the user API. This is an access-blocking deletion workflow, not a claim that every retained database byte is erased.

Cleanup runs after finalisation/deletion and through the owner's `Retry file cleanup` control. There is no background scheduler in M1a. Abandoned staging files remain private until cleanup is requested. No remote cron or hosting configuration was installed.

## Local Integration Setup

The app can be built and the default tests can run without Supabase. Real private-archive tests need a disposable local Supabase stack, Docker, and its local credentials.

1. With Docker running, use the pinned CLI's `npx supabase start` from this repository. It reads `supabase/config.toml` and initialises the local database from the migration. Do not link the repository to a remote project for this test.
2. Place local credentials in ignored `.env.local` using the variable names in `.env.example`. Do not print them or put them in shell history. For Playwright's test process, provide the same names as process environment variables using your local secret mechanism; Next.js reads `.env.local` itself, but Playwright does not automatically load it.
3. Set `APP_ORIGIN` to `http://127.0.0.1:3000` for browser tests. Local redirect allowlists are already in `supabase/config.toml`.
4. Set `RUN_LOCAL_SUPABASE_E2E=1`. Optionally set `LOCAL_MAILPIT_URL` if the local email capture server is not `http://127.0.0.1:54324`.
5. Run `npm run build` and `npm run test:e2e`. The private test refuses non-loopback Supabase and mailbox URLs. It generates synthetic test accounts and records in the disposable stack; no external email is sent. It does not apply a migration itself.

The private suite requests a real email Magic Link through the UI, reads it from local Mailpit and follows the PKCE callback in the same browser. It then covers workspace/note revisions, photo upload/retrieval, corrupt/oversized/duplicate files, stale concurrent edits, retry keys, two-user API/Data API/Storage isolation, intent expiry, deletion and logout. Generated test data remains in the disposable local stack for inspection. Natural two-hour upload-token expiry, app-server restart with private data, and network-level failure cases require the additional checks below.

Useful read-only local checks after the stack is running: `npx supabase migration list --local` and `npx supabase db lint --local`. Neither was run successfully in the current environment because Docker/local services are unavailable. Remote advisors and migration history were not queried.

## Verification

| Command / check | Result | Evidence and limit |
| --- | --- | --- |
| `git fetch origin main` + branch/status inspection | passed | Target is `liminal-cipher/trace-and-tell`, clean `main` before edits; HEAD equals fetched `0b8edf9` |
| Shared policy comparison with fetched agents-sync main | passed | Local policy matches `c91797e`; project contained no AGENTS.md initially |
| `npm install --save-exact …`, pinned dev dependencies | passed | Lockfile generated; no ORM or model SDK |
| `npx supabase migration new persistent_archive` | passed | Local migration file generated by pinned CLI; no remote application |
| `npm run test` | passed | 21 tests: image decoding/input limits, unchanged migration in PGlite PostgreSQL, RLS/grants, revisions/deduplication/quotas/deletion/restart, HTTP failure injection and response pagination |
| `npm run typecheck` | passed | Strict TypeScript |
| `npm run lint` | passed | No errors or warnings after fixes |
| `npm run build` | passed | Production Next.js build; environment remains unconfigured |
| `npx playwright install chromium` | passed | Chromium available |
| `npm run test:e2e` | passed / not run | 6 public/configuration-boundary checks passed across desktop and mobile; 2 private-stack cases skipped |
| Production browser screenshots | passed | Desktop and mobile synthetic demo inspected; no horizontal overflow |
| `npm audit --omit=dev` | passed | Zero reported production dependency vulnerabilities at execution time |
| Browser bundle scan | passed | No Supabase environment identifiers or privileged server helper in `.next/static` |
| `git diff --check` | passed | No whitespace errors in tracked changes |
| Real Supabase Magic Link/session/refresh, RLS and Storage | not run | No Supabase environment credentials and no Docker executable available |
| Real private browser journey and app-server restart | not run | Needs the real local stack or separately approved remote setup |
| Actual signed-token expiry/replay and remote security advisors | not run | Needs real Supabase services; not inferred from SQL tests |
| Figma frame comparison | not run | Connector plan call limit |

Earlier checks failed on an obsolete Vitest `describe.sequential` call, an effect lint check, and a browser assertion that counted the Next.js development toolbar. These were corrected; the final browser suite runs the production server. There are no unresolved failures in the checks that were executable. Passing the default suite does **not** certify the private archive as operational.

PGlite executes the migration's actual SQL with test-only stand-ins for Supabase's Auth helpers and Storage catalogue. Its restart test closes/reopens a disk-backed database and rechecks data/RLS. It does not run GoTrue, PostgREST or Storage HTTP and does not establish real multi-connection concurrency. Recovery tests inject failed HTTP responses into the real Supabase client; they are deliberately labelled fault-injection tests, not hosted integration results.

## Remaining Acceptance Gates

- Run the private browser suite against the real local stack and correct any service-specific failures. Check session refresh/expiry, cross-user read/write/delete denial and privileged-key exclusion with configured credentials.
- Verify native signed-upload token expiry, replay after finalisation/deletion, wrong-path use, and cleanup after capability expiry. Confirm bytes cannot be changed with an upsert header on a non-upsert capability.
- Stop and restart the Next.js server with saved private data, then reopen originals, names, notes and revision history. Repeat with browser refresh and simulated interrupted uploads.
- Inject Storage deletion failures in the real service and verify immediate access blocking, visible pending status and successful cleanup retry.
- Obtain separate approval before applying `20261028155626_persistent_archive.sql` to the existing remote project. Inspect that project's policies/grants and migration conflicts first. Auth callback/SMTP changes and deployment each require their own applicable approval.

M1a source is implemented, but M1a operational acceptance remains **open**. M1b+ observation/hypothesis/question/testimony/exhibit features and all Meta calls are absent.
