import { AppError } from "./errors";
import { analysisIdentity, analysisSchema, type Entry, type InvestigationCommand, type InvestigationDocument, type ModelInput, type ProviderMode, type RunResult, type Source } from "./investigation-contracts";
import type { Asset, Revision } from "./contracts";
export interface EvidenceContext {
    workspace_id: string;
    assets: Asset[];
    revisions: Revision[];
}
export function validateSources(sources: Source[], context: EvidenceContext) {
    if (!sources.length || new Set(sources.map((s) => s.asset_id)).size !== sources.length)
        throw new AppError(400, "Select distinct source records.");
    for (const s of sources) {
        const asset = context.assets.find((a) => a.id === s.asset_id && a.workspace_id === context.workspace_id);
        if (!asset || asset.deletion_state !== "active")
            throw new AppError(404, "A source is unavailable or deleted.");
        if (asset.active_revision !== s.revision || !context.revisions.some((r) => r.asset_id === s.asset_id && r.revision === s.revision))
            throw new AppError(409, "A source changed. Reload and review its current revision.");
    }
}
export function reconcile(document: InvestigationDocument, context: EvidenceContext): InvestigationDocument {
    const result = structuredClone(document);
    // Editing an older testimony/exhibit can reference a newer parent. Follow
    // the enforced kind hierarchy, not insertion order, when propagating state.
    const order={observation:0,hypothesis:1,question:2,testimony:3,exhibit:4};
    for (const entry of [...result.entries].sort((a,b)=>order[a.kind]-order[b.kind])) {
        const broken = entry.sources.some((s) => !context.assets.some((a) => a.id === s.asset_id && a.deletion_state === "active"));
        const changed = entry.sources.some((s) => !context.assets.some((a) => a.id === s.asset_id && a.active_revision === s.revision));
        const parents = entry.parents.map((p) => ({ ref: p, entry: result.entries.find((e) => e.id === p.id) }));
        if (broken || parents.some((p) => !p.entry || p.entry.evidence_validity === "invalidated"))
            entry.evidence_validity = "invalidated";
        else if (changed || parents.some((p) => p.entry!.revision !== p.ref.revision || p.entry!.review_state === "rejected" || p.entry!.evidence_validity !== "current"))
            entry.evidence_validity = "needs_review";
    }
    return result;
}
export function modelInput(operation: ModelInput["operation"], sources: Source[], document: InvestigationDocument, context: EvidenceContext): ModelInput {
    validateSources(sources, context);
    if (sources.length !== (operation === "observe" ? 1 : 2))
        throw new AppError(400, "Choose one record to observe or two to compare.");
    const observations = operation === "compare" ? document.entries.filter((e): e is Entry & { mode: ProviderMode } => e.kind === "observation" && e.mode !== "human" && e.evidence_validity === "current" && e.review_state !== "rejected" && e.sources.every((s) => sources.some((x) => x.asset_id === s.asset_id && x.revision === s.revision))) : [];
    return { operation, sources: sources.map((s) => ({ ...s, content: context.revisions.find((r) => r.asset_id === s.asset_id && r.revision === s.revision)!.content })),
        observations: observations.map((e) => ({ id: e.id, revision: e.revision, text: e.text, sources: e.sources, review_state:e.review_state, mode:e.mode })) };
}
export function validateAnalysis(raw: unknown, input: ModelInput) {
    const result = analysisSchema.parse(raw);
    const allowed = (s: Source) => input.sources.some((i) => i.asset_id === s.asset_id && i.revision === s.revision);
    const refs = [...result.observations, ...(result.connection?.supports ?? []), ...(result.connection?.contradicts ?? [])];
    if (refs.some((s) => !allowed(s)))
        throw new AppError(422, "The provider returned an invalid evidence reference.");
    if (input.operation === "observe" && (result.connection || result.questions.length))
        throw new AppError(422, "Unexpected comparison in an observation response.");
    if (input.operation === "compare" && (!result.connection || result.observations.length))
        throw new AppError(422, "The comparison response is incomplete.");
    if (result.connection?.outcome === "candidate" && new Set(result.connection.supports.map((s) => s.asset_id)).size !== 2)
        throw new AppError(422, "A connection needs support from both selected records.");
    return result;
}
export function importAnalysis(document: InvestigationDocument, run: RunResult, context: EvidenceContext): InvestigationDocument {
    validateSources(run.input.sources, context);
    const output = validateAnalysis(run.output, run.input);
    const identity = analysisIdentity(run.input);
    // Re-running another provider cannot silently restore rejected evidence.
    if (document.analysed.includes(identity))
        throw new AppError(409, "These source revisions have already been analysed. Review the saved suggestions.");
    const next = structuredClone(document);
    const add = (kind: Entry["kind"], text: string, sources: Source[], parents: Entry["parents"], details: Entry["details"]) => {
        const entry: Entry = { id: crypto.randomUUID(), kind, revision: 1, text, original_text: text, sources, parents, details,
            review_state: "unreviewed", evidence_validity: "current", mode: run.mode, model: run.model, run_id: run.id, created_at: new Date().toISOString() };
        next.entries.push(entry);
        return entry;
    };
    for (const observation of output.observations)
        add("observation", observation.claim, [{ asset_id: observation.asset_id, revision: observation.revision }], [], { locator: observation.locator, uncertainty: observation.uncertainty, original_uncertainty: observation.uncertainty });
    if (output.connection) {
        const sources = run.input.sources.map(({ asset_id, revision }) => ({ asset_id, revision }));
        const hypothesis = add("hypothesis", output.connection.statement, sources, run.input.observations.map(({ id, revision }) => ({ id, revision })), output.connection);
        for (const question of output.questions)
            add("question", question, sources, [{ id: hypothesis.id, revision: 1 }], {});
    }
    next.analysed.push(identity);
    return reconcile(next, context);
}
export function applyReview(document: InvestigationDocument, command: Exclude<InvestigationCommand, {
    action: "analyse";
}>, actor: string, context: EvidenceContext) {
    const next = reconcile(document, context);
    const get = (id: string, kind?: Entry["kind"]) => {
        const e = next.entries.find((e) => e.id === id && (!kind || e.kind === kind));
        if (!e)
            throw new AppError(404, "The referenced record is unavailable.");
        return e;
    };
    const usable = (e: Entry) => {
        validateSources(e.sources, context);
        if (e.evidence_validity !== "current" || e.review_state === "rejected")
            throw new AppError(409, "Review the changed or rejected evidence before continuing.");
    };
    if (command.action === "ask") {
        const parent = get(command.hypothesis_id, "hypothesis");
        if (parent.revision !== command.hypothesis_revision)
            throw new AppError(409, "This hypothesis changed. Reload before writing a question.");
        usable(parent);
        if (parent.review_state !== "accepted_for_inquiry")
            throw new AppError(409, "Choose the hypothesis for inquiry first.");
        // Inherit evidence, never model authorship. Actor comes from online Auth.
        next.entries.push({
            id: crypto.randomUUID(), kind: "question", revision: 1,
            text: command.text, original_text: command.text,
            review_state: "unreviewed", evidence_validity: "current",
            sources: structuredClone(parent.sources),
            parents: [{ id: parent.id, revision: parent.revision }],
            mode: "human", model: null, run_id: null,
            created_at: new Date().toISOString(), details: { recorder: actor },
        });
    }
    else if (command.action === "review") {
        const e = get(command.id);
        if (e.revision !== command.entry_revision)
            throw new AppError(409, "This suggestion changed. Reload before saving.");
        if (!["observation", "hypothesis", "question"].includes(e.kind))
            throw new AppError(400, "Use the record's editing form.");
        if (e.review_state === "rejected")
            throw new AppError(409, "Rejected suggestions remain rejected for these source revisions.");
        validateSources(e.sources, context);
        if (command.decision === "accepted_for_inquiry" && e.kind !== "hypothesis")
            throw new AppError(400, "Only hypotheses can be selected for inquiry.");
        if (command.decision === "selected" && e.kind !== "question")
            throw new AppError(400, "Select a question.");
        if (e.kind === "question" && command.decision !== "rejected") {
            for (const p of e.parents) {
                const parent = get(p.id);
                usable(parent);
                if (parent.review_state !== "accepted_for_inquiry")
                    throw new AppError(409, "Choose the hypothesis for inquiry first.");
            }
        }
        if (command.uncertainty !== undefined && (e.kind !== "observation" || command.decision !== "corrected"))
            throw new AppError(400, "Only observation corrections can change uncertainty.");
        if (command.decision === "corrected" && !command.text && !(e.kind === "observation" && command.uncertainty))
            throw new AppError(400, "Enter the correction.");
        if (e.kind === "observation" && command.decision === "corrected") {
            // Legacy documents could only correct text. Capture their untouched
            // uncertainty before the first edit; null means it was not recorded.
            if (e.details.original_uncertainty === undefined)
                e.details.original_uncertainty = e.details.uncertainty ?? null;
            e.details.uncertainty = command.uncertainty ?? e.details.uncertainty;
        }
        e.text = command.text ?? e.text;
        e.review_state = command.decision;
        e.revision += 1;
        // An explicit review rebinds current, usable parent revisions. Children
        // retain their old links and therefore require a separate review.
        if (command.decision !== "rejected") {
            for (const p of e.parents) {
                const parent = get(p.id);
                usable(parent);
                p.revision = parent.revision;
            }
            e.evidence_validity = "current";
        }
    }
    else {
        const parents = command.action === "testify" ? [get(command.question_id, "question")] : command.testimony_ids.map((id) => get(id, "testimony"));
        for (const parent of parents)
            usable(parent);
        if (command.action === "testify" && parents[0].review_state !== "selected")
            throw new AppError(409, "Select the question before recording a response.");
        if (command.action === "testify" && ["answered", "conflicting"].includes(command.response) && !command.text.trim())
            throw new AppError(400, "Record the person's words.");
        const sources = [...new Map(parents.flatMap((e) => e.sources).map((s) => [s.asset_id, s])).values()];
        const kind = command.action === "testify" ? "testimony" : "exhibit";
        const old = command.id ? get(command.id, kind) : undefined;
        if (old && old.revision !== command.entry_revision)
            throw new AppError(409, "This record changed. Reload before saving.");
        const text = command.action === "testify" ? command.text : parents.map((e) => `${e.details.speaker}: ${e.details.response === "unknown" ? "Does not remember." : e.details.response === "declined" ? "Chose not to answer." : e.text}`).join("\n\n");
        const entry: Entry = { id: old?.id ?? crypto.randomUUID(), kind, revision: (old?.revision ?? 0) + 1, text, original_text: old?.original_text ?? text,
            review_state: "recorded", evidence_validity: "current", sources, parents: parents.map((e) => ({ id: e.id, revision: e.revision })),
            // Testimony and curation are human work; model provenance lives in parents.
            mode: "human", model: null, run_id: null, created_at: old?.created_at ?? new Date().toISOString(),
            details: command.action === "testify" ? { speaker: command.speaker, recorder: actor, response: command.response, source_mode: command.source_mode } : { title: command.title } };
        if (old)
            next.entries[next.entries.indexOf(old)] = entry;
        else
            next.entries.push(entry);
    }
    return reconcile(next, context);
}
