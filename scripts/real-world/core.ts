import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { validateAnalysis } from "../../src/lib/investigation-domain";
import { metaRequest, PROMPT_VERSION, SCHEMA_VERSION, SYSTEM_PROMPT } from "../../src/lib/model-provider";
import type { Analysis, ModelInput } from "../../src/lib/investigation-contracts";
import { prepareModelImage, ImagePreparationError, validatePreparedImage } from "../../src/lib/model-image";

export const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const text = z.string().min(1);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const manifestSchema = z.object({
  version: z.union([z.literal(1),z.literal(2)]), dataset_id: text,
  photos: z.array(z.object({
    id: z.string().regex(/^rw-\d{2}$/), title: text, page_url: z.url(), download_url: z.url(),
    author: text, license: text, license_url: z.url(), rights_status: z.enum(["cleared", "needs_review"]),
    rights_note: text, metadata_sha256: sha, retrieved_at: text,
    file: text, sha256: sha, bytes: z.number().int().positive(),
    width: z.number().int().positive(), height: z.number().int().positive(), edition: text,
    original_sha256: sha.nullable(), tags: z.array(text).min(1),
    facts: z.array(z.object({ id: text, text, locator: text })).min(1),
    unknowns: z.array(text).min(1), interpretations: z.array(text).optional(), illegible: z.array(text).optional(), source_uncertainties: z.array(text).optional(), visual_review: z.literal("assistant-provisional"),
    privacy_status: z.enum(["screened", "needs_review"]),
  })).min(20).max(30),
  pairs: z.array(z.object({
    id: z.string().regex(/^pair-\d{2}$/), photo_ids: z.array(text).min(1).max(2), text_control: text.optional(),
    category: z.enum(["related", "unrelated", "contradictory-control"]), expectation: text,
  })).min(10).max(15),
}).strict();
export type Manifest = z.infer<typeof manifestSchema>;
export function parseManifest(raw: unknown): Manifest {
  const m = manifestSchema.parse(raw);
  const ids = m.photos.map(p => p.id);
  if (new Set(ids).size !== ids.length || new Set(m.pairs.map(p => p.id)).size !== m.pairs.length) throw new Error("Duplicate IDs");
  if (new Set(m.photos.map(p => p.sha256)).size !== m.photos.length) throw new Error("Duplicate photo bytes must not inflate the sample");
  const factIds = m.photos.flatMap(p => p.facts.map(f => f.id));
  if (new Set(factIds).size !== factIds.length) throw new Error("Duplicate reference fact IDs");
  for (const p of m.pairs) {
    if (p.photo_ids.some(id => !ids.includes(id)) || new Set(p.photo_ids).size !== p.photo_ids.length || p.photo_ids.length + Number(Boolean(p.text_control)) !== 2) throw new Error("Pair must contain two distinct known sources");
  }
  return m;
}
export function sourceId(id: string) {
  const h = hash(`trace-real-world-v1:${id}`);
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
export function verifiedBytes(root: string, photo: Manifest["photos"][number]) {
  const base = realpathSync(root), path = realpathSync(resolve(root, photo.file));
  if (!path.startsWith(base + sep)) throw new Error("Dataset path escapes its root");
  const bytes = readFileSync(path);
  if (bytes.length !== photo.bytes || hash(bytes) !== photo.sha256) throw new Error("Photo bytes changed");
  return bytes;
}
export type PreparationEvidence = Awaited<ReturnType<typeof prepareModelImage>>["evidence"];
export interface PhotoCheck {
  id:string; original_sha256:string|null; file_sha256:string;
  preparation:PreparationEvidence|null; prepared_sha256:string|null; prepared_bytes:number|null;
  decoded_pixels_equal:boolean|null; human_visual_review:"PENDING";
  error:{category:string;message:string}|null;
}
export async function prepareCases(m: Manifest, root: string) {
  const sources = new Map<string, ModelInput["sources"][number]>();
  const checks:PhotoCheck[] = [];
  for (const p of m.photos) {
    const bytes = verifiedBytes(root, p);
    const metadataBytes = readFileSync(resolve(root, `${p.id}.metadata.json`));
    if (hash(metadataBytes) !== p.metadata_sha256) throw new Error("Source metadata changed");
    try {
      const prepared=await prepareModelImage(bytes);
      if(prepared.evidence.source.width!==p.width||prepared.evidence.source.height!==p.height)throw new Error("Photo dimensions changed");
      await validatePreparedImage(prepared.data_url);
      const reference=await sharp(bytes,{limitInputPixels:24_000_000,failOn:"warning"}).rotate().toColourspace("srgb").raw().timeout({seconds:10}).toBuffer();
      const decoded=await sharp(prepared.bytes).raw().timeout({seconds:10}).toBuffer();
      sources.set(p.id,{asset_id:sourceId(p.id),revision:1,content:null,image:prepared.data_url});
      checks.push({id:p.id,original_sha256:p.original_sha256,file_sha256:p.sha256,preparation:prepared.evidence,prepared_sha256:prepared.evidence.prepared.sha256,prepared_bytes:prepared.bytes.length,decoded_pixels_equal:!prepared.evidence.resized&&reference.equals(decoded),human_visual_review:"PENDING",error:null});
    } catch(error) {
      if(!(error instanceof ImagePreparationError))throw error;
      checks.push({id:p.id,original_sha256:p.original_sha256,file_sha256:p.sha256,preparation:null,prepared_sha256:null,prepared_bytes:null,decoded_pixels_equal:null,human_visual_review:"PENDING",error:{category:error.category,message:error.message}});
    }
  }
  const definitions = [
    ...m.photos.map(p => ({ id: `observe-${p.id}`, operation: "observe" as const, photo_ids: [p.id], text_control: undefined as string | undefined })),
    ...m.pairs.map(p => ({ ...p, operation: "compare" as const })),
  ];
  const cases = definitions.map(c => {
    const input: ModelInput = { operation:c.operation, sources:c.photo_ids.map(id => sources.get(id)??{asset_id:sourceId(id),revision:1,content:null}), observations:[] };
    if(c.text_control)input.sources.push({asset_id:sourceId(c.id+"-control"),revision:1,content:c.text_control});
    const blockers=c.photo_ids.flatMap(id=>{
      const p=m.photos.find(p=>p.id===id)!;
      const failure=checks.find(p=>p.id===id)!.error;
      return [failure ? `image_preparation:${failure.category}` : null,p.rights_status!=="cleared"?"rights_review":null,p.privacy_status!=="screened"?"privacy_review":null].filter((v):v is string=>Boolean(v));
    });
    let request_sha256:string|null=null;
    let provider_valid=false;
    if(c.photo_ids.every(id=>sources.has(id)))try {
      request_sha256=hash(JSON.stringify(metaRequest(input,"muse-spark-1.3")));provider_valid=true;
    } catch(error) {blockers.push((error as Error).message);}
    return {id:c.id,input,input_sha256:hash(JSON.stringify(input)),request_sha256,provider_valid,photo_ids:c.photo_ids,blockers:[...new Set(blockers)]};
  });
  return {photos:checks,cases,prompt_version:PROMPT_VERSION,prompt_sha256:hash(SYSTEM_PROMPT),schema_version:SCHEMA_VERSION};
}

export function outputFields(output: Analysis): Record<string, string> {
  const fields: Record<string, string> = {};
  output.observations.forEach((o,i) => { for (const key of ["claim","locator","uncertainty"] as const) fields[`observations.${i}.${key}`] = o[key]; });
  if (output.connection) {
    fields["connection.statement"] = output.connection.statement;
    for (const key of ["supports","contradicts"] as const) output.connection[key].forEach((e,i) => { fields[`connection.${key}.${i}.detail`] = e.detail; });
    output.connection.unknowns.forEach((v,i) => { fields[`connection.unknowns.${i}`] = v; });
  }
  output.questions.forEach((v,i) => { fields[`questions.${i}`] = v; });
  return fields;
}
const claimSchema = z.object({
  field: text, quote: text, verdict: z.enum(["grounded","incorrect","unsupported","unverifiable"]),
  issue: z.enum(["none","wrong_source","invented_person","invented_date","invented_relation","uncertainty","other"]),
  severity: z.number().int().min(0).max(3), evidence: text, rationale: text,
});
export const reviewSchema = z.object({
  kind: z.enum(["human","assistant"]), reviewer: text, reviewed_at: text,
  input_sha256: sha, output_sha256: sha,
  original_and_model_input_compared: z.literal(true),
  all_assertions_split_and_reviewed: z.literal(true),
  claims: z.array(claimSchema),
  omissions: z.array(z.object({ fact_id: text, verdict: z.enum(["present","omitted","uncertain"]), rationale: text })),
  questions: z.array(z.object({ index: z.number().int().nonnegative(), verdict: z.enum(["useful","not_useful","leading","unassessable"]), rationale: text })),
  uncertainty: z.enum(["appropriate","overconfident","overcautious","unassessable"]),
  connection: z.enum(["supported_candidate","appropriate_no_connection","forced_connection","missed_connection","not_applicable","unassessable"]),
}).strict();
export type Review = z.infer<typeof reviewSchema>;
export interface RecordedCase {
  case_id: string; input_sha256: string; mode: "meta-live" | "fixture" | "replay";
  transport: "success" | "failure" | "unknown"; output?: unknown; review?: Review;
}
export const recordsSchema = z.array(z.object({
  case_id: text, input_sha256: sha, mode: z.enum(["meta-live", "fixture", "replay"]),
  transport: z.enum(["success", "failure", "unknown"]), output: z.unknown().optional(), review: reviewSchema.optional(),
}).strict());
export function validateReview(review: Review, output: Analysis, inputHash: string, factIds: string[]) {
  const r = reviewSchema.parse(review), fields = outputFields(output);
  if (r.input_sha256 !== inputHash || r.output_sha256 !== hash(JSON.stringify(output))) throw new Error("Review is bound to different evidence");
  if (r.claims.some(c => !fields[c.field]?.includes(c.quote))) throw new Error("Review quotes missing output");
  if (Object.keys(fields).some(key => !r.claims.some(c => c.field === key))) throw new Error("Unreviewed output field");
  const facts = r.omissions.map(o => o.fact_id);
  if (new Set(facts).size !== facts.length || facts.length !== factIds.length || factIds.some(id => !facts.includes(id))) throw new Error("Incomplete omission review");
  const questions = r.questions.map(q => q.index);
  if (questions.length !== output.questions.length || new Set(questions).size !== questions.length || questions.some(i => i >= output.questions.length)) throw new Error("Incomplete question review");
  if (r.claims.some(c => c.verdict === "grounded" && (c.issue !== "none" || c.severity !== 0))) throw new Error("Contradictory claim grading");
  return r;
}
export function summarise(cases: {id:string;input:ModelInput;input_sha256:string;fact_ids:string[]}[], records: RecordedCase[]) {
  records = recordsSchema.parse(records);
  const seen = new Set<string>();
  const result = { planned: cases.length, attempted_live: 0, transport_success: 0, schema_valid: 0, not_run: cases.length, structural_failures: [] as string[], human_reviewed: 0, assistant_reviewed: 0, reviewed_claims: 0, grounded_claims: 0, unsupported_claims: 0, incorrect_claims: 0, unverifiable_claims: 0, annotated_facts: 0, omitted_facts: 0, questions: 0, useful_questions: 0, reviewed_comparisons: 0, empty_question_comparisons: 0, severe_cases: [] as string[], cases: [] as {id:string;status:string}[] };
  for (const record of records) {
    const c = cases.find(c => c.id === record.case_id);
    if (!c || c.input_sha256 !== record.input_sha256 || seen.has(c.id)) throw new Error("Duplicate, unknown or mismatched case");
    seen.add(c.id);
    if (record.mode !== "meta-live") { result.cases.push({ id: c.id, status: "excluded_non_live" }); continue; }
    result.attempted_live++; result.not_run--;
    if (record.transport !== "success") { result.cases.push({id:c.id,status:record.transport}); continue; }
    result.transport_success++;
    let output: Analysis;
    try { output = validateAnalysis(record.output, c.input); }
    catch { result.structural_failures.push(c.id); result.cases.push({id:c.id,status:"structural_failure"}); continue; }
    result.schema_valid++;
    if (!record.review) { result.cases.push({id:c.id,status:"semantic_review_pending"}); continue; }
    const review = validateReview(record.review, output, c.input_sha256, c.fact_ids);
    if (review.kind !== "human") { result.assistant_reviewed++; result.cases.push({id:c.id,status:"assistant_only"}); continue; }
    result.human_reviewed++; result.reviewed_claims += review.claims.length;
    for (const claim of review.claims) {
      if (claim.verdict === "grounded") result.grounded_claims++;
      if (claim.verdict === "unsupported") result.unsupported_claims++;
      if (claim.verdict === "incorrect") result.incorrect_claims++;
      if (claim.verdict === "unverifiable") result.unverifiable_claims++;
    }
    result.annotated_facts += review.omissions.length;
    result.omitted_facts += review.omissions.filter(o => o.verdict === "omitted").length;
    result.questions += review.questions.length;
    result.useful_questions += review.questions.filter(q => q.verdict === "useful").length;
    if (c.input.operation === "compare") { result.reviewed_comparisons++; if (!output.questions.length) result.empty_question_comparisons++; }
    if (review.claims.some(c => c.severity >= 2) || review.connection === "forced_connection") result.severe_cases.push(c.id);
    result.cases.push({id:c.id,status:"human_reviewed"});
  }
  for (const c of cases) if (!seen.has(c.id)) result.cases.push({ id: c.id, status: "not_run" });
  return { ...result, rates: { transport: { numerator: result.transport_success, denominator: result.attempted_live }, schema: { numerator: result.schema_valid, denominator: result.transport_success }, grounded_claims: { numerator: result.grounded_claims, denominator: result.reviewed_claims }, omissions: { numerator: result.omitted_facts, denominator: result.annotated_facts }, useful_questions: { numerator: result.useful_questions, denominator: result.questions } }, note: "Zero denominator means not measured, never 0% or 100% accuracy. Fact recall is limited to annotated facts. No general-population accuracy claim." };
}
