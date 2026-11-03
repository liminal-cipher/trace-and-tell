# Trace & Tell

> An evidence-aware family archive that helps people discover questions worth asking before memories lose their context.

**Status:** In progress; not deployed. The public `/demo` now walks through synthetic originals, recorded Meta observations and comparison, a human-authored question, invented testimony and an evidence-linked gallery. Four historical Meta inferences succeeded (one standalone and three app runs); the comparison returned no questions. Human-authored questioning and the single-user hosted save/reopen journey passed. Real A/B security acceptance and general model quality remain open. See the [submission packet and release gates](docs/submission-readiness.md), [dated implementation evidence](docs/m1b-m2-implementation.md) and [M1a audit](docs/m1a-implementation.md).

**Project name:** Trace & Tell is a working product name; it has not been verified as the final name entered on the hackathon application.

## Motivation

Old photographs, notes and letters can survive after the people who remember their context are no longer able to explain them. Trace & Tell aims to help a family record keeper examine such material, recognise potentially useful clues, ask a person a meaningful question and preserve the answer with its source.

The product does **not** infer people's identities, kinship or medical conditions from photographs. It does not promise to restore memories, diagnose conditions or establish family history automatically.

## Intended Experience

1. Create a private collection and add photographs, handwritten notes or typed notes.
2. Review **observations** suggested from visible content, correcting or rejecting uncertain readings.
3. Examine evidence-backed **connection hypotheses**, including contrary or missing evidence.
4. Select and edit questions to ask a relative or another knowledgeable person.
5. Record **testimony** as text; audio capture and transcription are a subsequent milestone.
6. Compose a small private exhibition with explicit source links and unresolved questions.
7. Reopen the collection and revise it without erasing the provenance of earlier decisions.

An accepted hypothesis remains a hypothesis. A person's testimony is attributed to its speaker and recorder; neither becomes independently verified fact merely because it appears in an exhibition.


## Current Scope

The implementation is a **deployment-first**, responsive Next.js application backed by Supabase PostgreSQL, Auth and private Storage, with Vercel as the proposed hosting service. The approved M1 schema and hardening are applied to the Seoul project; the Investigation schema is also applied following explicit approval. No deployment has been performed.

Two distinct experiences are implemented locally:

- **Public demonstration:** a static, read-only synthetic story with labelled historical Meta excerpts, human questions and authored demo testimony. It makes no private-data or live model requests.
- **Private workspace:** a signed-in record keeper can upload and retrieve records, review evidence and save an exhibit. Server-side access checks, row-level security (RLS) and private-object policies are required before deployment.

M1a delivers an authenticated **Persistent Archive** using hosted persistence and access controls. M1b delivers the complete fixture end-to-end journey; M2 integrates and evaluates live Meta responses separately. Deployment, billing changes and paid API use are not authorised by these documents.

## Design

- [Investigation — Figma SCR-02](https://www.figma.com/design/a4nRD7Ixyy2ue7mAL0meZU?node-id=3-2)
- [Living Gallery — Figma SCR-04](https://www.figma.com/design/a4nRD7Ixyy2ue7mAL0meZU?node-id=3-45)

These are **visual drafts**, not working interfaces. The current Figma frames contain image placeholders. The colour palette is provisional.

## Design & Implementation Documents

- [Product requirements](docs/product.md)
- [UX and functional specification](docs/ux-functional-spec.md)
- [Technical design proposal](docs/technical-design.md)
- [Implementation and validation plan](docs/implementation-plan.md)
- [Submission description, architecture, demo script and checklist](docs/submission-readiness.md)

These documents describe the agreed v0.2 development direction and proposed implementation contracts. Documentation approval is not evidence of working software.

## Hackathon Context

Prepared for the **Meta Global AI Developer Hackathon 2026**, Indie Developer track, **Build for Your World** theme. The public organiser page lists the project submission deadline as **4 November 2026, 9:00 PM US Eastern Time (5 November, 11:00 AM KST)**, subject to official updates.

- [Meta organiser page](https://dev.meta.ai/events/global-hackathon)
- [Cerebral Valley event page](https://events.cerebralvalley.ai/e/meta-ai-developer-hackathon)

The authoritative participant rules, submission form, required artefacts, demo accessibility and any live-final obligations must be confirmed in the participant portal before submission. The event pages and rules, not this README, govern eligibility and requirements.

## Getting Started

Requires Node.js 22.12 or later and npm. Versions are pinned in `package-lock.json`.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/demo` for the read-only synthetic journey. The public page works without Supabase or Meta configuration. Without credentials, the private archive explicitly reports that setup is pending; it does not substitute browser storage for persistence.

For the private archive, copy `.env.example` to the ignored `.env.local` and supply these **server-only** variables through your local secret mechanism:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_PUBLISHABLE_KEY` | Auth and user-scoped RLS requests; legacy anon keys are also supported |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only command transactions and private object operations |
| `APP_ORIGIN` | Exact HTTPS app origin; local development also accepts `http://localhost:3000` or loopback. No path, query, fragment or credentials |

No Supabase API key is embedded in client code. Never rename these variables with a `NEXT_PUBLIC_` prefix. Configure the exact `/auth/callback` redirect in Supabase Auth only with approval for that environment. Magic Links use PKCE and must be opened in the browser that requested them.

For a fresh disposable local stack, migrations initialise the [archive](supabase/migrations/20261028155626_persistent_archive.sql), [M1 hardening](supabase/migrations/20261029150829_m1a_security_hardening.sql) and [investigation](supabase/migrations/20261029165416_investigation_flow.sql), in order. Docker and the pinned CLI are needed for [local integration](docs/m1a-implementation.md#local-integration-setup). All three migrations are applied to the approved remote project. The M1 history timestamps were reconciled under separate approval without rerunning M1 SQL. **Further remote migrations require separate approval; do not blindly run remote `db push`.** See the [migration execution record](docs/m1b-m2-implementation.md#remote-ab-execution--1-november-2026-0152-kst). Installation and deployment do not apply SQL automatically.

```sh
npm run test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts the production build, so run `build` first. Default browser checks explicitly clear Supabase and model credentials/approval, overriding `.env.local`. If port 3000 is occupied, set `PLAYWRIGHT_PORT=3100` in the test process; the runner starts its own server and never reuses the existing one. Private integration is skipped unless `RUN_LOCAL_SUPABASE_E2E=1` and local service credentials are supplied in the process environment. This runner rejects remote targets and records no Auth traces. Investigation browser tests exercise the real UI/domain/SQL against PGlite with a test Auth/HTTP boundary; they do not certify Supabase integration. PGlite is PostgreSQL 18.6, not the target's 17.11/Auth/Storage services. See [current verification](docs/m1b-m2-implementation.md#verification-and-acceptance).

With the investigation migration applied, sign in, select a workspace and choose **Open investigation**. The single-user fixture journey also passed through the local app against the approved hosted project. Fixture mode clearly labels authored suggestions; replay requires a recorded live response. Meta-live is closed by default. Keep `MODEL_API_KEY` server-only and do not enable live use without separate approval. The local allowance ledger deliberately refuses Vercel's ephemeral filesystem. See [provider limits, corpus and evaluation commands](docs/m1b-m2-implementation.md#provider-and-evaluation-preparation).

```sh
npm run corpus:create
npm run evaluate
```

Evaluation defaults to one synthetic fixture case, writes immutable ignored records, and makes no Meta call. Structural validation and semantic model quality are reported separately. A target-locked, read-only remote M1 preflight is available as `npm run m1:remote:preflight`; the existing local-only browser guard is unchanged.

The evaluation CLI loads ignored `.env.local` without overriding process variables; ordinary unit tests remain disconnected. Set `EVALUATION_PLAN_ONLY=1` to calculate input hashes and limits without inference. A plan or API key does not grant live-call approval. The remote preflight intentionally refuses a project that already contains app data; it is not the acceptance runner for the retained test collection.

## Verification & Limitations

- **Actual M1:** Magic Link/PKCE, session retention, workspace/photo/note persistence, original byte equality, revision history/conflict rejection, refresh/server restart, double-click note prevention, duplicate-photo suppression, damaged-image rejection, deletion/access denial and expired-upload cleanup were observed with synthetic data. Oversize rejection was verified in the browser, not as a Storage HTTP boundary test.
- **Remaining:** real A/B isolation is required before public deployment. Old-token/capability replay, some interrupted-upload failure paths, hosted Storage patch-level confirmation and HTTPS cookie/cache behaviour remain unverified. At the separately verified **3 November 2026** cleanup, all six upload intents were done, with three unchanged originals, zero pending cleanup and zero staging objects. Test data and the personal-email Auth account are preserved.
- **First Meta inference:** one synthetic PNG, `muse-spark-1.3` Standard, HTTP 200, 2.359 s; 1,399 input and 222 output tokens. Calculated cost **US$0.00269225**; actual bill unconfirmed. Schema checks and an assistant visual review found the three principal strings correct. This single case is not a model-wide quality evaluation. No further calls are approved; the consumed allowance ledger is preserved.
- **Local versus remote:** unit/PGlite/mock checks do not substitute for hosted Auth/Storage tests. Separately approved hosted checks passed the single-user fixture journey and the existing M2-A meta-live Observation's uncertainty correction from REV2 to REV3, preserving both original fields and prior revisions after refresh. This correction made no new Meta call. The target had no descendants, so its remote `needs_review` propagation was not exercised; local tests cover that behaviour. Private execution artefacts are excluded from Git; sanitised findings are in the implementation report.

## Responsible Data Handling

- Keep API keys on the server and out of the repository, logs and browser bundles.
- Enforce Supabase Auth ownership, explicit Data API grants, RLS and private Storage policies for workspace and file access; deny cross-user requests.
- Keep the public synthetic demo isolated from private records and prohibit anonymous writes and unrestricted Meta API requests.
- Do not send personal or confidential information to Meta Contributor services. Review the current Meta terms and use the appropriate Standard model route for permitted personal-data processing.
- Do not manufacture precise dates, names, locations, face identities or family relationships from ambiguous evidence.
- Record which AI provider and mode actually produced each suggestion.


## Roadmap

- [ ] M0: Confirm participant-only rules; the initial specifications, application scaffolding and Supabase project are present.
- [ ] M1a: Complete remaining security gates; actual single-user Auth/Storage, duplicate-photo and expired-upload cleanup checks passed. Deployment requires separate approval.
- [x] M1b: The single-user fixture observation → inquiry → testimony → exhibit journey passed locally and against hosted Supabase; this does not close M1a security gates.
- [ ] M2: Extend evaluation beyond four successful synthetic Meta inferences only with new approval, recorded usage and human quality review. M2-A correction and M2-B comparison passed their scoped checks; M2-B supplied no questions. The human-question path passed hosted acceptance. General quality remains unverified.
- [ ] M3: Strengthen recovery, corrections and privacy; add audio transcription only if tested and time permits.
- [ ] M4: Local synthetic demonstration and submission packet are prepared. Participant-only requirements, video, authorised deployment and actual submission remain open.

**Last reviewed:** 2026-11-03. **Deployment:** not performed. The approved M1 and Investigation schemas are applied; synthetic test records and one real-email Auth account remain for follow-up. M1a security acceptance and general model quality remain open. Historical audit results are distinguished from current findings in the [implementation report](docs/m1b-m2-implementation.md).
