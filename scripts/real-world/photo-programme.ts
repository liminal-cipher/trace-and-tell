import { closeSync, existsSync, openSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { BatchJournal, durableJson, verifyAllowanceLedger } from "./batch-journal";
import { hash } from "./core";
import { inputHash } from "../../src/lib/model-budget";
import { generateAnalysis, metaRequest, ProviderFailure } from "../../src/lib/model-provider";
import { inferenceIdentity, META_ENDPOINT } from "../../src/lib/model-settings";
import type { ModelInput } from "../../src/lib/investigation-contracts";

const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const photoAuthoritySchema = z.object({
  user_instruction: z.string().min(20), approved_at: z.iso.datetime(), expires_at: z.iso.datetime(),
  catalogue_verified_at: z.iso.datetime(), pricing_verified_at: z.iso.datetime(), rights_verified_at: z.iso.datetime(),
  model: z.literal("muse-spark-1.3"), mode: z.literal("Standard"), profile: z.enum(["medium", "high", "max"]),
  max_requests: z.number().int().min(1).max(20), max_usd: z.number().positive().max(27),
  max_completion_tokens: z.literal(8192), timeout_ms: z.literal(180000), retries: z.literal(0),
  input_usd_per_million: z.literal(1.25), output_usd_per_million: z.literal(4.25),
  sources: z.array(z.object({ asset_id: z.uuid(), revision: z.literal(1), content: z.string().nullable(),
    image_sha256: sha.nullable(), original_path: z.string().optional(), original_sha256: sha.optional(),
    external_standard_use: z.literal("cleared"), privacy: z.literal("screened"),
  }).strict()).min(1),
  references: z.array(z.object({ path: z.string(), sha256: sha }).strict()).min(1),
}).strict();
export type PhotoAuthority = z.infer<typeof photoAuthoritySchema>;
export type PhotoRequest = { id: string; input: ModelInput; input_sha256: string; request_sha256: string; execution_sha256: string };
export type PhotoPhase = { authority_sha256: string; requests: PhotoRequest[]; references: { path: string; sha256: string }[] };
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const fileHash = (path: string) => hash(readFileSync(path));
export function phaseFiles(root: string) {
  return readdirSync(root, { recursive: true, withFileTypes: true }).filter(e => e.isFile() && !["execution.lock", "complete.json"].includes(e.name))
    .map(e => ({ path: resolve(e.parentPath, e.name).slice(resolve(root).length + 1).replaceAll("\\", "/"), sha256: fileHash(join(e.parentPath, e.name)) })).sort((a, b) => a.path.localeCompare(b.path));
}
export function completedPhotoPhases(root: string) {
  const phases = readdirSync(root).filter(n => /^phase-\d{2}$/.test(n)).sort();
  let attempts = 0, cost = 0;
  const executions: string[] = [];
  phases.forEach((name, index) => {
    if (name !== `phase-${String(index + 1).padStart(2, "0")}`) throw new Error("Programme phase sequence is inconsistent");
    const directory = join(root, name), receipt = json(join(directory, "complete.json"));
    if (JSON.stringify(receipt.files) !== JSON.stringify(phaseFiles(directory))) throw new Error("Previous phase evidence changed");
    const summary = json(join(directory, "summary.json"));
    if (summary.stopped || summary.failed || summary.dispatched !== summary.planned || summary.succeeded !== summary.planned || summary.live_disabled !== true) throw new Error("A previous phase did not complete safely");
    const results = summary.results as { execution_sha256: string; calculated_cost_usd: number }[];
    if (results.length !== summary.planned || results.some(r => !Number.isFinite(r.calculated_cost_usd) || r.calculated_cost_usd < 0 || r.calculated_cost_usd > 1.35)) throw new Error("Previous phase cost is unknown");
    attempts += summary.dispatched; cost += results.reduce((n, r) => n + r.calculated_cost_usd, 0);
    executions.push(...results.map(r => r.execution_sha256));
  });
  if (new Set(executions).size !== executions.length) throw new Error("Duplicate execution in programme");
  return { phases: phases.length, attempts, cost, executions };
}
function verifyReferences(root: string, refs: {path:string;sha256:string}[]) {
  for (const ref of refs) {
    const path = resolve(root, ref.path);
    if (!path.startsWith(resolve(root) + sep) || fileHash(path) !== ref.sha256) throw new Error("Referenced evidence changed");
  }
}
export function verifyPhotoPhase(root: string, authority: PhotoAuthority, phase: PhotoPhase, now = Date.now()) {
  if (existsSync(join(root, "programme-closed.json"))) throw new Error("Programme is closed; a new explicit authority is required");
  if (Date.parse(authority.approved_at) > now || Date.parse(authority.expires_at) <= now ||
      [authority.catalogue_verified_at, authority.pricing_verified_at, authority.rights_verified_at].some(d => Date.parse(d) > now || now - Date.parse(d) > 86400000)) throw new Error("Programme authority or verification expired");
  if (!phase.requests.length || phase.requests.length > 20 || new Set(phase.requests.map(r => r.id)).size !== phase.requests.length) throw new Error("Invalid phase request list");
  verifyReferences(root, [...authority.references, ...phase.references]);
  const history = completedPhotoPhases(root);
  if (history.attempts + phase.requests.length > authority.max_requests || (history.attempts + phase.requests.length) * 135 > Math.round(authority.max_usd * 100)) throw new Error("Cumulative programme reservation exceeded");
  for (const source of authority.sources) if (source.original_path) verifyReferences(root, [{path:source.original_path,sha256:source.original_sha256!}]);
  for (const r of phase.requests) {
    if (!/^[a-z0-9-]+$/.test(r.id)) throw new Error("Unsafe case ID");
    for (const source of r.input.sources) {
      const allowed = authority.sources.find(s => s.asset_id === source.asset_id && s.revision === source.revision);
      const imageHash = source.image ? hash(Buffer.from(source.image.split(",")[1], "base64")) : null;
      if (!allowed || source.content !== allowed.content || imageHash !== allowed.image_sha256) throw new Error("Source bytes or scoped permission mismatch");
    }
    const identity = inferenceIdentity(metaRequest(r.input, authority.model, authority.profile), authority.profile);
    if (inputHash(r.input) !== r.input_sha256 || identity.request_sha256 !== r.request_sha256 || identity.execution_sha256 !== r.execution_sha256) throw new Error("Input or execution hash mismatch");
    if (history.executions.includes(r.execution_sha256)) throw new Error("Retries across phases are forbidden");
  }
  if (new Set(phase.requests.map(r => r.execution_sha256)).size !== phase.requests.length) throw new Error("Repeated phase execution");
  return history;
}

export async function runPhotoPhase(root: string, planPath: string, fetcher: typeof fetch = fetch) {
  root = resolve(root);
  process.env.META_LIVE_APPROVED = "no";
  const lockPath = join(root, "programme.lock"), lock = openSync(lockPath, "wx");
  let journal: BatchJournal | undefined;
  try {
    const authPath = join(root, "authorization.json"), authHash = fileHash(authPath), planHash = fileHash(planPath);
    const authority = photoAuthoritySchema.parse(json(authPath)), phase = json(planPath) as PhotoPhase;
    if (phase.authority_sha256 !== authHash) throw new Error("Phase authority mismatch");
    const history = verifyPhotoPhase(root, authority, phase);
    const priorEvidence = Array.from({length:history.phases},(_,i)=>`phase-${String(i+1).padStart(2,"0")}`).flatMap(name => [
      ...phaseFiles(join(root,name)).map(file=>({path:`${name}/${file.path}`,sha256:file.sha256})),
      {path:`${name}/complete.json`,sha256:fileHash(join(root,name,"complete.json"))},
    ]);
    const directory = join(root, `phase-${String(history.phases + 1).padStart(2, "0")}`);
    journal = BatchJournal.create(directory, { policy: "photo-inquiry", proposal_sha256: planHash, authorization_sha256: authHash, approved_at: authority.approved_at, expires_at: authority.expires_at,
      cases: phase.requests.map(r => ({id:r.id,input_sha256:r.input_sha256,request_sha256:r.request_sha256})) });
    durableJson(join(directory, "plan.json"), phase);
    const allowances: string[] = [], completed: {input_hash:string;execution_sha256:string;cost_usd:number}[][] = [];
    const results: Record<string, unknown>[] = [];
    let stopped = false, dispatched = 0;
    const current = () => {
      if (fileHash(authPath) !== authHash || fileHash(planPath) !== planHash || Date.now() >= Date.parse(authority.expires_at)) throw new Error("Execution authority changed or expired");
      verifyReferences(root, [...authority.references, ...phase.references, ...priorEvidence]);
      for (const source of authority.sources) if (source.original_path) verifyReferences(root, [{path:source.original_path,sha256:source.original_sha256!}]);
    };
    try {
      for (let i = 0; i < phase.requests.length; i += 3) {
        const group = phase.requests.slice(i, i + 3), path = join(directory, `approval-${i / 3}.json`);
        durableJson(path, { id:randomUUID(),model:authority.model,approved_at:authority.approved_at,expires_at:authority.expires_at,catalogue_verified_at:authority.catalogue_verified_at,pricing_verified_at:authority.pricing_verified_at,
          max_requests:group.length,max_usd:group.length*135/100,input_usd_per_million:1.25,output_usd_per_million:4.25,allowed_input_sha256:group.map(r=>r.input_sha256),
          request_bindings:group.map(r=>({input_sha256:r.input_sha256,request_sha256:r.request_sha256,execution_sha256:r.execution_sha256,profile:authority.profile})) });
        allowances.push(path); completed.push([]);
      }
      const allowanceHashes = allowances.map(fileHash);
      const checkLedgers = () => allowances.forEach((path,i) => { if(fileHash(path)!==allowanceHashes[i])throw new Error("Allowance changed");verifyAllowanceLedger(path,completed[i],1.35); });
      for (const [i,r] of phase.requests.entries()) {
        let sent = false;
        try {
          current(); checkLedgers();
          if ((history.attempts+i+1)>authority.max_requests || (history.attempts+i+1)*135>Math.round(authority.max_usd*100)) throw new Error("Cumulative cap exceeded");
          journal.begin(r.id,r.input_sha256,r.request_sha256);
          process.env.META_APPROVAL_FILE=allowances[Math.floor(i/3)];process.env.META_LIVE_APPROVED="yes";
          const run=await generateAnalysis(r.input,"meta-live",{profile:authority.profile,fetcher:async(url,options)=>{
            current();
            if(url!==META_ENDPOINT||options?.method!=="POST")throw new Error("Unexpected request");
            journal!.dispatch(r.id,String(options.body));sent=true;dispatched++;
            const response=await fetcher(url,options);journal!.response(r.id,response.status);return response;
          }});
          process.env.META_LIVE_APPROVED="no";
          if(!run.usage||run.cost_usd===null||run.inference?.execution_sha256!==r.execution_sha256)throw new Error("Unknown usage, cost or execution");
          completed[Math.floor(i/3)].push({input_hash:r.input_sha256,execution_sha256:r.execution_sha256,cost_usd:run.cost_usd});checkLedgers();
          const result={case_id:r.id,input_sha256:r.input_sha256,execution_sha256:r.execution_sha256,request_sha256:r.request_sha256,calculated_cost_usd:run.cost_usd,billing_verified:false,human_review:"PENDING",schema_validation:"PASS",run};
          const resultPath=join(directory,`${r.id}.result.json`);durableJson(resultPath,result);journal.succeed(r.id,run.cost_usd,fileHash(resultPath));results.push(result);
          console.log(JSON.stringify({case:r.id,status:"success",programme_attempts:history.attempts+dispatched}));
        } catch(error) {
          stopped=true;process.env.META_LIVE_APPROVED="no";
          const reason=error instanceof Error?error.message:"Unknown failure";
          durableJson(join(directory,`${r.id}.failure.json`),{case_id:r.id,sent,reason,provider_failure:error instanceof ProviderFailure?error.record:null});
          journal.stop(r.id,reason);break;
        }
      }
    } finally {
      process.env.META_LIVE_APPROVED="no";process.env.META_APPROVAL_FILE="";
      durableJson(join(directory,"summary.json"),{planned:phase.requests.length,dispatched,succeeded:results.length,failed:stopped?1:0,stopped,live_disabled:true,human_reviewed:0,results});
      journal.close();
    }
    if(!stopped&&results.length===phase.requests.length)durableJson(join(directory,"complete.json"),{files:phaseFiles(directory)});
    if(stopped)throw new Error("Photo programme stopped; no further paid requests permitted");
    return directory;
  } finally {
    process.env.META_LIVE_APPROVED="no";process.env.META_APPROVAL_FILE="";process.env.MODEL_API_KEY="";
    journal?.close();closeSync(lock);unlinkSync(lockPath);
  }
}
