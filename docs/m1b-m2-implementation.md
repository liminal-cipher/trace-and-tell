# M1 Stabilisation and M2 Preparation

## Real-world input validation follow-up — 3 November 2026

The shared image pipeline now prepares bounded, metadata-free, lossless PNGs
(up to 2048px and 8 MiB) instead of imposing the old 512 KiB experiment cap.
Originals, source revisions, prior runs and budget rules remain unchanged.
All 23 preview editions and 35 payloads pass offline preparation; 23/23 retain
normalised decoded pixels. Rights review excludes five images, leaving 18
images/eight pairs eligible. None has been sent to Meta or human-scored.
See [the evaluation report](real-world-evaluation.md) for licence decisions,
remaining legibility limits, the ten-request approval proposal and fresh tests.
The previous M2-A unsupported compression explanation and M2-B empty questions
remain documented failures; no general real-photo accuracy claim is supported.

## Submission readiness sprint — 3 November 2026

The inherited human-question implementation and completed hosted acceptance
below were reviewed and retained. No hosted acceptance or cleanup was rerun.
The public `/demo` now presents sources → actual Meta excerpts → human question
→ invented testimony → gallery, with static source/revision links and explicit
labels. M2-A observation/correction and M2-B comparison are separate runs.
Public aliases replace private identifiers. The new [submission packet](submission-readiness.md)
contains the description, architecture, shot list, evidence and release gates.

### Defects corrected in this sprint

- The main navigation could prefetch the private archive while displaying the
  public demo. Archive prefetch is now disabled; the public browser journey
  checks for private/API/external requests and writes.
- The browser test environment cleared Supabase but could inherit live-model
  credentials/approval. It now explicitly blanks the key/allowance and sets
  live approval to `no`. An optional validated local port keeps tests away
  from an existing development server; the first run correctly refused busy
  port 3000, and subsequent runs used 3100 without stopping that server.
- Testimony/exhibits following an AI/fixture question inherited the parent's
  provider attribution. A new assertion reproduced the failure before the
  fix. New saves now have human origin and null model/run fields, retaining
  exact parent provenance. Legacy stored entries remain untouched; current
  and historical UI labels explain human authorship and inherited metadata.
  This is a local fix, not a new remote acceptance claim.

### Fresh verification in this sprint

| Check | Result / evidence boundary |
| --- | --- |
| `npm test` | PASS: final 91 tests / 15 files. Earlier sprint run passed 90 before adding the test-port boundary case. |
| Focused defect/human/security regression | PASS: 28 tests after the reproduced testimony-attribution failure was fixed. |
| `npm run typecheck` | PASS after final application changes. |
| `npm run lint` | PASS: zero errors; two pre-existing warnings in protected `.local` files, left unchanged. |
| `npm run build` | PASS with Supabase/model credentials blank and live disabled in the build process; `/demo` prerendered static. |
| `PLAYWRIGHT_PORT=3100`, `RUN_LOCAL_SUPABASE_E2E=0`, `npm run test:e2e` | PASS: final 10 desktop/mobile tests; 2 local Supabase tests deliberately SKIPPED. Includes human questions, existing Investigation, server/PGlite restart, public journey and API boundary checks. |
| Public browser checks | PASS: direct route/hash access, reload, image decode, labels, keyboard anchor/Enter disclosure, all source targets, no horizontal overflow, no page errors and no private/API/external/write requests during the tested journey. |
| Visible UI | Assistant inspected desktop/mobile full-page captures and mobile opening/gallery captures. This is not user acceptance or a full screen-reader audit. |
| Build/private scan | PASS: 788 build/public files checked against 3 existing configured secret values; no matches. Public module/page and generated demo HTML/RSC contained no UUID/private-project URL/token pattern matches. This is a bounded scan, not proof against every possible secret. |
| Protected local inventory | PASS: all 89 inventoried files in PLAN.md, .env.local, .local and evaluation-results retained SHA-256 hashes. CURRENT_TASK.md was intentionally updated separately. Prior private chat outputs were only read, not staged. |
| `git diff --check` | PASS. |

Tests ran against the local production build and disposable PGlite. HTTP Auth
is mocked in Investigation browser flows; unconfigured anonymous API browser
requests return 503 rather than exercising a live signed-out Supabase session.
Route unit tests separately exercise 401 denial. These facts do not replace
the previous real single-user Supabase evidence or prove real A/B security.

### Security review and deployment decision

| Scope | Current conclusion |
| --- | --- |
| Anonymous / foreign workspace or source | Local route/SQL tests pass; caller comes from online Auth, reads require ownership/RLS, command functions recheck it. Real two-user hosted isolation remains BLOCKED on approved accounts/environment. |
| Forged author/model/run/source input | Command parsing strips untrusted provenance; human questions derive actor and references server-side. Unit/route/SQL regression passes. |
| Old revisions / deletion / concurrency | Existing local tests reject stale/deleted sources and stale saves, preserve snapshots, deduplicate identical receipts and reject altered retries. Source changes propagate `needs_review`/`invalidated`. |
| Failed model request / allowance | Provider tests use mocked transport and temporary test ledgers. Failure/unknown outcome blocks further use without fixture substitution. Existing real ledgers were not modified. |
| Cookies/cache/headers | Code uses HttpOnly, Lax, HTTPS-dependent Secure cookies, online `getUser`, private/no-store API responses and security headers. Local assertions pass. Real HTTPS/CDN and old token/capability replay remain BLOCKED; no production security claim. |
| RLS / privileged code | Inspected existing migrations: RLS and explicit grants; service-only invoker commands; private session helper with fixed search path and auth.sessions check. No user-editable metadata authorisation found. No migration or remote policy change. |
| Public disclosure | Demo imports only curated static evidence and local image. Private archive prefetch removed. Runtime request checks and bounded output scan pass. |
| Hosted storage/failure paths | Existing interrupted-upload, capability replay and patch-level confirmation gates remain open. No remote cleanup or adversarial test was run. |

Current [Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs)
and [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
were consulted for the review. Local tests are not a hosted security audit.
Prefer a separately reviewed, credential-free synthetic demo deployment for the
deadline. Do not expose the complete private app before the remaining gates;
Meta Live also needs an approved durable ledger design on serverless hosting.
Neither candidate was deployed. No new Meta call, paid request, remote data
mutation, Auth change, submission or repository visibility change occurred.


## Human-authored questions — hosted acceptance, 3 November 2026

The separately authorised Edge user journey passed against the existing M2-B
workspace and hosted Supabase at 18:24–18:27 KST. Local main and freshly fetched
origin/main both remained `5a1d14092a7148df486a5a1443dfb7af4a12371d`.
The uncommitted implementation was rebuilt and served locally with Meta live
approval disabled. No analysis, replay, new Model Run or migration occurred.

Exactly five successful user saves were performed, without retries:

| Save | Investigation revision | Result |
| --- | --- | --- |
| Use for inquiry | 1 → 2 | Existing candidate accepted; hypothesis revision 2 |
| Save my question | 2 → 3 | One human-authored question, revision 1 |
| Select question | 3 → 4 | Question revision 2, selected |
| Save testimony | 4 → 5 | One explicitly invented acceptance-test response |
| Save exhibit | 5 → 6 | One exhibit citing that testimony revision 1 |

Question `866026f8-19a6-43f6-9427-2062bed50581` asks “What do you know about
the markings ORBIT 47 and BLUE TICKET?” Its recorder matches the authenticated
account and workspace owner recorded in the five command receipts. It has
`mode=human`, `model=null`, `run_id=null`, and points to hypothesis
`f9207ecb-a391-458d-9c8e-ce49441de027` REV2 and both original Source REV1s.
The original model's empty question list is still honestly displayed.

Testimony `964a05dc-2e45-4203-b9dd-2578e7245fbb` uses speaker label
“Synthetic acceptance speaker” and explicitly says it is invented, not a real
person's testimony. The form's default `heard_directly` value is retained;
the synthetic label and words define the test context. Exhibit
`1a720e9f-044e-49ad-8550-44279ddca47c` cites only that testimony REV1.
Both new entries have human origin and null model/run attribution.

Browser refresh and an owned local app-server stop/start retained all entries.
The UI reopened the exact parent hypothesis REV2, original human question REV1,
both source references, and the exhibit's testimony REV1. Database requery
confirmed Investigation REV1–REV6 and five additional receipts. All earlier
version rows remain unchanged. The hypothesis changed only its review state
and revision; wording, evidence, uncertainty and model provenance are intact.
The original Meta Run, including its saved response, is unchanged.

One separately authorised **Retry file cleanup** action changed only expired
intent `12d7d6d0-3cc3-4a5e-957e-33cc3efc554d` from cleanup pending to done.
All six intents now have cleanup done; pending cleanup and staging objects are
zero. All three original objects remain, with identical metadata and downloaded
SHA-256 hashes before and after. Workspaces, assets, Source revisions, other
Investigations and the inspected Auth account identity records are unchanged.
The 106 protected local files, including environment, plan, handoff, allowance,
ledger and prior acceptance artefacts, retained their hashes.

This is new hosted single-user integration evidence, separate from the prior
90 local tests and desktop/mobile Playwright results below; those suites were
not rerun here. The current production build passed. No additional A/B user
isolation, adversarial security, failure-path or model-quality claim follows
from this acceptance. Existing limitations remain open. M2-C, Git publication
and deployment were not performed. The earlier hosted procedure below is the
historical proposal fulfilled by this separately approved acceptance.

## Human-authored questions — local follow-up, 2 November 2026

The preceding, separately approved M2-B live comparison succeeded with
`muse-spark-1.3` Standard and returned a grounded shared-wording candidate,
valid references to both REV1 sources, and `questions=[]`. Run
`e5276e0b-40bc-4bcd-aeb7-cc2dbb802bf6` belongs to workspace
`1b1becf7-123c-4251-b0e5-8f6745c69334`. That prior live result is the
motivation for this change, not a live verification of the new feature.
No remote data or Model Run was changed by this local follow-up.

After reviewing a current hypothesis and choosing **Use for inquiry**, the
record keeper can write **Your question**, save it, and choose **Select
question** to record text testimony and compose an exhibit. The hypothesis
continues to display **No questions were supplied with this hypothesis**
when the original response supplied none; adding a human question does not
rewrite that history. The flow also permits an accepted `no_connection`
hypothesis without turning it into a supported connection.

### Provenance and storage

- The new `ask` command contains hypothesis ID, exact hypothesis revision
  and trimmed question text (1–2,000 characters), plus the existing workspace,
  expected Investigation revision and retry key.
- The server derives the actor from online Auth. Client-supplied sources,
  author, model, mode, run ID and document are discarded by command parsing.
- The domain requires a current, accepted hypothesis and active, current
  sources in the same workspace. It copies the exact source references and
  links the question to the accepted hypothesis revision.
- A new question has `mode=human`, `model=null`, `run_id=null` and
  `details.recorder` set to the authenticated actor. It starts unreviewed.
  The UI and historical evidence viewer label it **human-authored** and
  explicitly state that no model generated it. Its parent remains the route
  to the original model provenance.
- Human is an entry origin, not a provider mode. The model selector,
  `analysisSchema`, prompt, provider requests and Model Run table remain
  unchanged. Existing fixture/replay/meta-live entries remain readable.
- The existing non-analysis save path stores the new JSONB entry through
  `investigation_command`. It performs no provider call and creates no Run.
  SQL rechecks workspace ownership, source revisions and the expected
  Investigation revision under the existing lock. It stores the current
  document, an immutable version and an idempotent receipt in one transaction.
- Repeated identical request keys return the receipt without another version;
  changed payloads and competing stale revisions are rejected. A new key
  deliberately creates a new question; this is request idempotency, not
  semantic deduplication of differently submitted questions.
- Correction preserves the human question's first wording and recorder.
  Previous question revisions can be reopened. Selection explicitly binds
  a reviewed current parent revision. Corrections or rejection of the
  hypothesis mark dependent questions/testimony/exhibits for review;
  unavailable originals invalidate them. Source revision changes are not
  silently rebound. Existing AI question correction and testimony/exhibit
  flows remain available.

No new dependency, SQL migration, table, RLS policy or RPC definition is
required. This uses the existing JSONB document and revision mechanism;
PostgreSQL supports structured querying and storage within JSONB
([Supabase JSON guide](https://supabase.com/docs/guides/database/json)).

### Why no model question appeared

`SYSTEM_PROMPT` says that questions must be open and avoid unverified
assumptions, but does not explicitly require at least one comparison question.
`analysisSchema.questions` has `.max(3)` and no minimum.
`validateAnalysis` requires a comparison connection and no observations;
it does not reject an empty question list. `importAnalysis` only imports
questions actually returned, so the former UI had no question to select.
These are verified code-level conditions allowing the observed result.
They do not establish the model's internal reason for choosing an empty list.
The actual result ended with `finish_reason=stop`, so it was not reported
as a truncated completion. No prompt/schema change or paid experiment was
performed to test an alternative.

### Local verification and limits

Initial local main and fetched origin/main both pointed to
`5a1d14092a7148df486a5a1443dfb7af4a12371d`; only the existing untracked
`PLAN.md` was present. That plan, prior allowances/ledgers, environment
file and acceptance/evaluation artefacts are preserved.

| Check | Result |
| --- | --- |
| Focused domain, SQL, route and correction suites | 28 tests passed |
| Full unit suite | 90 tests across 15 files passed |
| Human question contracts and provenance | Empty/oversized text, stale/wrong-kind/unaccepted parents and forged provenance tested |
| Ownership and conflicts | Foreign workspace/source, wrong actor, stale sources, stale Investigation revision, identical receipt replay and changed payload rejected or deduplicated as appropriate |
| Local history and model preservation | Earlier documents retained; original synthetic Run unchanged; no new Run for human question |
| Parent/source changes | Correction/rejection marks descendants for review; source deletion invalidates; stale sources rejected |
| Playwright desktop/mobile | 4 tests passed: new human-question journey plus existing AI-question/correction/testimony/exhibit regression |
| Persistence | Browser reload, on-disk PGlite close/reopen and an owned local Next.js process restart retained question, testimony, exhibit and original Run; enhanced desktop/mobile tests both passed |
| Typecheck and production build | Passed with live gate off and remote/model credentials blank in the build process |
| Full lint | Final rerun: no errors, only the two pre-existing warnings in ignored local files |
| Final changed-file lint | No warnings or errors |

The Playwright tests use the real production UI, domain rules and existing
SQL/RPC in disposable local PGlite, replacing the authenticated HTTP boundary.
The Meta-labelled unit fixture is authored test data, not new model evidence.
The first server-restart test harness incorrectly probed the redirecting
root URL while refusing redirects. Changing its readiness probe to the
local `/demo` page resolved the failure; both enhanced tests then passed.
GoTrue/PostgREST/Storage integration, an actual hosted write, and an app-server
process restart against hosted Supabase were not tested by this follow-up.
The owned Next.js process restart used only local fixture data. Existing two-user
isolation, token replay, HTTPS, hosted Storage patch/failure-path and general
model-quality limitations remain open. No M2-C experiment ran.

### Minimum hosted acceptance — requires separate write approval

Keep live mode disabled and inspect the existing M2-B workspace, Run,
hypothesis `f9207ecb-a391-458d-9c8e-ce49441de027`, both source revisions,
Investigation revision, previous versions and local ledger hashes first.
Do not press any analysis or replay button.

1. With the current hypothesis reviewed, choose **Use for inquiry**.
2. Save exactly one human question, for example: “What, if anything, do you
   know about these records?”
3. Select that question. Confirm human authorship, null model/run ID,
   exact parent revision and both original Source REV1 references.
4. Save one explicitly synthetic text testimony from a synthetic speaker.
   Save one exhibit containing only that testimony.
5. Refresh and, if included in the separate approval, restart the local app;
   reopen parent/question history and both originals. Compare pre/post
   snapshots, Model Run and ledger hashes.

If the historical REV1 baseline is still current, these are five writes:
Investigation REV1 → REV6, hypothesis REV1 → REV2, question REV1 → REV2,
one testimony REV1 and one exhibit REV1. Expect five new version snapshots
and receipts, zero new Model Runs, and no changed Source revisions.
Re-read current state rather than assuming those revision numbers.
Source edits/rejection/deletion and cleanup are outside this minimum proposal.

### M2-C no_connection preparation proposal — not approved

Use a separate synthetic pair to avoid reanalysing the accepted M2-B sources:
the existing `01.png` fixture and a proposed UTF-8 note containing
`MAPLE 82\nGREEN BENCH` (one LF, no trailing newline). The note is proposed
test data only; no new asset or workspace was created.
After separate preparation approval, register at most one new workspace and
two sources through the app, verify bytes/IDs/REV1 and no existing analysis,
then calculate the complete actual image-inclusive `compare` input hash
with `observations=[]`. Reconfirm current model, official price and limits
before requesting a fresh, short-lived one-request allowance; never reuse
any earlier ledger. No full ModelInput hash can be fixed before source IDs
and app-prepared bytes are established.

Evaluate whether lack of shared specific evidence is expressed honestly,
without treating missing details as contradictions or inventing a connection.
Do not force `no_connection`: evaluate whichever conclusion is returned.
Record open questions separately; the human-question path remains available
even when the next model output again supplies none. Actual M2-C inference,
new remote records and any cleanup each need their own explicit scope.

## Observation correction remote acceptance — 1 November 2026, 16:22 KST

Separately authorised hosted acceptance passed through the official Edge
extension, the existing signed-in profile and the local production app.
Workspace `M2-A-image-20261101` (`6efb78d4-d2c4-4ced-b17c-e38c9c47c2e8`)
contains Source `4e1f3f5b-a8a8-4f49-b315-9bd28f5e189b` REV1 and meta-live
Observation `f7929e12-6c7a-4e4a-847d-bb92e68bf123`. One correction advanced
both Observation and Investigation from REV2 to REV3. The existing claim
was unchanged. The new uncertainty is: "The exact colour and the cause of
colour uncertainty cannot be established from the current source material.
Image compression is not a verified cause."

The original claim and "Background color description uncertain from image
compression." remain preserved. Previous observation revisions reopened
REV1 and REV2, including their earlier uncertainty. A browser refresh retained
REV3 and both historical views. The target has no descendants, so hosted
`needs_review` propagation was not applicable; no records were added to test it.

The expired upload intent `ce9e158b-7f93-4ee5-9e76-0dcb5dca2af9` was cleaned
through exactly one Retry file cleanup action. All five intents are now done;
Storage retains two originals and zero staging objects. Both originals were
downloaded before and after cleanup: each remains 15,635 bytes and matches
the fixture SHA-256 `de6ea03faeba4ca2d231ab4a1ced2d26d86264b69512ba663c478462f7b4fc03`.

Read-only before/after comparisons preserved both workspaces, all five assets,
nine Source revisions, four Model Runs, all 13 pre-existing Investigation
versions, the other Investigation, Storage metadata and the existing Auth
account identity. Exactly one Investigation version and save receipt were
added. Apart from the target Investigation save, only the approved intent's
cleanup state changed. Nine Meta approval/allowance files retained their hashes.
No additional Meta request, reanalysis, migration, commit/push or deployment ran.

This session reran the correction/domain/route suites: 21 tests across three
files passed; `git diff --check` passed. The full-suite, build and automated
desktop/mobile results below belong to the earlier local implementation run.
The real Edge/Supabase checks above are separate from those local tests and
do not close the broader M1 security or model-quality gates. Local main and
fetched origin/main remained `6639830a79a13706f3511e612385176d51579d9e`.

## M2-A uncertainty correction follow-up — 1 November 2026

This section records the earlier local implementation session. The later
hosted acceptance and completed cleanup are recorded above.

Local implementation now allows an Observation's claim and uncertainty
explanation to be corrected independently or together. The correction form
shows the original suggestion and original uncertainty alongside editable
current values. A successful save names the new Observation revision, and
Previous observation revisions opens both fields from the saved history.
This supersedes the UI limitation in the dated M2-A report below; the actual
hosted M2-A record has **not** been corrected by this session.

`investigationCommandSchema` accepts an optional, trimmed, non-empty
`uncertainty` string of at most 2,000 characters. `applyReview` permits it only
for an Observation correction. It preserves `original_text`, locator, source
IDs/revisions, run ID, model and mode; it increments the entry revision and
uses the existing reconciliation and SQL save path. Blank replacement
explanations are rejected; users can explicitly record that the cause is
unknown. Other record editing flows are unchanged.

New imports retain `details.original_uncertainty`. For existing documents
without that optional field, reads display the untouched current uncertainty
as the original. The first explicit correction captures it before updating
the current value. Missing historical uncertainty is recorded as `null`,
displayed as Not recorded, rather than invented. No read-time backfill or
bulk update occurs. Existing `investigation_versions` snapshots and immutable
run records retain the earlier values. No SQL migration, table, dependency,
model prompt or provider request contract changed. This follows the existing
[Postgres JSONB storage model](https://supabase.com/docs/guides/database/json).

Verification used synthetic local data only:

| Check | Observed result |
| --- | --- |
| Focused domain, SQL, route and provider suite | 28 tests passed |
| Full `npm test` | 83 tests passed across 14 files |
| New correction suite, final rerun | 9 tests passed |
| Text-only, uncertainty-only and combined correction | Passed; omitted fields and original values retained |
| Legacy read and first correction; missing historical explanation | Passed; no backfill on read |
| Previous revision and refreshed state | Passed in SQL; browser reload and on-disk PGlite reopen also passed |
| Stale entry, stale investigation, rejected entry, changed duplicate payload | Rejected as expected; identical SQL receipt replay creates no revision |
| Descendant propagation | Uncertainty-only correction marks hypothesis, question, testimony and exhibit `needs_review` |
| Fixture/Replay/Meta-labelled storage | Passed using authored records through import, `storedRun` and actual local SQL RPC; saved run records unchanged |
| Provider regression | Existing fixture/replay and injected HTTP Meta tests passed; no real Meta request |
| `npm run typecheck` | Passed, including final rerun |
| `npm run lint` | Passed with 0 errors and 2 existing warnings in ignored `.local/m1-persistence-check.mjs` and `.local/meta-first.config.ts` |
| Lint of all changed TypeScript files | Passed with no warnings |
| `npm run build` | Passed; Meta and remote credentials disabled in the child process |
| `npx playwright test tests/e2e/investigation.spec.ts` | Desktop and mobile passed, 2 tests; production UI + local PGlite, API boundary intercepted |
| Visual review | Both Observation screenshots inspected; original/current fields and historical uncertainty visible; no horizontal overflow |
| Actual Supabase UI, live model quality, M1 security acceptance | Not run by this follow-up; not implied by local tests |

Initial branch `main`, HEAD and fetched `origin/main` were
`6639830a79a13706f3511e612385176d51579d9e`. Existing changes in README and
the two M1/M2 reports were preserved. Shared engineering policy matched
fetched agents-sync main `4acf97ee5b58e05b72f5ddfbc3ab25851eaffb57`.
No remote data request, mutation, cleanup, migration, live Meta call,
allowance activation, commit/push or deployment was performed. The pending
upload cleanup was not rechecked or executed. Historical remote counts in
earlier sections are not a new observation.
The before/after SHA-256 inventory covered 89 existing local files. Only this
report and `CURRENT_TASK.md` changed within that inventory; all other 87,
including `.env.local`, existing `.local` evidence/allowances, evaluation
results, README and the M1a report, matched. `git diff --check` passed.

### Next minimum M2-B proposal — not authorised or executed

Propose one `compare` request with the unchanged synthetic card image
`tests/fixtures/model/inputs/01.png` and a typed synthetic note containing
exactly these two lines (UTF-8, LF between lines, no trailing newline):

```text
ORBIT 47
BLUE TICKET
```

- Image: 640×480 PNG, 15,635 bytes; original and app-prepared PNG SHA-256
  `de6ea03faeba4ca2d231ab4a1ced2d26d86264b69512ba663c478462f7b4fc03`.
- Note: 20 UTF-8 bytes; SHA-256
  `6c896c139ec6bc2c9259ad8fa892913cbe49c9d6b3a56ba40f539a5bdd400c3e`.
- Proposed model: `muse-spark-1.3` Standard; one request total, zero retries,
  at most 1,200 output tokens, maximum US$1.32 under the existing local
  reservation mechanism. This is a proposed cap, not a fresh price quote.
- Prefer a separately approved synthetic workspace with these two source
  revisions and no pre-existing observations (`observations: []`). One compare
  call can return the tentative connection, supporting/contrary evidence,
  unknowns and questions; separate observe calls are unnecessary for this test.
- Before any inference approval, authorise the exact source creation, verify
  actual source IDs/revisions, recompute `inputHash` for the complete prepared
  `ModelInput`, and recheck the official model/pricing. Content hashes above
  are **not** the full request allowlist hash: source UUIDs are not assigned.
  No new source, approval file or ledger was created during this follow-up.
- Assess the shared visible wording with evidence from both records, honest
  absence of contrary evidence, unknown identity/date/relationship, and a
  useful non-leading question. Transport/schema success alone is insufficient.
  M2-C remains a separate future approval and experiment.

## M2-A image app inference — 1 November 2026, 03:04 KST

After separate creation approval, the user uploaded the unchanged synthetic
01.png to M2-A-image-20261101 (workspace
`6efb78d4-d2c4-4ced-b17c-e38c9c47c2e8`, asset
`4e1f3f5b-a8a8-4f49-b315-9bd28f5e189b`, source REV 1). Read-only preflight
confirmed source bytes, app PNG preparation, no prior analysis and exact input
SHA-256 `16abfa4c9f7ae1481bd99885ca386a7a7aca71a980d1150706fce6bb659cfdec`.
The user then separately approved one Standard muse-spark-1.3 request, no
retries, 1,200 output tokens and US$1.32 maximum. A new 30-minute ignored
allowance was created; prior ledgers were preserved without reuse.

One Edge Suggest observations action succeeded through the real authenticated
app, private Storage, Meta and hosted DB. Run
`244f18a8-4849-4b1e-83ac-d9720a65589d` returned muse-spark-1.3,
chat.completion/JSON, finish_reason stop, 3,931 ms, 1,420 input / 376 output
tokens (253 reasoning tokens included; cached input zero). Estimated cost
US$0.003373 matched the settled ledger; actual invoice remains unknown.
No retry or fixture substitution occurred. Live mode was immediately disabled
by restarting the owned server, and the result survived reload without login.

Assistant visual comparison confirmed ORBIT 47, ADMIT ONE and BLUE TICKET,
the card/border and a horizontal line. No date, identity or relationship was
invented. However, the model attributed colour uncertainty to image compression
without evidence; the line description was also less precise than its visible
placement below ORBIT 47. Structural acceptance passed, with this semantic
caveat. An attributed correction saved observation REV 2; SQL retained the
original suggestion in both versions. The current correction UI changes claim
text but retains original locator/uncertainty details, so the unsupported
compression explanation remains visible beside the correction. This is a
follow-up product limitation, not silently corrected model output.

Three separately approved historical inference requests now total an estimated
US$0.00903650: CLI image, app text, app image. This single clean image case does
not establish general image quality or live comparison/question/exhibit flow.
Existing M1 data/history remains separate. The new upload has its own cleanup
horizon, **05:05:29.926 KST on 1 November**; its pending status does not reverse
the earlier four-intent cleanup pass. No runtime code, migration, Auth setting,
commit/push or deployment changed. Evidence and allowances remain ignored.

## Final M1 cleanup and M2-A image preflight — 1 November 2026

At 02:43 KST, hosted DB time confirmed the last capability had expired. The
existing signed-in Edge session executed Retry file cleanup exactly once.
All four upload intents are now `cleanup_state=done`, with zero pending work,
zero staging objects and the same one original. The UI displayed **No pending
uploads or file cleanup.** The original still matched the 15,635-byte fixture;
both duplicate paths returned 404. Workspace/assets/revisions/investigation,
version-history and run hashes matched before/after. The two active records,
eight asset revisions, eleven investigation versions and Auth account were
preserved. This supersedes earlier dated pending-cleanup notes, not the open
A/B, HTTPS, token-replay, failure-path or hosted Storage patch-level gates.

At 02:54 KST a read-only M2-A preflight rechecked the existing `01.png` in
workspace `56b7510b-d21c-447c-81c3-608553ce410c` (M1-20261030-A), asset
`73a2443d-153c-4fb2-b4bc-6288b5bc7961`, revision 1. Downloaded original and
the app-equivalent sanitised PNG match: 640x480 pixels, 15,635 bytes, SHA-256
`de6ea03faeba4ca2d231ab4a1ced2d26d86264b69512ba663c478462f7b4fc03`.
The exact full ModelInput hash for this existing source is
`e182b238fe441b9ae5f1346cce1dfed8d6a4998f3f953cdbba820518d0de5c58`.
It is **blocked, not an executable proposal**: observe for that source/revision
already exists in the analysed registry from the fixture run. Provider choice
does not change identity. Local request validation and duplicate-import
rejection passed; no Meta request or remote write occurred.

Propose a separate `M2-A-image-20261101` workspace with one upload of the exact
same local fixture, preserving the original workspace/history. This would use
two workspaces and two active originals in total, within existing test limits,
but needs the user's requested separate creation approval. No workspace or
asset has been created. The new source would be revision 1; its UUID is assigned
by the app/DB, so its full approval hash cannot truthfully be fixed before
upload. After authorised creation, recompute the real prepared input hash and
request a separate one-shot Meta approval. Do not alter deduplication, fabricate
IDs, revise old sources to bypass it, or reuse an old allowance.

Proposed inference: `muse-spark-1.3` Standard, chat/completions, one PNG,
at most 1,200 output tokens, one request total, zero retries and US$1.32 cap.
The existing-source request has 1,109 prompt-text characters; recompute after
new IDs are assigned. Standard listing/prices were rechecked at 02:54 KST on
the official pricing page (US$1.25/M input, US$4.25/M output). Prior successful
calls establish past account access, not a fresh permission/quota probe.

Acceptance separates transport/schema from visual grounding: inspect returned
model, completion status, source revision, raw output, latency, usage and ledger
settlement; compare visible ORBIT 47 / ADMIT ONE / BLUE TICKET text with claims,
abstention and invented dates/relationships. Verify a META-LIVE observation in
the app and hosted run, reload it, make one attributed correction, and verify
both original and corrected revisions. Image misunderstanding is a quality
failure even if schema passes. Provider/incomplete/unknown-cost failure stops
the experiment without retry or fixture substitution. Observe alone does not
validate live connection/question/exhibit generation. No new approval file,
model call, migration, Git publication or deployment was made in this preflight.

## M2 authenticated app experiment — 1 November 2026, 02:07 KST

The user separately approved exactly one text-only app inference after the
read-only plan. Existing synthetic note REV 3 was not yet observed alone, so
no source change or duplicate-analysis bypass was needed. Input SHA-256:
`cac554eea28b2b8ba451412af62bf683e6cce5719d4fcbdfab4200172d96b706`.
The request contained 1,125 prompt-text characters, no image, and at most 1,200
output tokens. A new ignored 30-minute allowance authorised one request,
zero retries and US$1.32 maximum; the previously consumed allowance was not
reset or reused. Its two file hashes remained unchanged.

Official model/pricing pages were checked at 02:05 KST: Standard
`muse-spark-1.3`, US$1.25/M input and US$4.25/M output
([pricing](https://dev.meta.ai/docs/pricing-rate-limits),
[model](https://dev.meta.ai/models/muse-spark)). This confirms published pricing,
not the invoice. The Edge app executed one successful request and stored run
`7a0f538a-357c-4224-bbca-b3cc6a2a69ff` in hosted Supabase: returned model
`muse-spark-1.3`, finish reason `stop`, 4,088 ms, 1,000 input / 405 output tokens,
estimated US$0.00297125. The local reservation settled for that same amount.
Actual billed cost is unknown. No model-list call or automatic retry occurred.

The response quoted the synthetic note exactly, referenced its correct ID and
revision, returned no connection/questions, and passed the analysis schema.
Review found no invented date, identity or relationship in this one result.
Its uncertainty text described the supplied text as legible; this is not a
handwriting or image-reading test. UI labelled the observation META-LIVE.
After success the server was immediately restarted with live mode disabled;
session and saved response survived reload. A human-style clarification then
saved observation REV 2 while preserving the model's original text. Hosted
investigation revision is now 11. Existing M1 records/revisions/Storage/Auth
account remain unchanged. Total historical inference count is two (one CLI
image case and this app text case), estimated combined US$0.00566350; this is
not general model-quality acceptance or a fully live connection/exhibit flow.

### Integration review and no-call checks

The route verifies Origin and online Auth; RLS checks workspace ownership.
Source IDs/revisions are validated before starting the run. For live photo
inputs the server downloads only the authorised revision's private original,
rotates/resizes to at most 1024px and emits PNG capped at 512 KiB. A read-only
check of the existing synthetic photo produced 640x480 / 15,635 bytes, identical
to its fixture bytes. No image was sent in this app experiment.

The provider validates text/image bounds, reserves the exact full input hash
before fetch, uses a 45-second timeout and no retries, and validates returned
model, token usage, completion status, JSON schema and source references.
Unknown outcomes retain a blocking ledger charge. Failed responses never
substitute fixture output. Auth and evidence are checked again before saving;
SQL repeats source/revision checks atomically. SQL stores raw response, usage,
cost and image hashes rather than image copies. UI exposes provider/model/run
status; token/cost details currently require the saved run/ledger, not the UI.
These failure branches were reviewed/tested locally, not injected remotely.

The read-only proposal and local fixture check passed. The first plan config
also ran the existing 73 tests (74 total including the plan); an isolated plan
rerun passed. Nine focused provider/route tests and a replay of the original
CLI response passed without external inference. Runtime code changes were not
needed. The existing duplicate-analysis guard intentionally applies across
providers: a saved source revision cannot be re-analysed merely by selecting
Replay or Meta. Before this run no matching live app record existed; the old
CLI record uses different source IDs. Local replay is not remote app Replay
acceptance, and no recorded result was relabelled to bypass this restriction.

Both allowances and raw results are retained only in ignored local evidence.
`.env.local` remains live-disabled with no approval path; the running server
also has live mode disabled. No new SQL, Git publication, deployment or Auth
configuration change occurred. Final upload cleanup still awaits its
02:29:02.346 KST horizon. A/B user isolation, HTTPS cookies/cache, token replay
and remaining failure cases remain pre-public-deployment gates.

## Remote A/B execution — 1 November 2026, 01:52 KST

Here A/B refers to the two migration approval stages, not two-user isolation.

The user explicitly approved both stages. CLI authentication was initially
missing; after the user signed in, Approval A completed both history-only
repair steps. Each step was read back. The final M1 versions are
`20261028155626` and `20261029150829`; no M1 SQL was rerun. Before execution,
the full original history and M1 data, policies, ACLs, functions and Storage
baseline were saved under ignored `.local/`. Both original SQL bodies matched
their local files. Post-A comparisons matched every captured M1 category.

Approval B then applied only `20261029165416_investigation_flow.sql`, after
verifying the approved SHA-256 and that it was the only pending migration.
The recorded version is `20261029165416`. All three new tables have RLS and
owner-read policies via workspaces, authenticated SELECT and service-role
writes. The invoker RPC permits service_role, not anon/authenticated execution.
Post-B M1 workspace, assets, eight revisions, intents, functions, bucket/object
metadata and Auth-account presence matched the baseline. Two active records,
one original and zero staging objects remain. No existing material was deleted.

Official Edge exercised the signed-in app against hosted Supabase: fixture
observation, correction, rejection, no-supported-connection inquiry, question
selection, synthetic testimony and a sourced exhibit. Refresh and an owned
production-server restart retained the session and saved content. Correcting
testimony advanced it to revision 2, preserved the original testimony and
marked its existing exhibit `needs review`. The exhibit's evidence control
retrieved historical testimony revision 1. The database contains six entries,
nine investigation versions and two succeeded `authored-fixture-v1` runs.
This verifies real Auth/app/DB persistence with fixture suggestions, not model
analysis quality. No new Meta calls occurred; the live gate remains disabled.

All 73 local tests across 13 files passed. No runtime source changed, so build,
typecheck and lint were not rerun. Security Advisor has the same receipt-table
RLS-without-policy information and leaked-password-protection warning; no new
Investigation finding or Auth-setting change. Real A/B isolation, HTTPS security,
raw token/capability replay and remaining failure paths are still unverified.
At 01:52 KST the latest upload capability had not expired: its final cleanup
remains pending until after 02:29:02.346 KST. Existing active materials and the
personal-email Auth account are preserved. No commit, push or deployment.

The approval proposals and publication notes below are historical and are
superseded by this execution record where they describe A/B as unapproved.

## Publication verification — 1 November 2026

The user approved committing and pushing the current results while explicitly
leaving the latest duplicate intent's post-horizon cleanup unfinished. This
does not approve migration repair, Investigation SQL, additional Meta calls or
deployment. The actual single-user and duplicate-photo passes below stand;
full M1a security acceptance and remote M1b E2E remain open.

Pre-commit checks rerun on the current worktree: **73 tests in 13 files passed**,
typecheck and production build passed; lint had zero errors and two warnings
in excluded local-only helper files. One plan-only evaluation and one authored
fixture evaluation also passed, with live mode disabled and **zero new Meta
requests**. The earlier eight browser-suite passes are historical; current
Edge/service observations below are separately identified. Source changes are
safe login-error classification, clearer cleanup status/remaining-work UI,
cleanup-horizon regression coverage and explicit evaluation environment/plan
loading. Raw execution artefacts, screenshots, secret configuration and local
handoff files are excluded from Git.

Pending: the newest intent's final check after **02:29:02.346 KST on 1 November**,
actual A/B isolation before public deployment, raw old-token/capability replay,
some upload-failure paths, HTTPS security and hosted Storage patch confirmation.
The personal-email Auth account and minimum synthetic data remain preserved.
The exact two-stage M1b approval package below is a proposal, not execution.

## Actual duplicate-photo result — 1 November 2026, 00:24 KST

The user selected the exact existing synthetic 01.png once. Official Edge
readback displayed **Already in this workspace — duplicate skipped.** and
**2 records**. Hosted DB shows new intent
`0b556a01-327b-4068-be4d-473aca9a3caf` complete, referring to the same active
photo `73a2443d-153c-4fb2-b4bc-6288b5bc7961`, still revision 1. The note stays
revision 3; no duplicate active photo was created.

Storage SQL shows one original and zero staging objects. Actual service-role
HTTP downloads of the duplicate intent's staging and copied-original paths
both returned 404. The retained original downloaded successfully and matched
the fixture byte-for-byte (15,635 bytes; SHA-256
`de6ea03faeba4ca2d231ab4a1ced2d26d86264b69512ba663c478462f7b4fc03`).
Thus no unnecessary copy remains at the observation time; this does not claim
the implementation never created a temporary copy during finalisation.
Evidence: ignored `.local/m1-duplicate-result.json` and guarded read-only
`.local/m1-duplicate-check.mjs`.

The new intent correctly remains cleanup-pending until **1 November 2026,
02:29:02.346 KST**, even though its files are absent. The UI's 00:34 upload
permission deadline concerns finalisation; it is not the capability cleanup
horizon. After 02:29:02.346, use the existing app cleanup path once and verify
done/no unexpected objects. Preserve the active fixture, note and personal
email Auth account. This final horizon check remains pending; earlier expired
intents already passed cleanup. No additional Meta call or remote migration
occurred. The following approval package is now prepared; duplicate testing
is no longer awaiting file selection.

## Bounded follow-up and approval package — 1 November 2026

Preserve the successful M1 evidence and minimum synthetic collection. The
application Auth account associated with the user's personal email **must not
be deleted without separate confirmation**, even after test-data cleanup.
Actual A/B isolation remains a mandatory pre-public-deployment gate; there is
no second eligible account. Do not expand into additional M1 fault scenarios.

Duplicate-photo baseline at 00:21:44 KST: one active synthetic photo, one
original, no staging objects, three cleaned intents. The user was asked to
select the exact fixture 01.png once; results await readback. A new duplicate
intent may correctly remain cleanup-pending until its capability horizon even
when no files remain. File absence and completed capability cleanup are
different acceptance claims.

Expired-capability and revoked-token replay are **not run**. Earlier
capabilities/access tokens were not retained; obtaining them from the live
browser would violate the existing no-extraction boundary. No Docker runtime
is available on PATH. Existing local-only tests cannot be pointed at hosted
Supabase or treated as hosted evidence; their local synthetic token handling
does not authorise harvesting the user's browser credentials. No token was
printed, manufactured or replayed.

### Approval A: M1 history only

Target exclusively `svwzgtsjwcvncxyvdhho`. Retain current local files/order.
Before mutation, export the exact remote migration rows and capture M1 object,
grant and test-data baselines in ignored local evidence. Reconfirm SQL content
matches and no concurrent migration work; stop on any drift. The reviewed CLI
supports explicit project targeting. Proposed commands, **not executed**:

```sh
npx supabase migration repair 20261029165946 20261029165951 --status reverted --project-ref svwzgtsjwcvncxyvdhho
npx supabase migration repair 20261028155626 20261029150829 --status applied --project-ref svwzgtsjwcvncxyvdhho
```

Read back after each operation. Expected final history is the two local M1
versions, with schema/data/buckets unchanged. CLI repair changes history rows,
not application SQL ([official reference](https://supabase.com/docs/reference/cli/supabase-migration-repair)).
If either step fails, stop: no schema migration or retry loop. Preserve the
history export and report the exact partial state; any restoration write needs
an explicit recovery scope. Never rerun M1 schema SQL to repair the history.
CLI authentication/connection availability must be checked without printing
credentials; do not substitute direct history-table writes if CLI is blocked.

### Approval B: one Investigation migration and fixture E2E

Only after Approval A succeeds, approve the current
`supabase/migrations/20261029165416_investigation_flow.sql`, raw-file SHA-256
`258b207d43b42080ff5d60a6e792376f1b71cef7ccbcbb22a12e446bda5eeac9`.
Before execution, verify this hash, absence of the three tables/function and
that this file is the **only** pending migration. Then use the installed CLI's
`migration up --linked --project-ref svwzgtsjwcvncxyvdhho`; if any other file is
pending, stop. Do not use include-all or db push. Verify the recorded version
is 20261029165416, preserving the repaired mapping rather than generating
another connector-assigned timestamp.

Scope: three investigation tables, their index/RLS/grants and service-only
invoker RPC, followed by fixture-only Auth/DB E2E using existing synthetic
records and existing test limits. No Meta calls, Auth changes or deployment.
Verify correction/rejection, link/no-link, question/testimony, sourced exhibit,
refresh/restart and source-revision review. Capture the M1 baseline first;
source changes affect only synthetic records. DDL is transactional; failure
before commit must leave no partial objects. After commit, preserve new data
and stop the new flow on failure; no automatic DROP/CASCADE/history erasure.
Destructive recovery requires a separately reviewed plan and approval.

## Actual cleanup and UI acceptance — 1 November 2026, 00:13 KST

The user reauthorised supported Edge testing. No file upload or extension
permission change was retried. App Retry file cleanup completed all three
manifested intents with `cleanup_state=done`, confirmed through hosted SQL.
There are zero staging objects and one original for the active synthetic
photo. This is completed upload cleanup, not deletion of the active collection.

The apparent no-op was a UI feedback defect: cleanup used a generic save
message and kept showing rejected intents after cleanup finished. The archive
component now reports cleanup explicitly, lists pending/unfinished work,
and displays **No pending uploads or file cleanup.** when none remain.
Typecheck, focused ESLint and production build passed. Edge confirmed the
new empty-cleanup state after restart, retaining the session and two records.
The previously passed 73 tests were not rerun for this presentation-only edit.

An actual Edge double-click on Save note created exactly one synthetic note
(`3980b16b-2736-4679-9b9a-67cffd2d03f4`), confirmed through hosted DB. Only this
new disposable note was then deleted through the app; DB state is `deleted`.
This verifies duplicate UI submission, not duplicate-image deduplication or
unknown-outcome replay. Authenticated access to the old deleted photo URL and
a nonexistent Workspace UUID returned unavailable errors. Browser HTTP status
codes were not captured; these are not user B isolation tests.

Retained minimum data: M1-20261030-A, original note REV3 and replacement photo
`73a2443d-153c-4fb2-b4bc-6288b5bc7961` REV1 (01.png, 15,635 bytes), plus history,
receipts, tombstones and three cleaned intents. User B remains unavailable.
Duplicate-photo, interrupted-upload and raw expired-capability replay remain
unverified remotely. Cleanup after the safety horizon is proven, but actual
capability rejection was not exercised. No Meta call, SQL mutation, migration,
commit/push or deployment was performed; test writes used the app's existing
authenticated path.

## Manual invalid-file verification — 31 October 2026, 19:39 KST

The user selected both synthetic invalid files in Edge. The corrupt PNG showed
the damaged/type/animation/pixel-limit rejection; the oversized file showed
the 6 MiB limit message. Hosted SQL readback at 19:39:54 KST confirmed a new
44-byte intent in `rejected` state, no new photo asset, one active note at
revision 3, and zero Storage objects. The oversized file created no intent:
this is client-side size rejection, not a real oversized Storage HTTP test.
The corrupt-file outcome is real app/server rejection with hosted DB evidence,
not a mocked validation result. Browser response status was not captured.

The rejected intent's cleanup safety window ends at **21:44:13.129 KST**;
`cleanup_state=pending` is expected until then despite zero current objects.
The original intent still has the separate **19:56:14.722 KST** horizon. Keep
both cleanup references and do not claim complete final cleanup at the earlier
time. Exact new intent ID and user-reported messages are in ignored
`.local/m1-invalid-files.json`. No browser permission was changed.

## Authenticated continuation — 31 October 2026, 19:07 KST

User A completed another real Magic Link login manually. Official Edge showed
the existing workspace and note; remote Auth inspection confirmed one session.
Two Edge tabs loaded note revision 2. The first saved the synthetic title
`M1 persistence note v3 - conflict baseline`. The second attempted a different
title using stale revision 2 and displayed **This record changed in another
window. Reload before saving your edits.** Hosted DB readback showed exactly
note revisions 1, 2 and 3, with the first tab's title retained and no stale
revision appended. This is actual app/Auth/DB conflict verification, not a
mock; the HTTP status itself was not captured from the browser.

File upload automation then refused to set files because the Edge extension
required its **Allow access to file URLs** permission. No permission was
changed, no fallback automation was attempted and browser automation stopped
under the user's security boundary. A manual handoff requested only the two
local synthetic fixtures `.local/m1-corrupt.png` (44 bytes) and
`.local/m1-oversize.png` (6 MiB + 1 byte). No upload outcome is claimed yet.
At 19:07:07 KST the original intent was still pending cleanup and unexpired,
Storage had zero objects, and the note was active at revision 3. The existing
19:56:14.722 KST cleanup horizon remains unchanged. Preserve the login session
and test note for the remaining manual tests; no final cleanup was performed.

## Remaining M1 acceptance — 31 October 2026, 18:43 KST

Read-only continuation while user A is signed out. Local and fetched remote
`main` remain `b492473`; existing evaluation changes and the consumed Meta
ledger are preserved. No remote data, migration or Auth configuration was
changed. The live model gate remains `no` and no model request was made.

**Browser:** the official Edge extension successfully controlled the local
app. No native-browser policy bypass or alternative automation was used.
The public `/demo` displayed three synthetic records, no editable controls,
and the same records after reload. This is a read-only fixture demonstration,
not an authenticated workflow or model-quality test. The previous manual
single-user acceptance below remains valid historical evidence.

| Evidence class | Current result |
| --- | --- |
| Actual hosted PostgREST HTTP | Anonymous HEAD reads of all five M1 tables returned 401. A service-role request selecting the private helper schema returned 406/PGRST106: the schema is not exposed. |
| Actual hosted Storage HTTP | Both manifested deleted object paths returned 404 for service-role and anonymous downloads. This proves those objects are absent, not foreign-user isolation for an existing object. |
| Actual app HTTP | Anonymous archive, scoped archive and original reads returned 401 with private/no-store. A foreign-origin write request returned 403 before mutation. |
| Hosted SQL inspection | Five M1 tables have RLS; archive_command is invoker and neither anon nor authenticated has EXECUTE. Workspace policy includes session_is_active. Both buckets remain private with 6 MiB PNG/JPEG/WebP limits. |
| Data retained | One workspace, one active note, one deleted photo, five revisions, zero Storage objects, and one completed intent with pending cleanup. Auth session count was zero. |
| Local tests | 73 tests passed across 13 files, including PGlite and mocked HTTP faults. Typecheck and production build passed; lint returned zero errors and two pre-existing ignored-local-file warnings. Earlier browser-suite counts are historical, not a new E2E run. |
| Local secret check | No exact configured Meta/service-role key values found in the 16 current browser-build files. Server clients use server-only modules; this bounded scan is not a general secret-audit guarantee. Server stdout/stderr remain discarded to avoid callback/token logging. |

Read-only HTTP evidence and canonical migration hashes are recorded in ignored
`.local/m1-readonly-acceptance.json`; its companion script enforces the existing
exact-project/origin guard. The original local-only E2E guard is unchanged.

The login endpoint previously converted every provider failure into the same
429 response. It now distinguishes the email limit, other rate limits, and
service failures without exposing provider messages or adding retries. Four
mocked route tests cover this behaviour and the origin/callback boundary.
Two additional HTTP-mock tests cover capability cleanup before/after expiry
and failed-removal retry. The updated production app was built and restarted
on `http://127.0.0.1:3000`; no email was sent to exercise the new message live.

### Still required for M1a acceptance

- The current cleanup horizon is **19:56:14.722 KST**. At the check above it
  had not elapsed. After expiry and actual login, use the app's **Retry file
  cleanup**, then verify `done`, zero objects and continued original denial.
  Do not force the DB status or remove the intent before this verification.
- Actual authenticated corrupt/oversized uploads, duplicate submissions,
  stale-revision conflicts, interrupted-upload retries and capability expiry
  remain unverified remotely. Existing local tests cover rejection, receipts,
  conflicts, expired finalisation, deletion and fault recovery; these are not
  hosted HTTP acceptance. Destructive fault injection stays local.
- User B has no authorised second mailbox. Docker was unavailable on PATH,
  so independent local Supabase/Mailpit Auth testing was not run. PGlite
  owner/session isolation passes but does not establish actual A/B isolation.
- Old bearer-token replay remains untested; no browser token was extracted.
  Session-aware RLS and zero session rows are supporting evidence, not replay.
- Keep the remaining manifested note/workspace for these tests; final cleanup
  of exact test data follows acceptance. Organisation membership is excluded.
- Actual HTTPS Secure-cookie delivery, proxy/CDN caching and deployed refresh
  remain untested. Hosted Storage runtime patch level remains unconfirmed for
  [GHSA-8rrf-w776-x75g](https://github.com/supabase/storage/security/advisories/GHSA-8rrf-w776-x75g)
  (fixed in 1.80.2); no exploit or destructive probe was attempted.

### Advisor review

The [RLS-without-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
on command_receipts matches the intended service-only design: inspected grants
exclude anon/authenticated and their actual anonymous HTTP read was denied.
Do not add a permissive policy just to silence this information notice.
The [leaked-password warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
concerns password authentication, whereas this application's implemented UI
uses Magic Links. It is not the cause of the email rate-limit failure. This
does not prove that every password endpoint is disabled on the project;
no Auth security setting or paid plan was changed.

### M1b remote preparation — proposal only

Canonical SQL MD5 values still match local/remote M1 pairs:
`20261028155626` → `20261029165946` (`1ebe32fdc075db7f8665ceabc3285469`),
`20261029150829` → `20261029165951` (`cd46ee17c02910620d02dd9acf0c03c2`).
Only those two remote migration rows exist. Never blindly push the current
history: renaming M1 files to the remote timestamps would put Investigation
before its prerequisites.

Proposed smallest reconciliation is **history-only repair**, retaining local
filenames: first export the two exact remote history rows, schema/grants and
data baseline into ignored local evidence; during a migration-free window,
mark the two remote-assigned M1 versions reverted and the two original local
versions applied. Inspect the installed CLI help and exact target immediately
before use. Recheck history and unchanged objects/data after each step. A
partial failure must stop further migrations; restore the captured version
mapping under an explicit recovery approval, without rerunning M1 SQL.

After M1 acceptance and a separate history-repair approval, seek separate
approval for the exact `20261029165416_investigation_flow.sql` content. It adds
three tables, RLS/grants, one index and the service-only invoker command in a
transaction. It has no M1 data rewrite or model call. Risks include DDL locks,
incorrect version/order, permission errors and new test data; local PGlite
passes do not prove hosted PostgreSQL behaviour. Revalidate schema absence,
SQL hash and ownership policies before applying, then read back grants/RLS.
An in-transaction failure rolls back; after success, prefer stopping the new
flow and preserving/exporting data. Do not automatically drop tables or erase
history as rollback. Any destructive rollback needs its own reviewed scope.

Initial remote M1b E2E should use **fixture mode only** and existing synthetic
sources: observation → correction/rejection → link/no-link → question → text
testimony → sourced exhibit; reload/restart and source-edit/deletion review.
Record that Auth/DB persistence is real while model output is fixture. Meta
live remains disabled and the old approval/ledger must not be reused.

## Actual single-user M1 verification — 31 October 2026

This supersedes the earlier missing-mailbox/service-test blockers for user A
only. The user operated Edge manually; the agent did not automate the browser
or obtain browser credentials. The actual hosted target was
`svwzgtsjwcvncxyvdhho` in Seoul, with the two existing M1 migrations. No M2 SQL,
history repair, SMTP or Auth configuration change was made.

| Check | Result and evidence |
| --- | --- |
| Magic Link and PKCE | Passed with user confirmation of link opened in the requesting Edge profile and Archive entry; remote Auth confirmed email, sign-in and one session. No token/link was logged. |
| Workspace, photo, note | User saved through the actual app; hosted SQL and PostgREST verified one workspace, one photo and one note. |
| Original Storage bytes | Actual service-role Storage HTTP download matched the local synthetic PNG byte-for-byte: 15,635 bytes, 640×480, SHA-256 `de6ea03faeba4ca2d231ab4a1ced2d26d86264b69512ba663c478462f7b4fc03`. User separately confirmed Open original through the authenticated app. |
| Revision preservation | Note revisions 1–2 and photo revisions 1–3 remained. Photo revision 3 corrected a double trailing period in revision 2; no revision was overwritten. |
| Refresh and restart persistence | User confirmed refreshed state. Agent verified and replaced the owned Next server process, PID 4672 → 21700, at 17:57:22 KST. Pre/post PostgREST data and downloaded original bytes matched. User then confirmed Edge reload without re-login, both records, original, note and history. |
| Photo deletion | User confirmed one remaining note and original re-request denial. Hosted DB photo state became `deleted`; scoped original/staging object counts were zero. Service-role downloads both returned 404. |
| Logout | User confirmed F5 and direct Archive access denied. At 18:05:42 KST, remote Auth session count for this test user was zero; independent anonymous Archive and original API requests returned 401. |
| Full cleanup | Pending. The upload capability safety window ends at **31 October 2026, 19:56:14.722 KST**. Intent remains `cleanup_state=pending`; zero current objects is not proof that the capability has expired. |
| A/B isolation, old-token replay, conflicts | Not run in this real-service session. A second authorised mailbox was not supplied. No session tokens were captured for replay; duplicate/concurrent write and stale-edit claims remain local-test evidence only. |

Evidence is in ignored `.local/m1-manual-run.json`, the before/after restart
snapshots, restart event and photo-deletion record. Browser observations are
explicitly user-reported; DB/Storage observations are direct hosted-service
reads. These results are not PGlite or fixture substitutes, and do not establish
complete M1 security acceptance or M2 investigation acceptance.

Created scope: one new application Auth user, one test workspace, one 15,635-byte
synthetic photo, one synthetic note, five revisions and one upload intent, plus
command receipts. The photo bytes are removed; the test user, workspace, note,
revision/tombstone metadata, receipts and pending intent remain. Keep the exact
IDs in the ignored manifest and preserve the pending cleanup references until
the capability window has elapsed. Recheck scoped objects and sessions before
removing only manifested test records. No new email is needed for an authorised
administrative cleanup. The Supabase organisation membership is not test data.

No additional Meta call occurred; the consumed one-request ledger remains
preserved and live use disabled. No commit, push or deployment occurred.

## First approved live result — 30 October 2026, 17:28 KST

Supersedes the zero-call status in the earlier follow-up below. The user
explicitly approved one inference with the exact prepared input hash. Official
model and pricing pages were rechecked at 08:27:00 UTC (17:27:00 KST): Standard
`muse-spark-1.3`, input $1.25 and output $4.25 per million tokens. Public
catalogue verification did not establish account entitlement; that was unknown
until this request succeeded. No model-list API request was made.

Exactly one POST to `/v1/chat/completions` returned HTTP 200 at 08:28:26.608 UTC.
Returned model was `muse-spark-1.3`, finish reason `stop`; JSON schema and source
reference validation passed. Latency was 2,359 ms. Returned usage was 1,399
input and 222 output tokens (108 reasoning tokens included), total 1,621,
cached input zero. Calculated cost is **$0.00269225**, not a verified invoice.
The $1.32 reservation settled at that calculated cost.

Direct visual comparison found all three visible phrases correctly transcribed:
`ORBIT 47`, `ADMIT ONE`, `BLUE TICKET`. The dark teal rectangular ticket and
light border description match the image. No unsupported identity, date or
relationship was observed. The model expressed no uncertainty about the clear
text; ambiguous-input abstention remains untested. It returned one observation,
null connection and no questions, as requested. This single simple English
graphic establishes neither handwriting/Korean quality nor comparison quality.
This is an assistant visual review; human acceptance remains pending.

The raw evaluation and a separate semantic review are retained under ignored
`evaluation-results/2026-10-30T08-28-24.252Z-5ee6332c-0bfd-457b-9545-a98b08f205a6/`.
The same approval ID/path was retained, with max_requests=1 and a 30-minute
expiry. Its durable reservation and settlement remain intact. Execution-only
live approval was restored to `no`; `.env.local` remains unchanged with live
disabled and its approval path empty. No retries, additional calls, Supabase
changes, migration repair, commit/push or deployment occurred. The one-request
allowance is consumed. Any further experiment requires separate approval.

## Real-integration follow-up — 30 October 2026

This section supersedes the older missing-key and missing-credentials blockers
below. Local and fetched remote main were both `b492473c1e10a94c14c8e60052e58e17ba0739b9`;
the starting worktree was clean. The shared policy matched fetched agents-sync
main `2547d11b1cc7bfe38437f29407300136022f20ca`.

- `.env.local` has non-empty `MODEL_API_KEY`, `SUPABASE_URL`,
  `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `APP_ORIGIN`.
  No values were printed. The project and loopback origin match the bounded
  procedure. Live approval remains `no`; the approval path remains empty.
- The evaluation config now explicitly loads `.env.local` with Node's existing
  loader, preserving process overrides. Next loads environment files itself;
  ordinary Vitest tests do not use this evaluation config and remain isolated.
  This deliberately loads only `.env.local`, without Next's interpolation or
  full `.env*` precedence. No dependency or credential file changed.
- Plan-only for development case `readable` passed: one 640×480 PNG, 15,635
  bytes, 1,109 message-text characters, output cap 1,200 tokens. Input SHA-256:
  `81f4eeba26346dbb79f02a228877d692a5b90789a45236b42cfc2338a57f5f82`.
  The plan records configured/not-configured booleans, actual input dimensions
  and zero live calls; it contains no secret values. Ground truth stays separate.
- An ignored `.local/meta-first-approval.draft.json` is an **inactive proposal**:
  Standard model only, the single hash above, one request and $5 total.
  Approval, expiry and account catalogue timestamps are null, so the existing
  strict schema rejects it. On approval, keep its ID and ledger location;
  never reset/copy a ledger. The broader 20-request ceiling is not permission
  to continue after the first result. A future approved increase must count
  the first request and any separately authorised catalogue calls.
- Official [models](https://dev.meta.ai/docs/models),
  [image input](https://dev.meta.ai/docs/image-understanding),
  [structured output](https://dev.meta.ai/docs/structured-output) and
  [pricing](https://dev.meta.ai/docs/pricing-rate-limits) pages were retrieved.
  `muse-spark-1.3` selects Standard; inline images and JSON Schema are documented.
  Uncached input/output rates remain $1.25/$4.25 per million tokens; cached input
  is $0.15. The adapter conservatively charges all input at the uncached rate.
  Documented Standard limits are 3,000 RPM and 4,000,000 TPM per team/model.
  Actual account entitlement is unverified. Check the dashboard, or separately
  authorise a catalogue request and count it against the overall request cap.
  No catalogue, token-counting or inference API request was made.
- Budget review confirmed exact input allowlisting, local-only gating,
  exclusive reservation creation, $1.32 conservative reservation, immutable
  settlements and blocking on unresolved/unknown costs. Known-cost invalid
  output is retained as failure; the live evaluation batch stops. No retry or
  fixture fallback is automatic. Structural validity is not semantic accuracy.
- Actual hosted read-only preflight passed: all five M1 tables empty and both
  expected buckets private. Three additional direct HTTP reads found anonymous
  workspace SELECT denied (401), zero visible anonymous buckets and Auth
  settings reachable (200; email enabled). These nine service HTTP requests
  made no writes. Connector metadata/SQL reads additionally confirmed Seoul,
  ACTIVE_HEALTHY, PostgreSQL 17.11.0.003, all five RLS flags, session-aware
  ownership policy and restricted RPC/Storage permissions.
- Both normalised stored migration hashes again match the local hashes in the
  mapping below. An initial inspection query had a syntax error; its corrected
  read-only query succeeded. No repair, SQL application or rename occurred.
- Actual Magic Link/PKCE, A/B isolation, upload/download, persistence across
  app restart, conflict/deletion and cleanup remain **blocked on two authorised
  test mailboxes**. No email, test user, data or Auth change was made. The
  local-only E2E guard remains unchanged. Hosted Storage patch status and
  redirect/template settings still require verification.
- Checks run in this follow-up: 67 unit tests, typecheck, lint, plan-only and
  one fixture evaluation passed. The fixture result is structural evidence only.
  No build/browser rerun was needed for the evaluation-only source changes;
  the older 8-browser-test result below is historical, not a new service result.
- Meta requests: **0**; incremental Meta cost: **$0**. Account billing was not
  inspected. No live quality result or replay artefact exists. No commit, push,
  deployment, credential change or paid-plan change occurred.
- The [organiser page](https://dev.meta.ai/events/global-hackathon) still states
  4 November, 21:00 ET (5 November, 11:00 KST). The linked public event page does
  not expose participant submission requirements. Browser access host was
  unavailable; a participant portal URL/session is still needed. No terms were
  accepted or submission made.

### Proposed migration reconciliation — not executed

Prefer preserving the existing local ordering and repairing only remote history
after separate approval: retain an export of the two current history rows and
SQL; recheck the exact target and hashes; mark remote versions `20261029165946`
and `20261029165951` reverted in history and mark local versions `20261028155626`
and `20261029150829` applied. The CLI help and
[repair documentation](https://supabase.com/docs/reference/cli/supabase-migration-repair)
were inspected. This is a history operation, not a schema rollback/reapplication.
It needs a maintenance window without concurrent migration work, an authorised
connection and immediate read-back; a partial repair must stop deployment.

Simply renaming M1 files to the remote timestamps would put the existing M2
file before its prerequisites in fresh installations. Do not do that. Do not
run remote `db push` while the mapping is unresolved.

M2 review found an additive transaction creating three RLS-protected tables,
an index and a service-only SECURITY INVOKER RPC. It depends on M1 workspace
ownership/session policies, receipts and lock ordering. It adds no bucket or
Auth setting. Existing local SQL/domain tests pass, but hosted compatibility,
concurrent writes, source invalidation and retention/cleanup need real service
tests. After M1 acceptance and history reconciliation, recheck name collisions,
grants and the current SQL checksum, then request separate approval for exactly
`20261029165416_investigation_flow.sql`; verify policies and the full journey
afterwards. Approval is not requested prematurely in this follow-up.

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
