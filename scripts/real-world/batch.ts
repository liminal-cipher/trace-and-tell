import { hash, type Manifest, type PhotoCheck, type prepareCases } from "./core";
import { metaRequest } from "../../src/lib/model-provider";

// An offline proposal, deliberately incompatible with the live allowance schema.
// These choices include hard/negative cases, not just easy readable signs.
export const INITIAL_CASES = ["observe-rw-01", "observe-rw-07", "observe-rw-08", "observe-rw-14", "observe-rw-16", "observe-rw-20", "pair-01", "pair-05", "pair-09", "pair-10"] as const;
type Case = Awaited<ReturnType<typeof prepareCases>>["cases"][number];
export interface RightsAssessment {
  photos: { id:string; page_url:string; page_sha256:string; external_ai:string; attribution:string; conditions:string[] }[];
}
export function initialBatch(m:Manifest, photos:PhotoCheck[], cases:Case[], rights:RightsAssessment) {
  const selected=INITIAL_CASES.map(id=>{
    const c=cases.find(c=>c.id===id);
    if(!c||!c.provider_valid||c.blockers.length||c.input_sha256!==hash(JSON.stringify(c.input)))throw new Error(`Batch input is not eligible: ${id}`);
    const request=metaRequest(c.input,"muse-spark-1.3");
    if(hash(JSON.stringify(request))!==c.request_sha256)throw new Error("Batch request changed");
    const sources=c.input.sources.map((s,index)=>{
      const photoId=c.photo_ids[index];
      if(!photoId)return {order:index+1,asset_id:s.asset_id,revision:s.revision,kind:"authored false text control",text:s.content,source_sha256:hash(s.content!)};
      const p=m.photos.find(p=>p.id===photoId)!,check=photos.find(p=>p.id===photoId)!,r=rights.photos.find(p=>p.id===photoId);
      if(!r||r.external_ai!=="permitted_standard_inference"||r.page_url!==p.page_url||p.rights_status!=="cleared"||p.privacy_status!=="screened"||!check?.decoded_pixels_equal||!check.preparation||check.file_sha256!==p.sha256)throw new Error(`Batch rights or lossless check incomplete: ${photoId}`);
      return {order:index+1,asset_id:s.asset_id,revision:s.revision,photo_id:photoId,source_sha256:p.sha256,separately_retained_full_resolution_sha256:p.original_sha256,edition:p.edition,prepared_sha256:check.prepared_sha256,mime:check.preparation.prepared.mime,conversion:check.preparation.profile,dimensions:check.preparation.prepared,rights:r};
    });
    return {case_id:c.id,operation:c.input.operation,input_sha256:c.input_sha256,request_sha256:c.request_sha256,sources};
  });
  return {
    status:"BLOCKED — separate explicit paid-batch approval required", approved_at:null,
    model:"muse-spark-1.3",mode:"Standard",endpoint:"https://api.meta.ai/v1/chat/completions",
    catalogue_verified_at:"2026-11-03T12:09:00Z",pricing_verified_at:"2026-11-03T12:09:00Z",
    catalogue_source:"https://dev.meta.ai/docs/models",pricing_source:"https://dev.meta.ai/docs/pricing-rate-limits",
    expires_at:"2026-11-04T03:00:00Z",max_requests:10,retries:0,max_completion_tokens_each:1200,timeout_ms_each:45000,
    pricing_usd_per_million:{uncached_input:1.25,output:4.25},max_reserved_usd_each:1.32,max_total_usd:13.20,
    expected_cost:{range_usd:[0.076,0.151],basis:"Planning assumption only: 2,000–8,000 input tokens and all 1,200 output tokens per request. No token-counting API used; not measured usage, an invoice or a cap."},
    allowances:[3,3,3,1].map((count,i)=>({group:i+1,case_ids:selected.slice(i*3,i*3+count).map(c=>c.case_id),max_requests:count,max_usd:Math.round(count*132)/100,status:"NOT CREATED"})),
    execution_rules:[
      "Execute serially in the listed order, using four newly approved local allowances and one durable aggregate journal; do not touch any existing allowance or ledger.",
      "Before every dispatch verify all exact input/request hashes, source editions, rights, current prompt, code, expiry and aggregate remaining calls/cost. Reserve once and mark the case attempted before dispatch.",
      "A transport failure, timeout, missing usage, unknown cost/outcome or ledger inconsistency stops the entire batch, including later allowance groups. No retry or replacement request.",
      "Changing input bytes, source IDs/revisions/order, prompt, model, caps or expiry requires a new proposal and explicit approval. Expired public pricing/catalogue verification must be renewed.",
      "Use evaluation-only Source IDs and REV1 from the fixed inputs.json; no Supabase records or writes. No catalogue/token-count calls, tools, Contributor mode, uploads to a public demo or unrelated requests.",
      "Retain every raw response, usage, calculated cost and failure. API/schema success is separate from claim accuracy; human review remains pending. Account invoice cost remains unknown until checked."
    ],
    source_scope:"Exact local evaluation sources, not registered Supabase Source IDs. Text is UTF-8 without a BOM or trailing newline. Image source hash denotes downloaded preview bytes, not the separately retained full-resolution file.",
    human_review:"PENDING; assistant comparison and pixel equality do not establish human ground truth",requests:selected,
  };
}

// A blocked candidate must still produce the full review/failure packet.
export function batchProposal(...args:Parameters<typeof initialBatch>) {
  try { return initialBatch(...args); }
  catch(error) {
    return {status:"BLOCKED — input, rights or quality checks incomplete",reason:error instanceof Error?error.message:"Batch preparation failed",approved_at:null,expires_at:null,max_requests:0,requests:[],allowances:[]};
  }
}
