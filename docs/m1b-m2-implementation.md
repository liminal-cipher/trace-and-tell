# M1 Stabilisation and M2 Preparation

Reviewed 30 October 2026, Asia/Seoul. **M1 service acceptance and M2 live acceptance remain open.** The investigation flow works in local software tests. Actual Meta calls are prohibited by the current instruction and have not been made.

## Git and Approved Remote Work

Started on `main`, `7856a44caaeb4d699e121b3eb75880031d064f40`, with the previous audit's 25 uncommitted files. Fetched origin and verified the latest shared policy. Re-ran all 48 audit tests successfully before creating these authorised commits:

| Commit | Change |
| --- | --- |
| `67b1a99` | Auth origins, cookies, callback and refresh headers |
| `c3c0ec2` | Session RLS, auto-RLS privileges, receipts, pagination and recovery |
| `9923f4b` | Safe browser-test configuration and service scenarios |
| `6b39ca8` | Audit evidence, setup and remote approval plan |

Pushed those commits to `origin/main`. A second fetch confirmed local and remote HEAD `6b39ca891a3c898fe841589509fa432982e4a04a`, with exactly the 25 expected changed paths. At the subsequent closeout, the user explicitly authorised committing and pushing the new M1/M2 work: 32 new and 8 modified files. This report is included in that closeout. No deployment, branch, PR or tag was created.

The user then approved the two M1 migrations and bounded synthetic service tests, but explicitly withheld permission for actual Meta calls and the new M2 migration. Target: **trace-and-tell / svwzgtsjwcvncxyvdhho / Seoul**, PostgreSQL **17.11.0.003**, ACTIVE_HEALTHY.

Immediately before applying SQL, origin/main and both files were rechecked. The remote had no public app relations, buckets, policies or migration history. Its auto-RLS function/trigger matched the audited shape. Both approved files applied successfully, in order:

| Local migration | Connector-assigned remote version | Canonical SQL MD5 |
| --- | --- | --- |
| `20261028155626_persistent_archive.sql` | `20261029165946`, `persistent_archive` | `1ebe32fdc075db7f8665ceabc3285469` |
| `20261029150829_m1a_security_hardening.sql` | `20261029165951`, `m1a_security_hardening` | `cd46ee17c02910620d02dd9acf0c03c2` |

Stored migration statements matched the local files after CRLF and trailing-newline normalisation. These hashes establish content equality, not a security signature. **The connector assigned different version timestamps. Do not run `supabase db push` against this project: it may attempt the original local versions again.** No history repair was performed. Reconcile the mapping under a separate explicit history-change approval before using CLI migration deployment.

Post-application checks passed:

- All five M1 tables have RLS; anon cannot SELECT and authenticated cannot INSERT/UPDATE/DELETE directly. Receipts are inaccessible to clients.
- `archive_command` is SECURITY INVOKER and service-only. The private session helper retains its narrow policy scope.
- Both buckets are private, restricted to JPEG/PNG/WebP and 6 MiB. Four restrictive Storage policies deny ordinary client operations.
- anon/authenticated can no longer execute `rls_auto_enable()`. `ensure_rls` remains enabled with its original three event tags. Real PostgreSQL CREATE TABLE, CREATE TABLE AS and SELECT INTO probes acquired RLS; the transaction was rolled back.
- Real SQL role probes denied anonymous workspace reads/RPC and authenticated receipt reads/RPC. These are PostgreSQL checks, **not** PostgREST/Auth/Storage HTTP tests.
- Security Advisor no longer reports 0028/0029. Its only returned item is informational [RLS enabled without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) for intentionally service-only `command_receipts`.
- Checked app counts: workspaces 0, assets 0, app objects 0. No Auth settings or test users were changed. There was no test data to clean up; schema and empty buckets remain.

## Implemented Product Flow

Open a workspace in Archive, then **Open investigation**. `/investigation?workspace=…` is the same UI for fixture, replay and meta-live. `/demo` remains static and read-only. There is no alternative fixture application or browser-local persistence substitute.

1. Select one source, request observations, compare the original, correct or reject, then save. An image fixture explicitly says it does not perform image reading; the user can supply a reading. Typed-note fixtures quote the note. Original suggestions and corrections remain separate.
2. Select two sources, inspect a tentative connection or `no_connection`, supporting/contrary/missing evidence, select it for inquiry, then select/edit a question. Inquiry selection never makes the hypothesis a fact.
3. Record a speaker's text, unknown, declined or conflicting account. The server supplies the authenticated recorder. Select testimony to save a template exhibit, reopen it and open its exact source revisions.

The authored comparison fixture recognises the synthetic ORBIT 47 marker or returns `no_connection`. This is software test data, not a visual model or general-purpose inference algorithm. The live adapter uses the same schema, checks and persistence flow.

### Storage and Trust Boundaries

`supabase/migrations/20261029165416_investigation_flow.sql` is **local only and not approved remotely**. It creates `investigations`, immutable `investigation_versions`, `investigation_runs` and a service-only invoker RPC. Typed entities live in one versioned workspace document, rather than a table per proposed logical entity. All tables have explicit grants and workspace/session RLS. No ORM or dependency was added.

- Online Auth supplies the actor; browser-supplied actor, roles, document state and paths are discarded.
- Source ID, revision, workspace and deletion state are checked before processing and again under the same actor/workspace lock as Archive mutations. Late responses cannot revive changed/deleted originals.
- Document compare-and-swap and receipts handle conflicts and duplicate submissions. This slice is bounded to 200 entries / 1 MiB per document; history is retained.
- Kind, review state and evidence validity stay separate. Corrections propagate `needs_review`; deletion produces `invalidated` and broken links. Propagation follows kind dependencies even when an older exhibit references newer testimony.
- Analysis identity uses source/observation revisions independently of provider. Re-running the same evidence cannot silently restore rejected suggestions. Revised originals or corrected observations provide a new context.
- Exact historical resolution is owner-scoped and does not substitute current testimony for an older quotation. Deleted originals disable the reference.
- Raw runs, input references, prompt/schema versions, usage, latency and failures are separate from human corrections. SQL stores image hashes/references, not image copies. Unconfirmed runs older than two minutes display `unknown_outcome` and are not automatically retried.
- Private responses are no-store; keys/transport are server-only. Session errors clear private UI state. Live input preparation rotates/resizes to at most 1024×1024 and re-encodes PNG without EXIF; Archive originals stay unchanged.

Local checks found and corrected an initial React effect lint failure, an evaluation-plan syntax error, an evaluation config that included the unit suite, insertion-order-dependent invalidation, and ambiguous attribution of unreviewed suggestions as human readings. The attribution correction adds review state/provider to input and advances the prompt from `archive-evidence-v1` to `archive-evidence-v2`. No measured model-quality improvement is claimed.

## Provider and Evaluation Preparation

Official sources inspected on 30 October 2026:

- [API reference](https://dev.meta.ai/docs/api-reference): bearer `MODEL_API_KEY`, `https://api.meta.ai/v1`.
- [Models](https://dev.meta.ai/docs/models): Muse Spark 1.3 is a documented image-understanding candidate. **Account access is unverified.**
- [Chat schema](https://dev.meta.ai/docs/api-reference/chat-completions/schemas): structured output, completion limit including reasoning, usage and finish reason.
- [Vision](https://dev.meta.ai/docs/image-understanding), [structured output](https://dev.meta.ai/docs/structured-output): inline PNG and JSON Schema. Shape validity does not prove factual correctness.
- [Pricing](https://dev.meta.ai/docs/pricing-rate-limits): Standard uncached input $1.25 / million tokens, output $4.25 / million at inspection. Reverify price and entitlement before use.

The adapter uses native fetch, no new SDK, no tools/external image URLs, `store:false`, a 45-second deadline, at most two 512 KiB PNGs, 6,000 text characters and 1,200 completion tokens. It validates actual model, finish reason, response size, JSON and references. No fixture fallback or automatic retry exists.

Server-only variables are `MODEL_API_KEY`, `META_LIVE_APPROVED` and `META_APPROVAL_FILE`. Defaults are closed. The ignored allowance JSON requires an ID, Standard model, verified catalogue/price dates, expiry, request/cost caps and exact approved input hashes. Catalogue entitlement is an operator preflight, not inferred from a key. Exclusive reservations and immutable settlement files are shared by the local app and evaluation runner. A conservative $1.32 reservation covers the documented full context/output ceiling; returned usage settles at uncached rates. Unknown cost/outcome stops further calls. Calculated token cost is not an invoice or account-wide billing cap.

**Live deployment remains blocked:** the file ledger refuses Vercel's ephemeral filesystem. A reviewed durable shared allowance store is needed before live use on multiple hosts or Vercel. Never copy/reset an allowance or allocate its budget twice. Catalogue API requests also count against the approved overall request cap; this runner does not make them automatically. No allowance has been authorised or created for real calls in this task.

Replay accepts only a recorded meta-live response with matching input and preserves its model/prompt/schema provenance. No real live replay record exists. Mock transport tests do not establish one.

### Synthetic Corpus and Runs

Six original PNG graphics in `tests/fixtures/model/inputs/` cover readable, shared, unrelated, illegible and contradictory cases. Neutral filenames, no EXIF, people or family records. `ground-truth.json` is never imported into provider input. Three development cases and two heldout cases remain separate. These simple graphics do not establish quality on old photos, handwriting or Korean text.

```powershell
npm run corpus:create
$env:EVALUATION_COUNT='3'
npm run evaluate
$env:EVALUATION_SPLIT='heldout'
$env:EVALUATION_COUNT='2'
npm run evaluate
```

Default provider: fixture. `EVALUATION_PLAN_ONLY=1` writes input hashes and request-limit checks without provider calls. Any later approved live attempt starts with one case after catalogue/price confirmation. Environment values are not spending permission.

Each run creates a new UUID directory under ignored `evaluation-results/`: source IDs/revisions/hashes, provider/model, prompt/schema, raw response, structural result, latency, usage/cost, failure and pending semantic-review fields. Files use exclusive creation; earlier records are not overwritten. Live failure stops the batch.

```sh
npm run evaluate:compare -- evaluation-results/<baseline> evaluation-results/<candidate>
```

Comparison requires identical cases, hashes, split, provider and model; only one prompt/schema version may change. It counts structural validity with a denominator and leaves semantic judgement to a separate attributed human review of visible grounding, forced connections, abstention and leading questions. Preserve corrections/reviewer notes as an additional artefact, not a rewrite of the raw run.

Observed fixture results: development **3/3 structurally valid**, heldout **2/2 structurally valid**. Semantic quality: **not assessed**. Paired fixture runs exercised the comparison tool; they are not a live baseline/improvement experiment. Actual Meta requests **0**, Meta spend **$0 (no requests)**. The proposed 20-request/$5 allowance was **not approved**, so there is no active remaining live budget to report.

## Verification and Acceptance

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Audit regression before commit | passed | 48 tests |
| `npm ci` | passed | 409 packages installed; 0 reported vulnerabilities. ESLint 9 support warning and optional unrs-resolver install-script warning remain |
| `npm run test` | passed | 67 tests / 12 files, 14.52 seconds. References, revisions, rejection, propagation, owner/GRANT/RPC, receipts, budget and target gates |
| `npm run typecheck`, `npm run lint`, `npm run build` | passed | Final code, including private API/page and evidence resolver |
| `npm run test:e2e` | passed / not run | Final code: 8 passed, 2 skipped, 21.8 seconds. 6 public + 2 investigation UI/PGlite journeys; 2 real Supabase private journeys not run |
| PGlite restart | passed | Disk database close/reopen and browser reload; not an app/Supabase service restart |
| Screenshots | passed | Three slices on desktop/mobile; synthetic only, ignored `test-results/` |
| `npm run evaluate`, `npm run evaluate:compare` | passed | v2 development 3/3, heldout 2/2, plan-only check; v1/v2 comparison paired 3 development cases. Structural checks only, no semantic accuracy claim |
| `npm audit --omit=dev` | passed | 0 reported vulnerabilities |
| `git -c core.safecrlf=false diff --check` | passed | No whitespace errors |
| Browser bundle symbol scan | passed | No service-key/provider-key/allowance symbol matches in `.next/static`; unconfigured build, not proof about populated secret values |
| Remote M1 SQL/advisors | passed | PostgreSQL 17 evidence above |
| Docker/Supabase/Mailpit | not run | Docker unavailable; no global install |
| Remote email/PKCE, real app sessions, A/B HTTP isolation, Storage, app restart | not run | Secure credentials and two authorised test mailboxes not supplied at last check |
| Hosted Storage patch version, natural expiry, HTTPS/CDN | not run | External service gates remain |
| Actual Meta catalogue/inference/quality/live product E2E | not run | Key issuance pending; calls explicitly prohibited |
| Remote M2 SQL / deployment | not run | Not approved |

Final executable checks have no unresolved failures. Earlier lint and evaluation setup attempts failed, were corrected and then passed; those failures are described above rather than counted as successful initial attempts. Desktop/mobile screenshots were inspected after the final browser run. Human acceptance and actual service acceptance remain separate.

| Acceptance | Status | Scope |
| --- | --- | --- |
| M1 schema/privileges/private bucket configuration | verified | Applied to approved project |
| M1 login → photo/note → revise → app restart | blocked | Actual services need credentials/mailboxes |
| M1 two-user Auth/PostgREST/Storage isolation and deletion | blocked | SQL ACL checks pass; HTTP/user journey pending |
| Public demo separation | verified | Source and public browser checks |
| Observation → review/rejection → save | verified locally | Real UI/domain/SQL; test Auth/HTTP boundary |
| Comparison/no connection → inquiry → question | verified locally | Authored fixture, not model quality |
| Testimony → source-linked exhibit → reopen | verified locally | Unknown/declined/conflicting branches; exact revisions |
| Correction/deletion/late-result/rejection integrity | verified locally | Domain and SQL evidence |
| M1b complete real Supabase UI/server/services journey | blocked | New SQL unapplied; actual integration pending |
| M2 live and quality acceptance | blocked | Explicit no-call instruction and missing key |

## Bounded Remote M1 Procedure

The existing local-only `RUN_LOCAL_SUPABASE_E2E` guard is unchanged. `npm run m1:remote:preflight` is a separate **read-only target-locked preflight**, not a completed remote E2E runner. It requires `RUN_APPROVED_REMOTE_M1=svwzgtsjwcvncxyvdhho`, exact project URL, loopback APP_ORIGIN and credentials. It refuses existing app data/unexpected buckets and prints no keys/record contents. Refusal logic is unit tested; remote execution has not run.

The approved supervised service procedure remains:

1. Supply the three Supabase variables through ignored `.env.local` and two user-controlled, permitted addresses. Never paste session/Magic Link values into chat/logs. Recheck schema/data and stop on anything unexpected.
2. Inspect existing SMTP/template/security settings without changing them. If necessary, add **only** `http://127.0.0.1:3000/auth/callback` to the redirect allowlist. Respect email limits; initially send only one message per approved address. Each PKCE link opens in its requesting browser.
3. Maintain an ignored manifest of exact IDs created by this run. Limit: two new synthetic accounts, three workspaces, 20 MiB aggregate files. Do not adopt/delete an existing same-email user. Stop on quota uncertainty or security failure.
4. In the actual app, create workspace/photo/note, reopen original and metadata, revise, reload, stop/restart the app, reopen. Test second-user/anonymous direct IDs, reads/writes/deletion/RPC/Storage; duplicates, stale edits, invalid images and immediate deletion denial. Record each actual result without Auth traces/video.
5. Sign out/revoke test sessions, then remove only manifested objects/rows/new accounts after checking ownership. Preserve schema/buckets and pre-existing material. Stop/report cleanup failures; no broad deletion. A DB backup cannot restore deleted object bytes.

No email-login or remote mutation automation is silently substituted. Actual delivery, PKCE and Storage are untested until setup is supplied. M2 development proceeded independently.

## Changed Areas and Next Decisions

- Investigation contracts/domain/service, API/evidence routes and SQL: typed entities, versioned writes, source resolution and run records.
- Model fixture/provider/budget modules: interchangeable providers, bounded HTTP and local allowance.
- Investigation/evidence components, page, Archive link, CSS/proxy: responsive English slices and private session refresh.
- Domain/route/provider/target tests, PGlite support and browser test: local evidence with explicit service limits.
- Scripts, synthetic fixtures, evaluation config, package scripts, environment example and ignore rules: repeatable evaluation/setup. No dependency/lockfile additions.
- README, M1 audit update and this report: current evidence and remaining gates.

Required inputs: secure Supabase configuration and approved test mailboxes, already requested. The closeout authorises only the current commits/push. It does not authorise remote Supabase changes, migration repair, M2 SQL, Meta calls or deployment. Earlier bounded M1 approval and its constraints are recorded above; re-establish the next session's scope before external work.

## Next-Session Handoff

1. Fetch current main, read this report and inspect the actual environment. Local-only `CURRENT_TASK.md`, `AGENTS.md`, credentials, screenshots and evaluation outputs are not portable Git artefacts. Run `npm ci` as needed; build before browser tests. Confirm Docker availability without installing global software automatically.
2. Prioritise actual M1 acceptance. Supabase URL/publishable/service keys were not populated in ignored `.env.local`; two user-controlled, mail-policy-permitted test addresses were not supplied. Never print or commit them. Reconfirm external-work scope and read-only remote state before using the bounded procedure. Do not disable the local-only E2E guard.
3. Resolve migration history only with explicit approval. Preserve the exact content/version mapping above. Remote M2 SQL remains unapplied; fixture UI cannot persist investigations against the current remote M1-only schema. Obtain separate approval and test the complete Auth → server → database/Storage journey before declaring M1b accepted.
4. The user reported a Meta Model API key-generation error and an open support ticket. Its resolution and account model entitlement have not been verified. Actual calls remain zero. Supply `MODEL_API_KEY` securely only after resolution; separately approve inputs/request/cost limits and reverify official catalogue/pricing before one live case. No semantic baseline or improvement has been measured.
5. Figwright follow-up is a plan, not completed design validation: confirm the installed integration connects and identify the intended Figma file/frame; compare the three implemented slices and desktop/mobile screenshots with the museum/archive direction. Record concrete differences before editing. If unavailable, review the running app and existing Figma references without adding conversion tools or blocking functional acceptance. No Figwright-assisted review is claimed for this closeout.
6. Vercel is not deployed. Shared durable budget enforcement for live deployment is not implemented; the local ledger intentionally refuses Vercel. Audio, long-form generated stories, complex graphs and 3D remain outside this slice. Keep synthetic-only inputs, no face/kinship inference, no personal family records and no paid calls without explicit spending approval.

Closeout checks repeat the unit suite, TypeScript, lint, production build and browser E2E. Earlier evidence remains separated from actual service acceptance in the matrix above. Git history supplies the final closeout commit IDs; no claim of remote DB/model work is implied by publishing code.
