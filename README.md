# Trace & Tell

> An evidence-aware family archive that helps people discover questions worth asking before memories lose their context.

**Status:** In progress; not deployed. Actual single-user Supabase Auth/DB/Storage flows and duplicate-photo handling have passed with synthetic data. Full M1a security acceptance remains open. One approved Meta synthetic inference succeeded; it does not establish general model quality. The investigation flow passes local fixture UI/SQL tests but its remote migration and E2E remain unapproved. See [current evidence and remaining gates](docs/m1b-m2-implementation.md) and the [M1a audit](docs/m1a-implementation.md).

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

The implementation is a **deployment-first**, responsive Next.js application backed by Supabase PostgreSQL, Auth and private Storage, with Vercel as the proposed hosting service. The approved M1 schema and hardening are applied to the Seoul project; the new investigation schema is local only. No deployment has been performed.

Two distinct experiences are planned:

- **Public demonstration:** a read-only exploration of explicitly synthetic, permission-cleared material, without public writes, personal records or unrestricted paid AI calls. Any interactive fixture flow must be labelled as such.
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

Open `http://localhost:3000/demo` for the read-only synthetic collection. Without credentials, the private archive explicitly reports that setup is pending; it does not substitute browser storage for persistence.

For the private archive, copy `.env.example` to the ignored `.env.local` and supply these **server-only** variables through your local secret mechanism:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_PUBLISHABLE_KEY` | Auth and user-scoped RLS requests; legacy anon keys are also supported |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only command transactions and private object operations |
| `APP_ORIGIN` | Exact HTTPS app origin; local development also accepts `http://localhost:3000` or loopback. No path, query, fragment or credentials |

No Supabase API key is embedded in client code. Never rename these variables with a `NEXT_PUBLIC_` prefix. Configure the exact `/auth/callback` redirect in Supabase Auth only with approval for that environment. Magic Links use PKCE and must be opened in the browser that requested them.

For a fresh disposable local stack, migrations initialise the [archive](supabase/migrations/20261028155626_persistent_archive.sql), [M1 hardening](supabase/migrations/20261029150829_m1a_security_hardening.sql) and [investigation](supabase/migrations/20261029165416_investigation_flow.sql), in order. Docker and the pinned CLI are needed for [local integration](docs/m1a-implementation.md#local-integration-setup). The first two files have already been applied to the approved remote project. The investigation migration has **not** been approved or applied there. **Do not run remote `db push`: connector-assigned history timestamps differ from the local filenames.** Review the [verified content mapping](docs/m1b-m2-implementation.md#git-and-approved-remote-work) before any history repair or further remote migration. Installation and deployment do not apply SQL automatically.

```sh
npm run test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts the production build, so run `build` first. Default browser checks explicitly clear Supabase configuration, including `.env.local`. Private integration is skipped unless `RUN_LOCAL_SUPABASE_E2E=1` and local service credentials are supplied in the process environment. This runner rejects remote targets and records no Auth traces. Investigation browser tests exercise the real UI/domain/SQL against PGlite with a test Auth/HTTP boundary; they do not certify Supabase integration. PGlite is PostgreSQL 18.6, not the target's 17.11/Auth/Storage services. See [current verification](docs/m1b-m2-implementation.md#verification-and-acceptance).

On a local stack with the investigation migration applied, sign in, select a workspace and choose **Open investigation**. This flow is not ready on the current remote project. Fixture mode clearly labels authored suggestions; replay requires a recorded live response. Meta-live is closed by default. Keep `MODEL_API_KEY` server-only and do not enable live use without separate approval. The local allowance ledger deliberately refuses Vercel's ephemeral filesystem. See [provider limits, corpus and evaluation commands](docs/m1b-m2-implementation.md#provider-and-evaluation-preparation).

```sh
npm run corpus:create
npm run evaluate
```

Evaluation defaults to one synthetic fixture case, writes immutable ignored records, and makes no Meta call. Structural validation and semantic model quality are reported separately. A target-locked, read-only remote M1 preflight is available as `npm run m1:remote:preflight`; the existing local-only browser guard is unchanged.

The evaluation CLI loads ignored `.env.local` without overriding process variables; ordinary unit tests remain disconnected. Set `EVALUATION_PLAN_ONLY=1` to calculate input hashes and limits without inference. A plan or API key does not grant live-call approval. The remote preflight intentionally refuses a project that already contains app data; it is not the acceptance runner for the retained test collection.

## Verification & Limitations

- **Actual M1:** Magic Link/PKCE, session retention, workspace/photo/note persistence, original byte equality, revision history/conflict rejection, refresh/server restart, double-click note prevention, duplicate-photo suppression, damaged-image rejection, deletion/access denial and expired-upload cleanup were observed with synthetic data. Oversize rejection was verified in the browser, not as a Storage HTTP boundary test.
- **Remaining:** real A/B isolation is required before public deployment. Old-token/capability replay, some interrupted-upload failure paths, hosted Storage patch-level confirmation and HTTPS cookie/cache behaviour remain unverified. The newest duplicate-upload intent requires a final cleanup check after **1 November 2026, 02:29:02 KST**; no unwanted file remained at the last check. Test data and the personal-email Auth account are preserved.
- **First Meta inference:** one synthetic PNG, `muse-spark-1.3` Standard, HTTP 200, 2.359 s; 1,399 input and 222 output tokens. Calculated cost **US$0.00269225**; actual bill unconfirmed. Schema checks and an assistant visual review found the three principal strings correct. This single case is not a model-wide quality evaluation. No further calls are approved; the consumed allowance ledger is preserved.
- **Local versus remote:** unit/PGlite/mock checks do not substitute for hosted Auth/Storage tests. M1b remote E2E is still blocked by the separate history-repair and Investigation SQL approval gates. Private execution artefacts are excluded from Git; sanitised findings are in the implementation report.

## Responsible Data Handling

- Keep API keys on the server and out of the repository, logs and browser bundles.
- Enforce Supabase Auth ownership, explicit Data API grants, RLS and private Storage policies for workspace and file access; deny cross-user requests.
- Keep the public synthetic demo isolated from private records and prohibit anonymous writes and unrestricted Meta API requests.
- Do not send personal or confidential information to Meta Contributor services. Review the current Meta terms and use the appropriate Standard model route for permitted personal-data processing.
- Do not manufacture precise dates, names, locations, face identities or family relationships from ambiguous evidence.
- Record which AI provider and mode actually produced each suggestion.


## Roadmap

- [ ] M0: Confirm participant-only rules; the initial specifications, application scaffolding and Supabase project are present.
- [ ] M1a: Complete remaining security gates and final cleanup; actual single-user Auth/Storage and duplicate-photo checks passed. Deployment requires separate approval.
- [ ] M1b: Complete the real Supabase fixture journey; local observation → inquiry → testimony → exhibit UI/SQL checks pass.
- [ ] M2: Extend evaluation beyond the first successful synthetic Meta inference only with new approval, recorded usage and human quality review.
- [ ] M3: Strengthen recovery, corrections and privacy; add audio transcription only if tested and time permits.
- [ ] M4: Prepare an accessible synthetic demonstration, verify the official submission requirements and submit the actual deliverables.

**Last reviewed:** 2026-11-01. **Deployment:** not performed. The approved M1 schema is applied; synthetic test records and one real-email Auth account remain for follow-up. M1a security acceptance and M1b remote integration remain open. Historical audit results are distinguished from current findings in the [implementation report](docs/m1b-m2-implementation.md).
