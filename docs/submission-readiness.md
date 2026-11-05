# Submission Readiness — 5 November 2026

Status: local submission candidate; a verified three-minute recording of actual
application interactions is ready. YouTube upload remains incomplete.
**Not deployed or submitted.**
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
| Decision before submission | The repository owner made the project public. Anonymous access to the GitHub project page was verified on 5 November. The owner will upload the film. The video URL and final submission are pending. |

During the 5 November drafting session, project text, Meta use, partner feedback,
the repository address and the user’s two required survey answers were entered
in the open form. The video field remained empty. Server-side draft persistence
was not confirmed. The repository page subsequently returned HTTP 200 without an authenticated session.

### Critical review against the rubric

| Criterion | Concrete strength | Remaining weakness / decision |
| --- | --- | --- |
| Impact — 30% | A record keeper can take one photo-linked question into a conversation, preserve attributed words and leave with a sourced exhibit. Downloadable notes close the gap between a screen and that conversation. | No real-user usefulness study or retention measure. Do not substitute feature counts or model JSON success for demonstrated impact. |
| Meta tooling — 25% | Actual observations, record comparisons and clue-grounded inquiries feed a reviewed workflow. Failure examples and human alternatives remain visible. | Small photo pilot; one revised comparison still made an unsupported identity distinction. No face matching claim. |
| Technical execution — 20% | Exact revision references, server authorship, stale-evidence rejection, bounded live calls and separate local regression checks. | Real two-user isolation and HTTPS acceptance remain incomplete. Offer the isolated public static sample first. |
| Demo — 25% | One visible journey reaches an illustrated exhibit, revisits evidence and visibly reacts to a changed question. | Video upload and signed-out playback remain to be checked. The sample demonstrates the local public workflow. |

This review does not predict a judging score. The chosen focus is a conversation
and a usable record; automatic recognition of relatives is outside the claim.

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

A separate follow-up ran 33 additional requests on those photos and one storefront,
comparing High/Max and two prompt strategies with a Medium cross-check. Some
unsupported detail disappeared, but omissions and weak questions remained.
Assistant comparison did not establish a consistent improvement, so Medium
remains the application default. These 33 responses also await human scoring;
the [evaluation report](real-world-evaluation.md#highmax-and-prompt-comparison--5-november-2026)
retains all versions rather than publishing a best-case accuracy claim.

Earlier authenticated synthetic runs also remain available. One comparison found
shared ticket/note markings but returned no questions. A person could still write
an open question, with explicit human attribution and no model/run attribution.

The record keeper can review, correct or reject observations and hypotheses,
select a question, download a conversation note sheet, record text testimony,
and save an exhibit with an optional attributed text download. The sheet helps
the keeper ask permission, preserve exact words and record uncertainty before
returning to the collection. Observations,
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
Edits exist only in the page and disappear on refresh; visitors may explicitly
download a labelled practice text copy. It does not connect to
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

The review cut runs for three minutes. It opens with Russell Lee’s photograph of a
meal, followed by the project title. The actual screen recording shows a photo
clue from Muse Spark, its original question and the optional human edit. The
notes scene uses excerpts of the downloaded text file alongside its source photo.

The two sentences about the jars appear together in the fictional practice
reply. The app retains its native attribution. The storefront example shows a
readable sign and an unsupported detail from the same model response. The last
shot pairs the original photograph with the speaker’s words before the project
wordmark appears. No personal photographs or private account screens appear.

| Time | Spoken narration |
| --- | --- |
| 0:00 to 0:10 | Have you ever turned over a family photo, hoping someone had written on the back? This is Trace and Tell. |
| 0:10 to 0:22 | Take this meal photographed by Russell Lee. Look between the plates. Meta's Muse Spark noticed the glass jars. Here's the question it suggested. |
| 0:22 to 0:33 | What was typically kept in the large glass jars seen on the table? What, if anything, do these jars remind you of? Either question works. Asking it your way gives someone room to surprise you. |
| 0:33 to 0:56 | You can take that question to the kitchen table. The note sheet travels with it. Here’s the sheet from that download. It names the photograph and leaves space for the speaker’s own words. Ask what they want to share. |
| 0:56 to 1:05 | Sometimes the answer is simply, “I don't remember.” There's a place for that, too. |
| 1:05 to 1:29 | Here's a fictional reply for this public example. “Jars like these remind me of keeping leftovers after a shared meal.” “I cannot remember what was in them that day.” The exhibit keeps both sentences beside the photograph. |
| 1:29 to 1:44 | Each answer has a trail back to the question and the picture. You can take a copy of the exhibit text, too. In a private collection, each saved version keeps its sources. |
| 1:44 to 1:58 | Suppose someone changes the question afterwards. The answer still belongs to the words the speaker heard. The exhibit keeps that earlier wording until someone reviews the change. |
| 1:58 to 2:20 | A second photograph shows why a clue needs a second pair of eyes. Muse Spark read the shop sign as “stevensons.” You can see the word above the windows. The same response described mannequins wearing dresses. Look at the figures. They're too small to tell. |
| 2:20 to 2:41 | Back at the table, the speaker’s words are still attached to this photograph. There’s a link underneath them. Follow it back to the original. Here’s the photograph again, with Russell Lee’s credit and the Library of Congress record. |
| 2:41 to 2:57 | Someone looking at these jars years from now might wonder about that meal, too. The next person who opens this photo will find their words beside it. |
| 2:57 to 3:00 | The wordmark and subtitle hold in silence. |

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
- [x] Confirm the form shows Indie Developer and Build for Your World, with Trace & Tell named in the description.
- [ ] Approve a concrete demo-only hosting proposal; verify the resulting HTTPS URL and all deep links from an unauthenticated browser. No deployment approved here.
- [x] Verify anonymous access to the project repository after its owner makes it public.
- [ ] Complete a separate audit of previously published repository history.
- [x] Produce and locally verify a screen-recorded three-minute video using cleared photos and labelled fictional practice material.
- [ ] Upload the authorised final video and verify full playback without the author's account; human listening remains pending.
- [ ] Check the filled draft before submission and add the video URL after signed-out playback.
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
