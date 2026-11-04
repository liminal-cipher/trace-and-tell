# Submission Readiness — 5 November 2026

Status: local submission candidate; **not deployed, filmed or submitted**.
Use this packet with [implementation evidence](m1b-m2-implementation.md) and
[M1a security limits](m1a-implementation.md). It does not grant external approval.

## Official Requirements and Open Decisions

The [Meta organiser page](https://dev.meta.ai/events/global-hackathon) and
[Cerebral Valley event page](https://events.cerebralvalley.ai/e/meta-ai-developer-hackathon)
were retrieved on 3 November 2026. On 5 November KST the signed-in
[participant guide](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details)
and [submission form](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit)
were read in Edge. The following requirements supersede the earlier public-page-only check.

| Status | Finding / action |
| --- | --- |
| Confirmed | Public deadline: 4 November 2026, 9 PM ET, equivalent to 5 November, 11 AM KST. Recheck for organiser changes before submitting. |
| Confirmed | The form shows Indie Developer and Build for Your World selected. |
| Confirmed | A **public GitHub repository** and accessible **three-minute demo video** are required. All contributors must be listed, and the demonstration must identify work built during the hackathon. |
| Confirmed | Viability, theme and Meta use are pass/fail gates. Scored judging: impact 30%, Meta tooling 25%, technical execution 20%, demo 25%. The guide discourages simple image analysers; demonstrate the complete inquiry-to-exhibit workflow. |
| Confirmed | Fields include project description, Meta product use, why Meta matters, partner feedback and subjective API/tool surveys. An optional X link is shown. No separate live-URL field was observed; the guide mentions a live product alongside video and code. |
| Unconfirmed | Character limits and detailed video hosting/encoding restrictions were not established. Read the final rules before submission; this inspection does not accept them. |
| Decision before submission | Public repository publication needs a sensitive-history audit and separate authorisation. Video recording/hosting, any deployment, subjective survey answers and final submission remain pending. |

No login email was sent, agreement accepted, form saved or submission made.

## A. Submission Description

Trace & Tell — A Living Family Gallery helps family record keepers preserve the
context around photographs and notes before the people who remember it can no
longer explain it. It turns scattered records into questions worth asking and
small exhibitions whose statements remain connected to their sources.

Meta Standard `muse-spark-1.3` observes visible clues, compares records and suggests
questions about context the photograph cannot establish. A new Medium pilot made
17 successful requests on three public-domain historical photographs: three
observations, eight comparisons and six clue inquiries, including paired prompt
revisions. Early questions were repetitive and comparisons sometimes confused
different scenes with contradictions. Revised prompts produced shorter questions
about objects' use and kept missing links separate from contradictions. This is
an assistant's preliminary comparison on the same small sample, not a measured
accuracy gain; human quality review remains pending for all 17 responses.
One revised comparison still asserted “different people” without establishing
identity. That error is retained and disclosed; face matching is not a capability
claimed by this project.

Earlier authenticated synthetic runs also remain available. One comparison found
shared ticket/note markings but returned no questions. A person could still write
an open question, with explicit human attribution and no model/run attribution.

The record keeper can review, correct or reject observations and hypotheses,
select a question, record text testimony, and save an exhibit. Observations,
hypotheses, questions, testimony and exhibits remain distinct. A selected
hypothesis is not established history, and testimony is attributed to a speaker
and recorder. Original wording and earlier revisions remain available;
corrections flag dependent material for review, while unavailable sources
invalidate it. “I don’t know”, refusal and no supported connection are valid
outcomes. The product does not identify faces or infer kinship.

The public demonstration lets a visitor select a recorded photo clue, choose or
edit an actual Meta question, try a clearly fictional answer or unknown memory,
and assemble an illustrated sample exhibit. It uses public-domain historical
photos, curated actual model excerpts and labelled fictional practice text.
Edits exist only in the page and disappear on refresh. It does not connect to
private workspaces, persist writes or run AI requests. Private collections use
Supabase Auth, ownership checks, RLS and
private Storage. Single-user hosted workflows have been verified, but real
cross-user isolation, HTTPS browser behaviour and several failure paths remain
open. General model accuracy and face/kinship identification are not established.
No production deployment has been completed.

## B. Architecture Summary

Next.js 16 and React 19 render the archive, investigation and read-only demo.
TypeScript and Zod validate commands on the server. Supabase Auth establishes
the caller; PostgreSQL RLS and explicit workspace checks restrict reads. Private
Storage originals are served through authorised server routes. Privileged
transaction functions recheck ownership and source revisions before writing.

Investigation documents have immutable version snapshots and idempotent command
receipts. Each entry references exact source and parent revisions. Concurrent
stale edits are rejected; corrections do not silently rebind descendants.
Human questions derive their recorder and evidence on the server, with null
model and run attribution.

The provider separates **Fixture** (authored software test responses), **Replay**
(a compatible saved live result) and **Meta Live** (actual Meta requests).
Live use requires an exact input allowance and durable local usage ledger;
failed or uncertain requests do not fall back to a fixture. Existing exhausted
allowances remain preserved. This ledger intentionally refuses Vercel's
ephemeral filesystem, so the current live path is not deployment-ready there.
The public sample is statically rendered with local interactive state and no
private provider imports. A separate allowlisted static build excludes private
routes, authentication, provider code and credentials. Vercel remains only a
hosting candidate; the resulting artifact still requires approval and HTTPS checks.

## C. Demo Script and Shot List

Required length: **three minutes**, confirmed in the participant guide and form.
Record only the public photo/synthetic demos in a clean browser. Hide account tabs, developer
consoles, environment files and private URLs. This is a script; no video was
recorded yet. Use the time-coded shots below and verify the final export duration.

| Screen | Narration / action |
| --- | --- |
| 0:00–0:20 / photo opening | “A photograph can survive after its story is lost. Trace & Tell helps us find the question worth asking, and keep the answer with its evidence.” Show Interactive sample / nothing saved. |
| 0:20–0:55 / meal photograph | “This is a public-domain Library of Congress photograph. Meta noticed the glass jars and table objects. It did not establish identities or family relationships.” Show photo, credit, recorded observation and uncertainty. |
| 0:55–1:30 / clue and question | Select the clue. “Meta asks what these jars were used for. The point is to invite context, not repeat what we can already see.” Edit the question; show human-edited attribution and preserved original wording. |
| 1:30–1:55 / answer | “A person supplies the memory. This practice answer is invented; it is not testimony from the photographed people.” Try the answer, then show that not remembering is also a valid outcome. |
| 1:55–2:30 / exhibit and revision | Create the photo exhibit, follow its evidence, edit the question and show Needs review until updated. “The private app saves exact source and parent revisions. This public sample saves nothing.” |
| 2:30–2:45 / retained failure | Open the synthetic study: “Earlier Meta outputs included an unsupported explanation and an empty question list. We preserve those limitations and provide a human correction and question route.” |
| 2:45–3:00 / scope | “Built during the hackathon: private archive, reviewed inquiry, testimony and source-linked exhibits. Three historical photos were used for a 17-request prompt pilot; human accuracy review is still pending.” End on the gallery and credit. Verify the work-period claim against Git before recording. |

Optional authenticated footage requires a separate safe capture plan. Do not
present this interactive sample as a hosted write demonstration.

## D. Evidence Summary and Public Excerpt Selection

| Evidence class | Observed result / limitation |
| --- | --- |
| Historical actual Meta | One standalone synthetic image inference plus three app runs: text observation, image observation and image/note comparison. Four synthetic inferences; three stored app successes. Separate from all real-photo cohorts. |
| 5 November photo pilot | 17/17 actual Medium requests returned schema-valid outputs on three historical photos and four comparison cases. Source/revision references passed structural validation. 0/17 human-scored; no accuracy percentage. Calculated token cost $0.2144365; actual billing unverified. All originals and both prompt versions retained. |
| M2-B actual comparison | Recorded 2 November KST: one candidate, both source references, empty observations and questions. Supports/unknown/statement on `/demo` are exact output excerpts, with only source IDs replaced by A/B aliases. No claim of general quality or successful AI question generation. |
| M2-A actual image review | Separate 1 November image run and correction history. Original observation and uncertainty are quoted; REV3 uncertainty is the saved human correction. This observation was not supplied to M2-B. |
| Historical hosted integration | The 3 November acceptance made five successful saves through real Auth/Supabase, Investigation REV1 → REV6, preserving the prior Run and Source REV1s. Reload and app-server restart retained the result. Cleanup completed: six done, zero pending/staging, three originals. Not rerun here. |
| Historical fixture integration | Single-user hosted observation → inquiry → testimony → exhibit passed using authored fixture suggestions. This proves integration, not live model quality. |
| Sprint automated checks | See the dated verification section in the implementation report. Local PGlite and mocked Auth/HTTP boundaries do not certify real A/B isolation or hosted Storage behaviour. |
| Human acceptance | Earlier hosted user acceptance is separate evidence. The new public UI has assistant/browser checks; final user review is pending. |

Public content was checked against the retained M2-B result/acceptance report,
the retained M2-A result and the 3 November acceptance section. Raw reports,
workspace/source/run/account IDs, private URLs, tokens and ledgers are not
copied into the public data module. Public testimony T1 and exhibit wording
were newly authored for this demonstration and are explicitly labelled; they
are not the remote acceptance testimony or new model output.

`public/demo/orbit-ticket.png` is byte-identical to the synthetic corpus `01.png`:
640×480 PNG, 15,635 bytes, SHA-256
`de6ea03faeba4ca2d231ab4a1ced2d26d86264b69512ba663c478462f7b4fc03`.
The complete note is `ORBIT 47\nBLUE TICKET` (LF, no trailing newline), SHA-256
`6c896c139ec6bc2c9259ad8fa892913cbe49c9d6b3a56ba40f539a5bdd400c3e`.
These are content hashes, not full inference request hashes.

## E. Readiness Checklist

The [real-world evaluation preparation](real-world-evaluation.md) contains 23
photographic candidates, 12 comparisons and an offline review tool. Actual
real-photo evaluation has subsequently completed 30 requests across the same
ten cases (nine distinct photographs): ten Minimal and ten each Medium/High.
All returned structurally valid responses; human-scored responses remain zero.
This is not 30 independent photographs or an accuracy measurement. The revised
lossless input pipeline passes all 23 images and 35 request payloads offline; 18 images and eight comparisons pass the scoped rights review.
The earlier 16/23 size rejection is preserved as a historical preflight finding.
Neither preprocessing success nor provider-payload validation measures model
accuracy. Those completed allowances are exhausted and cannot be reused. Four
historical synthetic successes must not be described as broad photographic
accuracy. The demo explicitly retains the unsupported uncertainty
explanation and missing comparison questions.

Items below are preparation gates, not invented official mandatory fields.

- [x] Prepare an anonymous interactive photo sample, synthetic study and description/architecture/script.
- [x] Separate actual Meta evidence, authored fixtures, human questions and invented testimony.
- [x] Read the authenticated participant guide and submission form (5 November KST).
- [x] Confirm public repository and three-minute video requirements.
- [ ] Review final rules and any unresolved field/format constraints.
- [ ] Confirm final project name, Indie track and Build for Your World selection.
- [ ] Approve a concrete demo-only hosting proposal; verify the resulting HTTPS URL and all deep links from an unauthenticated browser. No deployment approved here.
- [ ] Audit repository history and obtain authorisation to make a clean submission repository public; private access alone does not satisfy the guide.
- [ ] Record, review and host the three-minute video with only cleared public photos and labelled fictional practice material; check playback without the author's account.
- [ ] Populate exact required links and text; verify saved fields and previews. No live URL or video URL exists in this packet.
- [ ] User reviews and explicitly authorises final submission; retain confirmation/receipt and timestamp before the deadline.

## Deployment Candidates and Security Gates

| Candidate | Recommendation / remaining work |
| --- | --- |
| Static public sample only | Recommended for this deadline. `node scripts/build-public-demo.mjs` creates a fresh allowlisted project containing only the photo/synthetic pages and their assets, then exports static files with no credentials, API or private routes. The root, `/demo/` and `/demo/photo/` are included; private links are hidden. A hosting header configuration is included. Review the artifact before approving deployment, then verify HTTPS headers, direct URLs and outbound requests on the final host. No deployment has occurred. |
| Full private app | Defer public availability. Real A/B Auth/DB/Storage isolation, HTTPS cookies/cache, old-token and upload-capability replay, interrupted-upload paths and hosted Storage patch status remain unresolved. Meta's local ledger also needs an approved durable deployment design. Local mocks cannot close these gates. |

No new migrations, remote records, cleanup, accounts, deployment,
repository visibility changes or submission occurred in the 5 November portal review. Paid
evaluations are recorded separately in the evaluation report. Security headers already
include nosniff, frame denial, no-referrer and restrictive device permissions.
A production CSP/HSTS policy has not been validated; final host configuration
must be reviewed rather than assumed from localhost checks.

## P1: M2-C Preparation Only

M2-C is deferred behind deliverables: an extra paid negative example cannot
close general model quality or security, and needs new source/allowance approval.
Local candidate: the existing synthetic `01.png` (hash above), and precisely
`MAPLE 82\nGREEN BENCH`, UTF-8, one LF, no BOM/trailing newline (20 bytes).
Its locally calculated SHA-256 is
`e1f0e9d171f66e08c873d8a1f874aaaae62abc4592cc47c68caf6e6b15e5798d`.
The image reads ORBIT 47 / ADMIT ONE / BLUE TICKET; the note supplies different
markers. Shared text layout, colour or the existence of two labels is not
specific evidence of a common item, person or event. “Unrelated” is a synthetic
test construction, not a fact the model can independently know.

Structural checks: parse the existing comparison schema; reference only the two
actual Source REV1s; no invented IDs/locators, no observations, bounded questions.
Semantic checks: prefer `no_connection` or explicitly insufficient evidence;
reject asserted shared identities/events, invented shared words, missing-source
citations or absent details treated as contradictions. Assess any candidate on
its actual supporting evidence; do not force a passing label. Question quality
is separate and an empty list must still be reported as such.

Before any future experiment, record newly approved workspace/source IDs,
original and prepared image hashes, the exact note hash, full image-inclusive
ModelInput hash with `observations=[]`, operation/order/model/Standard route,
current price, expiry, request/retry/output-token/cost caps and a fresh ledger.
The complete input hash cannot be fixed before real source IDs are assigned.
No source registration, approval file, ledger or inference was created here.
