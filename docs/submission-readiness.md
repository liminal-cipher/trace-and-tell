# Submission Readiness — 3 November 2026

Status: local submission candidate; **not deployed, filmed or submitted**.
Use this packet with [implementation evidence](m1b-m2-implementation.md) and
[M1a security limits](m1a-implementation.md). It does not grant external approval.

## Official Requirements and Open Decisions

The [Meta organiser page](https://dev.meta.ai/events/global-hackathon) and
[Cerebral Valley event page](https://events.cerebralvalley.ai/e/meta-ai-developer-hackathon)
were retrieved on 3 November 2026. The event page was also opened in Edge.

| Status | Finding / action |
| --- | --- |
| Confirmed | Public deadline: 4 November 2026, 9 PM ET, equivalent to 5 November, 11 AM KST. Recheck for organiser changes before submitting. |
| Confirmed | Indie Developer and Build for Your World are listed. Indie judging emphasises creativity, technical ambition and working software. |
| Confirmed | Public pages say selected participants must accept Official Rules; the retrieved pages do not provide the final submission field specification. Application criteria are not final submission requirements. |
| User account access required | The event site displayed Sign In, then a Google/email login screen. No authenticated participant dashboard or submission form was accessible in this session. |
| Unconfirmed | Required URLs, repository visibility/access method, video length/format/hosting, character limits, team declaration, model evidence fields and final rules/eligibility acceptance. Do not infer these from other hackathons. |
| Decision before submission | Confirm the registered project name and track, choose the judge-accessible demo delivery, and confirm how a private repository can be reviewed. |

No login email was sent, agreement accepted, form saved or submission made.

## A. Submission Description

Trace & Tell — A Living Family Gallery helps family record keepers preserve the
context around photographs and notes before the people who remember it can no
longer explain it. It turns scattered records into questions worth asking and
small exhibitions whose statements remain connected to their sources.

Meta Standard `muse-spark-1.3` has actually read synthetic image and text material
inside the authenticated app and compared a synthetic ticket with a typed note.
In the comparison, it recognised the shared words ORBIT 47 and BLUE TICKET,
cited both source revisions, and left the relationship between the records
unresolved. It returned no questions. We expose that limitation and let a person
write an open question, rather than attributing human words to the model.

The record keeper can review, correct or reject observations and hypotheses,
select a question, record text testimony, and save an exhibit. Observations,
hypotheses, questions, testimony and exhibits remain distinct. A selected
hypothesis is not established history, and testimony is attributed to a speaker
and recorder. Original wording and earlier revisions remain available;
corrections flag dependent material for review, while unavailable sources
invalidate it. “I don’t know”, refusal and no supported connection are valid
outcomes. The product does not identify faces or infer kinship.

The public demonstration uses only synthetic material and curated historical
model excerpts. It does not connect to private workspaces, accept writes or run
AI requests. Private collections use Supabase Auth, ownership checks, RLS and
private Storage. Single-user hosted workflows have been verified, but real
cross-user isolation, HTTPS browser behaviour and several failure paths remain
open. General model accuracy is not established by these few synthetic cases.
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
The public demo is a statically rendered page with local synthetic assets and
no private provider imports. Vercel remains only a hosting candidate.

## C. Demo Script and Shot List

Suggested editorial length: roughly two minutes, **not a verified event limit**.
Record only the synthetic demo in a clean browser. Hide account tabs, developer
consoles, environment files and private URLs. This is a script; no video was
recorded in this sprint. Adjust length and format after reading the real form.

| Screen | Narration / action |
| --- | --- |
| `/demo`, opening | “A photograph can survive after its story is lost. Trace & Tell helps us find the question worth asking, and keep the answer with its evidence.” Show Synthetic / Read only; follow two records. |
| Sources | “This ticket and note are entirely synthetic. The originals remain visible. Similar words are a clue, not proof of a shared event.” Open the image; return to both Source REV1s. |
| Observation | “This is an excerpt from a real Meta Standard image run. We review what it says.” Expand the uncertainty history. “The model blamed compression without evidence. The correction preserves that original claim for review.” |
| Comparison | “In a separate real comparison, Meta cited both records and found the shared markings. It did not establish that they describe the same item.” Point to both sources and the unknown relationship. |
| Human question | “The model returned no questions. We show that honestly. A person wrote this open question, with no model attribution.” Read the question and show its parent revision. |
| Testimony | “This invented answer illustrates how uncertainty can be preserved. It is not a real person's testimony or an AI output.” Show the synthetic label. |
| Gallery | “The exhibit carries its sources with it. We can return to the testimony, the question and each original. The story stays open to correction.” Follow the original-note and correction-history links. |
| Closing | “The private save-and-reopen workflow has separate single-user hosted evidence. This public walkthrough saves nothing and makes no live model calls. Trace & Tell keeps the record, and leaves room for the unknown.” |

Optional authenticated footage requires a separate safe capture plan. Do not
present this static page as an interactive hosted write demonstration.

## D. Evidence Summary and Public Excerpt Selection

| Evidence class | Observed result / limitation |
| --- | --- |
| Historical actual Meta | One standalone synthetic image inference plus three app runs: text observation, image observation and image/note comparison. Four total successful inferences; three stored app successes. No new inference in this sprint. |
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
real-photo Meta calls and human-scored responses remain zero. The revised
lossless input pipeline passes all 23 images and 35 request payloads offline; 18 images and eight comparisons pass the scoped rights review.
The earlier 16/23 size rejection is preserved as a historical preflight finding.
Neither preprocessing success nor provider-payload validation measures model
accuracy; the ten-request paid proposal still requires separate approval. Four
historical synthetic successes must not be described as broad photographic
accuracy. The demo explicitly retains the unsupported uncertainty
explanation and missing comparison questions.

Items below are preparation gates, not invented official mandatory fields.

- [x] Prepare an anonymous synthetic walkthrough and description/architecture/script.
- [x] Separate actual Meta evidence, authored fixtures, human questions and invented testimony.
- [ ] Log into the accepted participant account; read final rules and submission form.
- [ ] Confirm required fields, character limits, video format/length and judge access rules.
- [ ] Confirm final project name, Indie track and Build for Your World selection.
- [ ] Approve a concrete demo-only hosting proposal; verify the resulting HTTPS URL and all deep links from an unauthenticated browser. No deployment approved here.
- [ ] Decide repository access as required by the portal; keep it private unless separately authorised.
- [ ] Record, review and host the video with only cleared synthetic material; check playback without the author's account.
- [ ] Populate exact required links and text; verify saved fields and previews. No live URL or video URL exists in this packet.
- [ ] User reviews and explicitly authorises final submission; retain confirmation/receipt and timestamp before the deadline.

## Deployment Candidates and Security Gates

| Candidate | Recommendation / remaining work |
| --- | --- |
| Synthetic read-only demo only | Recommended for this deadline. Use a separately approved deployment with no Supabase/model credentials, no live allowance and no personal account connection. If hosting the Next app, private routes must remain unconfigured/closed; an actual demo-only artefact or route restriction should be reviewed before publishing. Verify HTTPS headers, direct URLs, asset access and outbound requests on the final host. This sprint does not create or deploy that configuration. |
| Full private app | Defer public availability. Real A/B Auth/DB/Storage isolation, HTTPS cookies/cache, old-token and upload-capability replay, interrupted-upload paths and hosted Storage patch status remain unresolved. Meta's local ledger also needs an approved durable deployment design. Local mocks cannot close these gates. |

No new migrations, remote records, cleanup, accounts, model calls, deployment,
repository visibility changes or submission occurred. Security headers already
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
