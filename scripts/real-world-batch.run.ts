import { test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { verifyFixedBatch, RUN_ROOT, PROPOSAL_SHA } from "./real-world/live-preflight";
import { BatchJournal, durableJson, verifyAllowanceLedger } from "./real-world/batch-journal";
import { hash, summarise, type RecordedCase } from "./real-world/core";
import { generateAnalysis, ProviderFailure } from "../src/lib/model-provider";

// No environment file is loaded until explicit, current authorisation is valid.
const authorizationSchema=z.object({
  proposal_sha256:z.literal(PROPOSAL_SHA),approved_at:z.iso.datetime(),expires_at:z.iso.datetime(),
  expiry_renewal_confirmed:z.literal(true),user_instruction:z.string().min(20),
  catalogue_verified_at:z.iso.datetime(),pricing_verified_at:z.iso.datetime(),
  model:z.literal("muse-spark-1.3"),mode:z.literal("Standard"),max_requests:z.literal(10),
  max_usd:z.literal(13.20),retries:z.literal(0),max_completion_tokens:z.literal(1200),timeout_ms:z.literal(45000),
  input_usd_per_million:z.literal(1.25),output_usd_per_million:z.literal(4.25),
}).strict();
test("preflights or executes only the separately authorised fixed real-photo batch",async()=>{
  process.env.META_LIVE_APPROVED="no";process.env.META_APPROVAL_FILE="";
  const fixed=await verifyFixedBatch();
  const stamp=new Date().toISOString().replaceAll(":","-");
  const preflight={checked_at:new Date().toISOString(),proposal_sha256:PROPOSAL_SHA,matching_inputs:fixed.selected.length,byte_identical:true,protected_files_unchanged:fixed.protected_files,frozen_reference_sha256:fixed.frozen_reference_sha256,original_expiry:fixed.original_expiry,expired:fixed.expired,live_calls:0,human_review:"PENDING"};
  durableJson(join(RUN_ROOT,`preflight-${stamp}.json`),preflight);
  if(process.env.REAL_PHOTO_EXECUTE!=="yes"){
    console.log(JSON.stringify({...preflight,status:fixed.expired?"BLOCKED: fixed approval expired":"PREFLIGHT ONLY"}));return;
  }
  const authorizationPath=join(RUN_ROOT,"authorization.json");
  const authorizationBytes=readFileSync(authorizationPath);
  const auth=authorizationSchema.parse(JSON.parse(authorizationBytes.toString()));
  const current=()=>{
    const now=Date.now();
    if(Date.parse(auth.approved_at)>now||Date.parse(auth.expires_at)<=now||[auth.catalogue_verified_at,auth.pricing_verified_at].some(d=>Date.parse(d)>now||now-Date.parse(d)>86400000))throw new Error("Approval or official verification expired");
    if(hash(readFileSync(authorizationPath))!==hash(authorizationBytes))throw new Error("Authorisation changed during execution");
  };
  current();
  const rightsBytes=readFileSync(join(RUN_ROOT,"rights-confirmed.json"));
  const rights=JSON.parse(rightsBytes.toString());
  if(rights.proposal_sha256!==PROPOSAL_SHA||rights.status!=="confirmed"||rights.selected_photos!==9||Date.now()-Date.parse(rights.checked_at)>86400000)throw new Error("Fresh scoped rights confirmation required");
  const codePaths=["scripts/real-world-batch.run.ts","scripts/real-world/live-preflight.ts","scripts/real-world/batch-journal.ts"];
  const codeHash=hash(codePaths.map(p=>hash(readFileSync(p))).join(""));
  const execution=resolve(RUN_ROOT,"execution");
  const journal=BatchJournal.create(execution,{proposal_sha256:PROPOSAL_SHA,authorization_sha256:hash(authorizationBytes),approved_at:auth.approved_at,expires_at:auth.expires_at,cases:fixed.proposal.requests.map(r=>({id:r.case_id,input_sha256:r.input_sha256,request_sha256:r.request_sha256!}))});
  const records:RecordedCase[]=[];const outcomes:Record<string,unknown>[]=[];
  const completed:{input_hash:string;cost_usd:number}[][]=[[],[],[],[]];
  const allowances:string[]=[];
  const allowanceHashes:string[]=[];
  let stopped=false;
  try {
    durableJson(join(execution,"runtime.json"),{code_sha256:codeHash,frozen_reference_sha256:fixed.frozen_reference_sha256,rights_sha256:hash(readFileSync(join(RUN_ROOT,"rights-confirmed.json"))),billing_verified:false});
    for(const group of fixed.proposal.allowances){
      const path=join(execution,`approval-${group.group}.json`);allowances.push(path);
      durableJson(path,{id:randomUUID(),model:auth.model,approved_at:auth.approved_at,expires_at:auth.expires_at,catalogue_verified_at:auth.catalogue_verified_at,pricing_verified_at:auth.pricing_verified_at,max_requests:group.max_requests,max_usd:group.max_usd,input_usd_per_million:auth.input_usd_per_million,output_usd_per_million:auth.output_usd_per_million,allowed_input_sha256:fixed.proposal.requests.filter(r=>group.case_ids.includes(r.case_id)).map(r=>r.input_sha256)});
      allowanceHashes.push(hash(readFileSync(path)));
    }
    if(existsSync(".env.local"))process.loadEnvFile(".env.local");
    if(!process.env.MODEL_API_KEY)throw new Error("Configured model key is unavailable");
    for(let i=0;i<fixed.selected.length;i++){
      const c=fixed.selected[i],group=Math.floor(i/3),started=Date.now();let dispatched=false,httpStatus:number|null=null;
      try {
        current();
        if(hash(codePaths.map(p=>hash(readFileSync(p))).join(""))!==codeHash)throw new Error("Execution code changed");
        const refreshed=await verifyFixedBatch();
        if(refreshed.frozen_reference_sha256!==fixed.frozen_reference_sha256||hash(readFileSync(join(RUN_ROOT,"rights-confirmed.json")))!==hash(rightsBytes))throw new Error("Frozen reference or rights confirmation changed");
        for(let g=0;g<4;g++){
          if(hash(readFileSync(allowances[g]))!==allowanceHashes[g])throw new Error("Allowance configuration changed");
          verifyAllowanceLedger(allowances[g],completed[g]);
        }
        journal.begin(c.id,c.input_sha256,c.request_sha256!);
        process.env.META_APPROVAL_FILE=allowances[group];process.env.META_LIVE_APPROVED="yes";
        const run=await generateAnalysis(c.input,"meta-live",{fetcher:async(url,options)=>{
          current();if(url!==fixed.proposal.endpoint||options?.method!=="POST")throw new Error("Unexpected provider request");
          journal.dispatch(c.id,String(options.body));dispatched=true;
          const response=await fetch(url,options);httpStatus=response.status;journal.response(c.id,response.status);return response;
        }});
        process.env.META_LIVE_APPROVED="no";
        if(run.cost_usd===null||!run.usage)throw new Error("Unknown usage or cost");
        completed[group].push({input_hash:c.input_sha256,cost_usd:run.cost_usd});
        for(let g=0;g<4;g++)verifyAllowanceLedger(allowances[g],completed[g]);
        const result={case_id:c.id,input_sha256:c.input_sha256,request_sha256:c.request_sha256,mode:run.mode,model:run.model,standard:true,dispatched,http_status:httpStatus,latency_ms:run.latency_ms,total_ms:Date.now()-started,usage:run.usage,calculated_cost_usd:run.cost_usd,billing_verified:false,raw:run.raw,output:run.output,structural_validation:"PASS",human_review:"PENDING",question_count:run.output.questions.length};
        const resultPath=join(execution,`${String(i+1).padStart(2,"0")}-${c.id}.result.json`);
        durableJson(resultPath,result);
        journal.succeed(c.id,run.cost_usd,hash(readFileSync(resultPath)));
        records.push({case_id:c.id,input_sha256:c.input_sha256,mode:"meta-live",transport:"success",output:run.output});outcomes.push({case_id:c.id,status:"success",dispatched,usage:run.usage,calculated_cost_usd:run.cost_usd,latency_ms:run.latency_ms});
        console.log(JSON.stringify({case_id:c.id,status:"success",actual_attempts:i+1}));
      } catch(error) {
        process.env.META_LIVE_APPROVED="no";stopped=true;
        const failure=error instanceof ProviderFailure?error.record:null;
        const result={case_id:c.id,input_sha256:c.input_sha256,request_sha256:c.request_sha256,model:auth.model,mode:"meta-live",standard:true,dispatched,http_status:httpStatus,elapsed_ms:Date.now()-started,provider_failure:failure,reason:error instanceof Error?error.message:"Batch failure",human_review:"PENDING",billing_verified:false};
        durableJson(join(execution,`${String(i+1).padStart(2,"0")}-${c.id}.failure.json`),result);
        journal.stop(c.id,result.reason);
        let output:unknown;const raw=failure?.raw as {choices?:{message?:{content?:string}}[]}|null;
        try{output=JSON.parse(raw?.choices?.[0]?.message?.content??"null");}catch{output=raw?.choices?.[0]?.message?.content;}
        if(dispatched)records.push({case_id:c.id,input_sha256:c.input_sha256,mode:"meta-live",transport:httpStatus!==null&&httpStatus>=200&&httpStatus<300&&raw?"success":httpStatus===null?"unknown":"failure",...(output!==undefined?{output}:{})});
        outcomes.push({case_id:c.id,status:"failed",dispatched,usage:failure?.usage??null,calculated_cost_usd:failure?.cost_usd??null,reason:result.reason});
        break;
      }
    }
  } catch(error) {
    stopped=true;journal.stop("batch-setup",error instanceof Error?error.message:"Setup failed");
    throw error;
  } finally {
    process.env.META_LIVE_APPROVED="no";process.env.META_APPROVAL_FILE="";process.env.MODEL_API_KEY="";
    const cases=fixed.selected.map(c=>({...c,fact_ids:c.photo_ids.flatMap(id=>fixed.manifest.photos.find(p=>p.id===id)!.facts.map(f=>f.id))}));
    durableJson(join(execution,"records.json"),records);
    durableJson(join(execution,"summary.json"),{stopped,live_disabled:true,planned:10,dispatched:outcomes.filter(o=>o.dispatched).length,succeeded:outcomes.filter(o=>o.status==="success").length,failed:outcomes.filter(o=>o.status==="failed"&&o.dispatched).length,not_dispatched:10-outcomes.filter(o=>o.dispatched).length,outcomes,semantic:summarise(cases,records),billing_verified:false});
    journal.close();
  }
},900000);
