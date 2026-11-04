# Real-World Vision Evaluation — Input Readiness and Effort Comparison

Status, 4 November 2026: the initial ten Minimal requests and the later twenty
Medium/High requests completed **30/30 Standard responses and schema checks,
with no retries**. These repeat ten cases across nine unique photo editions.
Assistant review coverage is described separately for each batch; **human
reviewed: 0/30, semantic accuracy NOT MEASURED**. The app now defaults to Medium.
The 3 November offline preparation remains 23/23 images and 35/35 payloads;
18 images and eight comparisons pass the scoped rights/privacy assessment.

## Cause and Image Strategy

The old 512 KiB / 1024px PNG gates were local experiment safeguards in
`investigation.ts` and `model-provider.ts`, not Meta requirements. The official
[Image Understanding documentation](https://dev.meta.ai/docs/image-understanding),
inspected on 3 November, allows inline JPEG/PNG/WebP and other formats up to
50,000,000 bytes per image. Supporting these provider formats does not require
passing untrusted originals directly to the provider.

| Boundary | Current application policy |
| --- | --- |
| Original archive upload | Unchanged: 6 MiB; separate archive validation |
| Decode | Static JPEG/PNG/WebP only, 24 million pixels; malformed, animated and multipage input rejected |
| Model preparation | EXIF orientation, sRGB, metadata removal, fit inside 2048×2048 without enlargement; lossless PNG, compression 9, adaptive filtering, no palette quantisation |
| Prepared input | 8 MiB per image; no automatic lower-quality fallback |
| Provider payload | At most two sources, 24 MiB serialised request, 6,000 text characters, 1,200 completion tokens, 45-second request timeout |
| Processing | Sharp ten-second processing timeout per operation; bounded source/output bytes and pixels. This is not a separate hard OS memory limit or a queue/wall-clock deadline. |

The application and evaluator call `src/lib/model-image.ts`. It records separate
source/prepared hashes, MIME, bytes, dimensions, orientation, resize/depth/colour
changes, settings and Sharp/libvips versions. PNG framing, CRCs, allowed chunks,
data URL, dimensions and full decoding are checked before a live reservation.
EXIF/GPS/XMP/ICC are not forwarded. Errors distinguish source size, format,
animation, pixel count, decoding, timeout and prepared size; successful encoding
never certifies legibility. Resizing/depth conversion requires visual review.
The saved original and prior records remain unchanged on preparation failure.

Lossless PNG, JPEG quality 92 with 4:4:4 chroma, and WebP quality 92 were compared
on all 23 selected editions. JPEG/WebP were smaller but changed decoded pixels
in 23/23 cases each (8-bit RMSE approximately 1.00–2.70 and 1.59–2.86 respectively).
These are encoding comparisons, not OCR scores. PNG retained all normalised
pixels and was already within the new bounded payload policy, so lossy fallback
was unnecessary. Reproducibility is within the recorded Sharp/libvips profile;
a changed runtime/profile must regenerate hashes and receive new approval.

## Offline Result — 3 November 2026, Before Paid Execution

| Evidence | Earlier preparation | Current pipeline |
| --- | --- | --- |
| Prepared images passing the input gate | 7/23 | **23/23** |
| Images blocked by size | 16/23 | **0/23** |
| Planned requests passing the provider gate | 11/35 | **35/35** |
| Requests blocked by image preparation | 24/35 | **0/35** |
| Decoded pixels identical after orientation/sRGB | Not established | **23/23**, no resize on these selected editions |
| Rights/privacy-eligible requests | Not established | **26/35**: 18 observations + 8 comparisons |
| Actual real-photo Meta attempts | 0 | **0** |
| Human-scored real-photo responses | 0 | **0** |

Prepared PNGs range from 82,943 to 2,476,897 bytes. All original preview hashes
were rechecked. The earlier immutable packet and failed preflight findings remain
available; input success must not be called model accuracy or human acceptance.

Assistant comparison found no additional pixel loss in the selected editions.
Existing limitations remain: `rw-07` has faint small handwriting; `rw-08` has
erased/overlapping marks; `rw-11`–`rw-13` have displaced/cropped/worn lettering;
`rw-14` has a readable large sign but tiny timetable text; `rw-15` is faded;
`rw-16` cannot support a reliable complete inscription. Colour in `rw-05` and
`rw-20` is retained, but no calibrated colour-accuracy claim is made. The seven
330px source editions still lack fine detail. Unreadability is an intentional
abstention challenge, not an automatic processing or model success.

## Dataset, Rights and Reference Annotations

The [manifest](../tests/fixtures/real-world/manifest.json) contains 23 distinct
candidates and 12 predeclared pairs. Twenty-two are photographs; `rw-18` is a
photographic advertisement, explicitly a mixed document. A downloaded
illustration, `rw-17`, remains excluded. The sample is dominated by signage,
not representative family photographs. It covers printed Korean/English,
handwriting, other scripts, clutter, fading, historical material, unrelated
pairs and authored contradictory controls. There is no verified handwritten
Korean or controlled motion-blur stratum. No cause of blur/damage is invented.

The actual editions are **16 JPEG previews 960px wide and seven 330px previews**.
Only `rw-01` and `rw-03` additionally have full-resolution originals retained
locally. Their hashes are separate; all 35 inputs use the preview editions.
A preview hash is not a full-resolution-original hash. Rate-limited downloads
were not bypassed. Replacing an edition changes the manifest and approval.

All 23 original source pages and their relevant licence sections were retrieved
and inspected in this sprint. The [rights assessment](../tests/fixtures/real-world/rights-review.json)
records source URL, retrieved page hash/time, licence, attribution, conditions,
privacy and separate external-inference/public-redistribution decisions.
Original metadata snapshots and images remain local under `.local/real-world-v1/`;
new source-page evidence is under `.local/vision-v2/rights-pages/`.

| Classification | Count / cases | Reason |
| --- | --- | --- |
| Permitted for bounded Standard inference under the stated public licence | 18 images; 26 requests | Public reproduction/technical-conversion grant, retained attribution, screened subject, no Contributor training |
| Additional conditions or underlying rights unresolved; excluded from paid proposal | 5 images: `rw-10`, `rw-18`, `rw-19`, `rw-23`, `rw-24` | Substantial third-party handwritten message; photographic advertisement/territorial copyright; historical people and underlying rights; prominent graffiti; illustrated artwork |
| Confirmed prohibition | None established | Uncertainty is still exclusion, not permission |

The licence assessment follows [Creative Commons guidance on AI and licences](https://creativecommons.org/faq/#artificial-intelligence-and-cc-licenses)
and the applicable licence texts. It is a scoped assessment of reproduction for
private Standard inference, **not an assertion that each page explicitly says
“AI permitted”**. LERK attribution/title/licence conditions are retained.
Copyright permission does not itself clear privacy or personality rights.
Public redistribution is a separate conditional decision; **none of these
photos is approved for, or added to, the public demo**. The advertisement stays
excluded. Source metadata alone does not establish historical ground truth.

Annotations distinguish visible provisional facts/locations, plausible but
unconfirmed interpretation, illegible content and source uncertainty. Catalogue
names/dates, expected connections, filenames and annotations are excluded from
model inputs. Comparisons use `observations=[]`; they are independent baseline
comparisons, not an observation-assisted pipeline. An expected category does
not force a connection: insufficient evidence may justify `no_connection`.
Human verification of **all 23 annotation sets remains PENDING**.

## Reproducible Tool and Human Review

Run `npm run evaluate:real-world` with the retained local dataset, or set
`REAL_WORLD_DATA_DIR`. It checks hashes/dimensions/unique samples, applies the
shared image preparation, validates exact provider payloads and creates a new
immutable `evaluation-results/real-world-*` packet. It never loads `.env.local`,
blocks `fetch`, creates no allowance and changes no ledger.

The packet contains `manifest.json`, `rights-review.json`, `plan.json`, exact
image-inclusive `inputs.json`, `batch-proposal.json` and its SHA-256,
`records.json`, `summary.json`, `review-template.json`, `review.html`, and
photo/case/claim CSV exports. Original and prepared images appear side by side,
with keyboard-accessible actual-pixel viewing, hashes and conversion details.
Human-completed, assistant-only and pending items are labelled separately.
Raw model output and reviewer judgement remain separate. CSV formula prefixes
and HTML content are escaped. No external request occurs when opening the page.

`REAL_WORLD_RECORDS` may import retained results. A record specifies case/input
hash, provider mode, transport outcome, original output and optional review.
The tool validates supplied records, not their authenticity: retain and verify
raw provider responses, usage, request hashes and ledger separately. Fixture and
Replay results are excluded from live-quality rates; failures/unknowns remain.

Before scoring, a person compares the source and prepared editions and confirms
or corrects the provisional reference facts. Then split every output field into
atomic assertions; compare each with its cited source/location. Grade grounded,
incorrect, unsupported or unverifiable, and separately tag wrong source,
invented person/date/relation, uncertainty and other defects. Mark every
annotated fact present/omitted/uncertain and every question useful/not useful/
leading/unassessable. Grade connection and uncertainty separately. Empty observe
questions are required; empty compare questions remain a product shortfall.

Severity: 0 none; 1 minor; 2 materially misleading description/source/uncertainty;
3 invented identity, kinship or history. Any severity 2/3 or forced connection
blocks promoting that behaviour as validated quality. Preserve failures and
seek another reviewer for serious disagreements. Field coverage is automatic;
complete atomic-claim splitting still requires a human attestation.

Reviews bind input/output hashes and require every output field, annotated fact
and question. Blank templates cannot pass. Assistant review is excluded from
human rates. Reports expose denominators for transport/attempts, schema/transport,
grounded/reviewed claims, omissions/annotated facts and useful/reviewed questions.
**Zero denominator means NOT MEASURED**, never 0% or 100% accuracy.

## Historical Initial Paid Proposal — 3 November 2026

This section preserves the original proposal. It was subsequently approved,
then renewed only for expiry and executed as recorded below; it grants no
remaining calls.

Public [model](https://dev.meta.ai/docs/models) and
[price](https://dev.meta.ai/docs/pricing-rate-limits) verification: 3 November
2026, 12:09 UTC. Standard `muse-spark-1.3`: US$1.25/M uncached input tokens and
US$4.25/M output tokens. This is public availability, not a fresh account probe.

The ten cases, in exact order, are observations `rw-01`, `rw-07`, `rw-08`,
`rw-14`, `rw-16`, `rw-20`, then `pair-01`, `pair-05`, `pair-09`, `pair-10`.
This uses nine distinct photographs and one clearly authored false text control.
The proposal contains full source/prepared/ModelInput/request hashes, actual
input order, MIME/profile, source IDs/REV1 and rights. These are **local evaluation
IDs**, not Supabase records. No remote registration is needed for this standalone
experiment. Moving it into the app would require new IDs/hashes and approval.

Proposed expiry: **4 November 2026 03:00 UTC / 12:00 KST**. No retries; at most
1,200 completion tokens and 45 seconds per request; no tools or extra API calls.
The budget guard is unchanged: US$5 maximum per allowance, US$1.32 reserved per
request. Four new allowances of **3 + 3 + 3 + 1** calls would have caps of
**US$3.96 + 3.96 + 3.96 + 1.32 = US$13.20 total**. Existing four exhausted,
expired allowances and their records remain untouched. At this preparation
stage no new allowance existed.

A planning assumption of 2,000–8,000 input tokens and all 1,200 output tokens per
request gives **US$0.076–0.151** for ten calls. This is not token measurement,
a promised charge or the spending cap. No token-count API was used. Usage-based
calculation and the eventual account invoice must be reported separately.

Execution must use one durable aggregate journal in addition to existing guards,
serial dispatch, one attempt per case, and verified remaining calls/cost before
every request. Any failure, timeout, unknown usage/cost or inconsistent ledger
stops **the entire batch**, including later allowances. Do not use splitting to
bypass a block. No live batch runner or usable approval file was activated.
Changed hashes/profile/prompt/model/expiry require a fresh proposal and approval.
Human scoring remains pending even after a future successful API response.

## Historical Evidence and Submission Claims

Four retained synthetic successes were reassessed in the preceding preparation
session, not rerun: standalone image, app text, app image and app comparison.
The retained `.local/real-world-v1/historical-review.json` binds that assistant
review to original evidence hashes. Supported strings/colour and both-source
citations do not demonstrate broad photographic accuracy. M2-A contains an
unsupported compression explanation (severity 2; 1/2 inspected synthetic image
observations). M2-B returned no questions (product shortfall; 1/1 inspected
comparisons). These selected denominators are not real-photo error estimates.
The public demo preserves the correction, empty-question result and human
question path. At that preparation stage, no real-photo evaluation had run.
The public demo was not edited or supplied any evaluation photograph in this
paid batch session.

The earlier preparation reported 102 unit/DB tests, 10 browser passes/2 skips
and the 16/23 image-size failure. These are historical results. This sprint's
fresh results are recorded below. Completed hosted Supabase acceptance and
cleanup were not rerun; no local mock closes A/B, HTTPS or token-replay gates.

## Fresh Verification — 3 November 2026

- Full unit/PGlite suite: **115 tests / 17 files passed**. Covers static formats,
  corruption, APNG/animated WebP, excessive pixels, output size, EXIF removal,
  deterministic/new hashes, MIME/CRC/metadata checks, decode before reservation,
  rights/hash batch exclusions, CSV escaping and semantic denominator separation.
- Offline real-photo run: **23/23 prepared, 35/35 provider-valid, 26/35 rights
  eligible, zero live attempts, zero human scores**. Final review changes were
  checked again with the 12 evaluation unit tests and a new immutable packet.
- Synthetic fixture evaluation: three development cases recorded; no live call.
- Typecheck, ESLint and production build passed. Lint: zero errors, two existing
  warnings in protected local scripts. Those files were not changed.
- Playwright: **10 passed, 2 local-Supabase cases skipped**, desktop and mobile,
  including Investigation and human questions with server/PGlite restart.
  Occupied port 3000 was left alone; tests ran on isolated port 3100.
- Offline worksheet browser check: 46 images loaded, keyboard actual-pixel view,
  no page overflow at 1280px/390px, zero HTTP requests. Assistant visual checking
  is separate from human annotation review and actual model quality.

- Protected-file check: all 171 pre-existing inventoried files retained their
  hashes. A scan of 786 build/public files found none of three configured secret
  values; this exact-value check is not a complete security audit.
- `git diff --check` passed.

The packet, original source evidence and protected ledgers are local-only.
No new Meta request, Supabase mutation, deployment or submission was performed.

## First Paid Batch Preflight — 4 November 2026

The user approved the fixed ten-request scope, but its original expiry was
4 November 12:00 KST. At the 15:38 KST check it had expired, so no request was
sent and no active allowance was created. An expiry-only renewal was requested;
the user subsequently extended it to 5 November 09:00 KST. The fixed proposal
and inputs remain unchanged; the completed execution is recorded below.

Fresh checks matched all ten ModelInput/request hashes and the exact input
bytes, source order/revisions, MIME and preparation profile. The nine selected
source pages retain the same licensing text; the private Standard-use assessment
is unchanged. Reference annotations and the scoring rubric were frozen before
any model output. Nine selected photo annotations remain human-review pending.

An exclusive durable batch journal now supplements the unchanged per-allowance
guard. It rejects duplicates, an eleventh request, stale approval, changed hashes
and unresolved outcomes; a known-cost provider validation failure also stops all
later groups. The default runner is offline and needs explicit execution plus a
current expiry-renewal authorisation to enable live use. At this preflight stage,
the code was local and uncommitted; later Git authorisation is separate.

Fresh verification: 120 unit/PGlite tests in 18 files passed, including five new
journal tests; focused Provider/evaluation/journal checks passed 24 tests.
Typecheck, scoped ESLint and fixed-input offline preflight passed. The 271
pre-existing protected files retained their hashes. No production UI changed,
so browser tests and hosted acceptance were not rerun.

Pre-renewal snapshot: attempts/successes/failures/not-run **0/0/0/10**; no tokens
or calculated cost at that time. This is historical, not the final batch result.
Local preflight evidence and the expiry amendment are under
`.local/real-photo-batch-2026-11-04/`. Historical synthetic findings are separate.

## First Real-Photo Execution — 4 November 2026

The user renewed only the expiry to **5 November 09:00 KST**. The fixed original
proposal, ten input/request hashes, order, nine photograph editions, local source
IDs/REV1, model and limits were unchanged. Fresh official model/price verification
was at 06:38:22 UTC; nine licensing texts matched the retained source-page review.
Frozen provisional references and the rubric predate every response.

| Evidence | Result |
| --- | --- |
| Model / mode | `muse-spark-1.3` / Standard |
| Actual requests / success / failure / unrun within approved ten | **10 / 10 / 0 / 0** |
| Retries / additional probes | **0 / 0** |
| Structural validation and permitted Source/Revision references | **10/10**; not a semantic-correctness score |
| Prompt / completion tokens | **22,293 / 6,491**, provider-reported; completion includes reasoning tokens |
| Calculated usage cost | **US$0.055453**, using US$1.25/M input and US$4.25/M output |
| Reservation ceiling | **US$13.20**; four fresh allowances 3+3+3+1, all request quotas consumed |
| Account invoice | **Not checked**; calculated cost is not confirmed billing |
| First dispatch to final response | **15:59:40–16:02:10 KST**, 150.045 seconds; summed provider latency 97.274 seconds |
| Human responses scored | **0/10**; all PENDING, accuracy NOT MEASURED |

The assistant compared all nine downloaded JPEG editions and their exact PNG
inputs. It recorded 194 separate judgements across claims, locators and
uncertainty fields; these are not independent trials or human-scored accuracy.
All results, including defects, remain in the private packet:

| Case | Assistant preliminary finding; human confirmation pending |
| --- | --- |
| `rw-01` | Main Korean/English station names, codes, arrow and coloured light grounded; Chinese `首尔诙` misreads visible `首尔站` |
| `rw-07` | Karaoke/Please, printed song titles and layout supported; `AGAS` appears to misread handwritten `ACAS`, despite a caveat |
| `rw-08` | Title, visible date/time and most line names supported; dark X marks called red, printed date labels included in “handwritten”; small parentheticals unresolved; bottom Loop Elevated X omitted |
| `rw-14` | NO STANDING, bus/accessibility icons and double-headed arrow supported; blanket timetable illegibility misses visible QM16; “parked” is not established from the still alone |
| `rw-16` | Correctly abstains from transcribing worn stone; no invented name/date |
| `rw-20` | Store lettering and facade layout supported; trim material and mannequin/person distinction unresolved at 330px; no catalogue history promoted to visual fact |
| `pair-01` | Both Seoul/P313 sources cited correctly; tentative topic link with time/location unknown |
| `pair-05`, `pair-09` | `no_connection` is consistent with visible unrelated subjects; no evidence-array entries, limiting citation detail |
| `pair-10` | Correctly contrasts photographed LANE CLOSED with authored false LANE OPEN; does not assert a different historical event |

**All four comparison responses returned zero questions.** This repeats the
M2-B product shortfall; question usefulness has denominator zero. Empty questions
in the six observe responses are required by the existing contract. No forced
identity/date/kinship link was found in this assistant review; nine selected
public preview editions do not establish broad real-photo reliability.

Reference erratum: frozen `rw-14-f1` says “right arrow”, but the image and model
show a double-headed arrow. The frozen file was not edited. Its omission grade
is uncertain and a separate erratum requires human adjudication before scoring.
Do not penalise the model for that reference defect. Small OCR, colour, overly
broad legibility claims and unresolved materials require review before any claim
of reliable transcription. Human-authored questions remain the available product
path; future prompt experiments need new hashes and separate paid approval.

The retained four synthetic successes and their M2-A unsupported compression
explanation / M2-B empty questions remain a separate cohort. This batch added no
Supabase, persistence, security or deployment acceptance evidence.

Local evidence: `.local/real-photo-batch-2026-11-04/` contains authorisation,
40 chained journal events, four fresh ledgers, ten original provider responses,
usage, frozen criteria, assistant findings, reference erratum and `batch-report.md`.
The refreshed offline packet is
`evaluation-results/real-world-2026-11-04T07-12-12.085Z-25fe9875-c3fd-4cbb-8fc7-4894120061fd/`.
It imports ten actual results; the other 25 dataset cases are NOT RUN. Its
historical proposal is not new execution authority. `review.html` separates the
ten human-pending responses from unrun cases and exports JSON/CSV judgements.

Post-execution checks: all 271 pre-existing protected files unchanged; all ten
result hashes, request identities, raw model payloads and ledger settlements
match the journal. Live is disabled and no call quota remains. Offline import
passed; 17 focused journal/evaluator tests passed after report-label corrections;
typecheck, scoped ESLint and diff check passed. The worksheet loaded all 46 images
at 1280px/390px, keyboard zoom worked, no page overflow or HTTP request occurred.
The earlier 120-test full suite is the pre-execution run from this session;
production build/application E2E remain the separately dated 3 November results.
No Git stage/commit/push, deployment or submission was performed.

## Medium/High Comparison — 4 November 2026

The user authorised local preparation for higher effort and less restrictive
limits. Named `medium` and `high` profiles now use **8,192 completion tokens,
180-second timeout and a 512 KiB raw-response bound**. Both preserve Standard
mode, the same image pipeline, prompt and schema. During comparison preparation
the app remained at baseline minimal/1,200/45s; the later Medium app decision is
recorded below. Historical evaluation requests remain reproducible. The profiles
are server-side options, not a public UI control.

New settings require fresh approvals bound to the **ModelInput hash, complete
request hash and execution-settings hash**. Legacy allowances cannot enable
them. The conservative reservation is US$1.35 per higher-effort request; the
US$5 per-allowance ceiling and fail-closed unknown-cost behaviour remain intact.
An already attempted bound execution cannot be repeated from its allowance.
The journal supports a distinct fixed twenty-request policy with a US$27 ceiling.

The local proposal at `.local/effort-comparison-2026-11-04/batch-approval.md`
fixed the same ten cases, medium then high for each, **20 requests maximum**,
zero retries and expiry **5 November 09:00 KST**. Seven fresh allowance groups
contained 3+3+3+3+3+3+2 requests. Planning usage was approximately US$0.752
if earlier prompt usage repeats and every request consumes all 8,192 completion
tokens; that is not a guaranteed invoice or the US$27 reservation ceiling.
The later explicit user approval authorised this exact proposal; its original
planning file was preserved and the execution authority was recorded separately.

The paired medium/high comparison changes only effort. The earlier minimal
batch also had a smaller output/time cap, so improvement over that historical
batch cannot be attributed solely to effort. One sample per case/setting is
exploratory; human review and the disclosed reference erratum remain pending.
Increasing effort is not evidence that OCR or question generation improves.

Fresh verification: **128 tests / 20 files passed**, including a fully mocked
twenty-request run through the real runner, budget guard and journal. Typecheck,
scoped ESLint, production build and offline proposal generation passed. The
offline proposal regenerated the original 23 photo preparations and matched all
ten baseline inputs/request hashes. All **406 pre-existing protected files**
retained their hashes. The first batch journal source was separately archived
before extending its policies; its previous execution records are unchanged.
No application UI changed, so application browser tests were not repeated.
Those 128 tests and build checks were completed before the following paid run.

### Actual execution and preliminary findings

All **20/20 requests** succeeded at HTTP, response-schema and source/revision-ID
validation; failures 0, not run 0, retries 0. Each original case ran medium then
high with identical inputs and the same 8,192-token/180-second limits. Public
model/pricing information and all nine selected Commons licence-page summaries
were rechecked before dispatch. No extra probe or substitute inference ran.

| Setting | Requests | Input tokens | Completion tokens (including reasoning) | Calculated USD | Mean provider latency |
| --- | ---: | ---: | ---: | ---: | ---: |
| Earlier minimal | 10 | 22,293 | 6,491 | 0.055453 | 9.7s |
| Medium | 10 | 22,293 | 19,910 | 0.11248375 | 21.1s |
| High | 10 | 22,293 | 25,461 | 0.13607550 | 25.7s |

The new run used 44,586 input and 45,371 completion tokens, including 37,151
reasoning tokens. Calculated usage was **US$0.24855925**, distinct from the US$27
maximum reservation. No unknown settlements remain; the actual invoice/balance
was not checked. First dispatch to last response took 725.783 seconds
(17:49:26–18:01:32 KST); the runner including local guards took 751.91 seconds.

Assistant visual comparison found both settings transcribed the Seoul sign's
Chinese `首尔站`, correcting the earlier minimal substitution. High read the
karaoke handwriting as `ACAS`, while medium retained `AGAS`; human adjudication
is pending. High also introduced a small printed-header substitution (`Pecana`
for apparent `Pecena`) and misplaced orange marks. On the elevator board, medium
declined an uncertain parenthetical word; high wrote `Midway` without sufficient
visual support. Both missed the dark Loop Elevated X; high additionally said
the other boxes were blank. This is a potentially material status error, flagged
as an exploratory finding rather than inserted into the frozen recall denominator.
Medium overidentified small shop-window figures as mannequins in dresses;
high used the less specific “display figures”. Weathered stone lettering remained
untranscribed, and no identity/kinship/history invention was found in this limited
assistant review. These are selected findings, not a complete atomic claim grade.

All four comparison outcomes were unchanged across settings: one related
candidate and three `no_connection` results, including detection of the authored
LANE OPEN/CLOSED contradiction. Comparisons containing a question were 0/4 for
earlier minimal, 1/4 for medium and 2/4 for high; new total questions were 1 and 2.
Both asked an open context question for the station pair. High's extra question,
“What is visible in the second record?”, poorly fits an already supplied text
memo. More effort did not guarantee useful questions or eliminate transcription
errors. Empty observe questions remain required by the contract.

Human review is **0/20 for this new run**; all twenty remain PENDING. The earlier
ten remain separately pending (30 outputs over the same nine unique photos, not
30 independent photos). Semantic accuracy and human question-usefulness rates
are not measured. The selected assistant flags have field/quote references and
severity but deliberately do not claim exhaustive review or Human PASS.

Evidence is in `.local/effort-comparison-2026-11-04/`: `comparison.html` presents
all three settings and original/submitted images, `batch-report.md` explains the
results, `execution/` retains all raw responses and seven new ledgers, and
`assistant-preliminary.json`/CSV and `targeted-flags.json` retain provisional
findings. `review-packets.json` links two new imports into the existing evaluator;
each contains ten actual outputs, 25 NOT RUN cases and bound human-review
templates. Historical baseline preflight settings are labelled separately from
the imported executions' actual settings. Original frozen references and the
double-headed-arrow erratum are preserved.

Post-run audit verified all twenty request/result identities, the complete
journal chain and settlements; **406 pre-existing protected files** and all
twelve approved runtime files retained their hashes. Both offline imports passed
with network calls disabled. Six local browser checks (three views at 1280px and
390px) loaded all expected images, supported keyboard controls, had no page
overflow, script errors or HTTP requests. Typecheck, scoped ESLint and diff check
passed after the import-metadata clarification. No further production build or
application E2E was needed for these report-only changes; the pre-run results
above remain separately identified. Live is disabled, all request quotas are
consumed, and Git stage/commit/push, Supabase writes, deployment and submission
were not performed.

At batch completion, medium was a reasonable provisional default candidate for
further review, not a demonstrated accuracy winner; the app had not yet changed.
Prioritise human adjudication of OCR/status flags, then a separately
approved prompt experiment on uncertain text and questions appropriate to each
source type. Preserve the working human-correction/question route for submission.

### Subsequent app default decision — 4 November 2026

After reviewing the batch, the user selected **Medium as the application default**.
The app now passes the medium profile explicitly: 8,192 completion tokens and a
180-second provider timeout. Historical evaluation defaults, approved request
bytes and all existing ledgers remain unchanged. High remains an explicit future
choice; no automatic escalation or extra inference is enabled. App runs are only
marked as having an unknown outcome after the provider timeout plus a 60-second
preparation/processing grace, avoiding the old two-minute premature status.

This is a local configuration change, not a new live execution or deployment.
It grants no new allowance. The product priority is photo clues → useful memory
questions → human testimony with sources; OCR is a supporting capability whose
errors matter most when they change a place, date or relationship claim. The
proposed acceptance criteria and the sign-heavy sample's limits are documented
in [the product brief](product.md#사진-중심의-우선순위--4-november-2026).

Verification for this subsequent change: 21 focused tests passed, then the full
132-test/21-file suite, typecheck, scoped ESLint, production build and diff check
passed. The new app-boundary tests used mocked HTTP/Auth/storage, verified the
actual Medium request body and saved inference metadata, rejected legacy
unbound approval before sending, and checked the longer pending-status window.
They are local configuration evidence, not new Meta or hosted Supabase evidence.
No application browser test was repeated for this server configuration change.
The subsequent whole-repository lint also exited successfully with zero errors;
three warnings were confined to ignored local verification scripts, outside the
commit scope. Code, tests and sanitised documentation were later authorised for
Git publication; raw packets, private files and allowance ledgers stay local.

The retained `real-world-batch` and `real-world-effort` runners are historical,
fixed-batch audit implementations. They require private local packets and pin
the originally approved Git baseline; they intentionally refuse a later checkout
and do not authorise reruns. A future photo cohort needs a new fixed proposal and
approval rather than editing old authorisations or journals.

## Photo inquiry pilot — 5 November 2026

Three public-domain FSA-OWI photographs were selected for everyday objects and
memory questions, separately from the earlier nine-photo / thirty-request
effort experiment. The source collection's [rights statement](https://wwws.loc.gov/rr/print/res/072_fsac.html)
and item provenance were retrieved before transmission. These are existing
historical photographs, not generated family images. Neutral scene/object use
was screened separately from copyright; no identity, kinship or sensitive
personal inference was requested. Catalogue names/dates were held out of inputs.

| Photo / source | Edition and preparation | Remaining limit |
| --- | --- | --- |
| [Group indoors, LC-USF35-585](https://commons.wikimedia.org/wiki/File:Jack_Whinery_and_his_family,_homesteaders_1a34169v.jpg) | Russell Lee / Library of Congress. JPEG 1024×792 → PNG at the same dimensions. | Source descriptions disagree on month; small calendar text is not a capture date. |
| [Meal, LC-USF35-326](https://commons.wikimedia.org/wiki/File:The_Faro_Caudill_(family)_eating_dinner_in_their_dugout,_Pie_Town,_New_Mexico_LCCN2017877693.jpg) | Russell Lee / Library of Congress. JPEG 4737×3308 → PNG 2048×1430. | Fine lettering/food detail can be lost on resizing; jar contents are uncertain. |
| [Quilt, LC-USF35-577](https://www.flickr.com/photos/library_of_congress/2178354733/) | Russell Lee / Library of Congress official Flickr preview. JPEG 500×386 → PNG at the same dimensions. | Low resolution; most small lettering is unreadable. No enlargement or invented transcription. |

All three editions and seven initial payloads passed offline preparation. Exact
original/prepared bytes, hashes, input order, provisional reference facts, rights
and execution identities were frozen locally before each phase. Human reference
review stayed PENDING. Photographs were not uploaded to Supabase.

| Phase | Actual requests | Output / review distinction |
| --- | ---: | --- |
| Initial observation/comparison | 7 | Three observations and four comparisons. Structurally valid. Assistant found generic questions and an unsupported use of scene differences as contradiction. |
| Initial selected-clue inquiry | 3 | Three questions per photo. Assistant found repetitive reassurance and questions asking for already visible details. |
| Paired prompt refinement | 7 | Same four comparisons and three inquiries with new guidance/hashes. Two shorter questions per inquiry. Missing links were separated from contradiction; a conflicting note still returned no questions. |
| Total | 17 successful / 0 failed / 0 retried | Three unused slots deliberately left unspent; programme closed, Live disabled. Human quality review 0/17. |

Model: `muse-spark-1.3`, Standard, Medium; 8,192 maximum completion tokens,
180-second timeout, zero retries. Reported usage totals: 54,239 input and 34,503
output tokens; summed request latency 377,239 ms. At the verified Standard
prices ($1.25/M input, $4.25/M output), calculated cost is **$0.2144365**.
Actual billing is unverified. Conservative reservation was $22.95 inside the
$27/20-request programme; unused capacity is not permission to rerun it.

Assistant preliminary findings: people/table objects, patterned textile and
several surrounding clues were consistent with the inspected images. The model
abstained on small quilt lettering and uncertain jar contents. Earlier questions
were verbose and weak at eliciting memories; the refined jar-use and quilt-use
questions better address missing context. These are qualitative observations,
not human scores. Some wording still assumes familiarity or routines, and the
same three photographs were reused during refinement, so no independent
generalisation or accuracy gain is established. No face matching was evaluated.

A further output review found a remaining overclaim in `group-quilt-refined`:
although `contradicts` is empty, its statement and unknowns say “different
people”. The pictures alone do not establish different identities. This remains
an unresolved, medium-severity assistant finding; moving a claim into an
uncertainty field does not make it grounded. The public limitations disclose it.
Future evaluation must check both same-person and different-person assertions,
and use a fresh holdout set before claiming that a prompt change generalises.

The offline review packet retains all 17 original responses, both prompt
versions, source/input images, raw usage, CSV exports and per-field human-review
templates. Reviewers must split compound claims, compare both image editions,
score omissions/uncertainty/questions separately and preserve failed claims.
No Human PASS or semantic percentage is emitted for an empty review denominator.

The public sample displays only credited web derivatives of these three photos
and selected exact observation/question excerpts. It labels invented practice
answers and discloses earlier limitations; it is not a complete evaluation
report. Source/prepared/public-display hashes are separate in the private
curation manifest. No raw model logs, allowances or private identifiers are
published. The original twenty-three-photo dataset and all earlier ledgers remain
preserved; this three-photo pilot does not replace or enlarge their denominators.

### Public text-in-photo example — 5 November

The photo-first demo now includes a separate storefront study from `rw-20`,
with an exact Medium observation excerpt and the overclaim in the same response.
The assistant verified visible `stevensons` lettering; the small window figures
still do not establish “mannequins in dresses”. Human review remains PENDING.
This belongs to the earlier 30-request cohort, not the 17-request photo pilot.

Source: Flip Schulke / U.S. National Archives, NAID 558126. The [source licensing
section](https://commons.wikimedia.org/wiki/File:A_NEWLY_RESTORED_AND_PAINTED_OLDER_STOREFRONT_ON_MINNESOTA_STREET_IN_NEW_ULM,_MINNESOTA._THE_BUILDING_NOW_HOUSES_A..._-_NARA_-_558126.jpg#Licensing)
was rechecked on 5 November and identifies the EPA photograph as public domain.
The public asset is a metadata-free, lossless WebP copy of the evaluated 330×489
JPEG edition. Decoded RGB pixels match exactly; no enlargement, sharpening or
replacement by a higher-resolution image was used to illustrate model quality.

- Evaluated JPEG SHA-256: `c78f126edc2bd9227cabf69b57c333e95757b9d630237175bea5236c80c9ae32`.
- Public WebP SHA-256: `a8fbb25fb6dbf4cf6546dc1f40955e7e055a10e9098684e1eb02b4987449143b`.
- Fresh verification: 146 unit/PGlite tests, 14 desktop/mobile browser tests,
  typecheck, ESLint, production build and the separate static-only build passed.
  Two real Supabase browser tests remain skipped. The first focused browser run
  used the old production build and failed to find the new section; rebuilding
  and rerunning the complete browser suite resolved that stale-build failure.

No new inference was needed for this curation. The ORBIT example remains an
explicit historical synthetic study and is excluded from the new photo-first
recorded walkthrough. The new video is still being reviewed, not yet uploaded.
