# Real-World Vision Evaluation — Input Readiness

Status, 3 November 2026: **23/23 images prepared and 35/35 provider payloads
validated offline; zero real-photo Meta calls and zero human-scored responses.**
Eighteen images and eight comparisons pass the scoped rights/privacy assessment.
A separate ten-request paid proposal is prepared, not authorised or executed.

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

## Actual Offline Result

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

## Initial Paid Proposal — BLOCKED Until Separate Approval

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
expired allowances and their records remain untouched. No new allowance exists.

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
question path, and explicitly says no real-photo model evaluation has run.

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
