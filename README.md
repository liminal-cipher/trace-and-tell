# Trace & Tell

> An evidence-aware family archive that helps people discover questions worth asking before memories lose their context.

**Status:** M1a implementation in progress. The local app, SQL migration and automated checks are implemented. Real Supabase Auth/Storage integration is not yet verified; no deployment or model evaluation has been performed. See the [implementation and verification record](docs/m1a-implementation.md).

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

The implementation is a **deployment-first**, responsive Next.js application backed by Supabase PostgreSQL, Auth and private Storage, with Vercel as the proposed hosting service. The previously verified Seoul-region Supabase project has not been modified by this implementation. The application schema is supplied as an unapplied SQL migration.

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
| `APP_ORIGIN` | Exact app origin, such as `http://localhost:3000` |

No Supabase API key is embedded in client code. Never rename these variables with a `NEXT_PUBLIC_` prefix. Configure the exact `/auth/callback` redirect in Supabase Auth only with approval for that environment. Magic Links use PKCE and must be opened in the browser that requested them.

The migration is [persistent_archive.sql](supabase/migrations/20261028155626_persistent_archive.sql). **Remote application requires separate approval.** Do not run a remote migration as part of installation or deployment. For a disposable local Supabase stack, Docker and the pinned Supabase CLI are required; see [local integration setup](docs/m1a-implementation.md#local-integration-setup).

```sh
npm run test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts the production build, so run `build` first. Default browser checks need no credentials. The private integration suite is skipped unless explicitly enabled against a local Supabase stack. See [results and limitations](docs/m1a-implementation.md#verification) for the distinction between SQL tests and real service tests.

## Responsible Data Handling

- Keep API keys on the server and out of the repository, logs and browser bundles.
- Enforce Supabase Auth ownership, explicit Data API grants, RLS and private Storage policies for workspace and file access; deny cross-user requests.
- Keep the public synthetic demo isolated from private records and prohibit anonymous writes and unrestricted Meta API requests.
- Do not send personal or confidential information to Meta Contributor services. Review the current Meta terms and use the appropriate Standard model route for permitted personal-data processing.
- Do not manufacture precise dates, names, locations, face identities or family relationships from ambiguous evidence.
- Record which AI provider and mode actually produced each suggestion.


## Roadmap

- [ ] M0: Finalise implementation contracts, check participant-only rules and bootstrap the approved stack. The initial documentation baseline and Supabase project are prepared, not an implemented app.
- [ ] M1a: Build an authenticated hosted archive with PostgreSQL persistence, private object storage, upload validation, revisions and cross-user denial tests; request separate approval before actual deployment.
- [ ] M1b: Complete the fixture-driven observation → hypothesis → question → testimony → exhibit journey, with source tracing and revision propagation.
- [ ] M2: Validate the same journey using the real Meta Model API with approved spending limits and recorded results.
- [ ] M3: Strengthen recovery, corrections and privacy; add audio transcription only if tested and time permits.
- [ ] M4: Prepare an accessible synthetic demonstration, verify the official submission requirements and submit the actual deliverables.

**Last reviewed:** 2026-10-29. **Deployment:** not performed. **Tests:** local automated results and outstanding integration gates are recorded in [M1a verification](docs/m1a-implementation.md#verification). M1a acceptance remains open until the real service tests pass.
