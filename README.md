# Trace & Tell

> An evidence-aware family archive that helps people discover questions worth asking before memories lose their context.

**Status:** Deployment-first development baseline v0.2. No runnable application, completed model evaluation, or deployed demo has been verified as of 2026-10-28.

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

The agreed implementation is a **deployment-first**, responsive Next.js application backed by Supabase PostgreSQL, Auth and private Storage, with Vercel as the proposed hosting service. An active, Seoul-region Supabase project named `trace-and-tell` has been verified; no application schema or executable app has yet been created.

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

There is **no implemented application, runnable setup or deployed URL yet**. The stack has been selected but packages and migration files have not been installed or created. Once M1a is implemented, this section will document verified local commands, required environment-variable names (never their values), database migrations and test results.

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

**Last reviewed:** 2026-10-28. **Deployment:** not yet performed or verified. **Tests:** not run; the repository contains no app implementation.
