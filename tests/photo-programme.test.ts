import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { completedPhotoPhases, runPhotoPhase, verifyPhotoPhase, type PhotoAuthority, type PhotoPhase } from "../scripts/real-world/photo-programme";
import { durableJson } from "../scripts/real-world/batch-journal";
import { hash } from "../scripts/real-world/core";
import { metaRequest } from "@/lib/model-provider";
import { inferenceIdentity } from "@/lib/model-settings";
import { fixtureAnalysis } from "@/lib/model-fixture";
import type { ModelInput } from "@/lib/investigation-contracts";
const roots:string[]=[];
afterEach(()=>{vi.unstubAllEnvs();for(const root of roots.splice(0))if(root.startsWith(join(tmpdir(),"trace-photo-programme-")))rmSync(root,{recursive:true,force:true});});
function setup(max=3) {
  const root=mkdtempSync(join(tmpdir(),"trace-photo-programme-"));roots.push(root);
  const input:ModelInput={operation:"observe",sources:[{asset_id:crypto.randomUUID(),revision:1,content:"Synthetic test text"}],observations:[]};
  const now=new Date().toISOString();
  durableJson(join(root,"rights.json"),{synthetic:true});
  const authority:PhotoAuthority={user_instruction:"Synthetic test approval, no real API authorised",approved_at:now,expires_at:new Date(Date.now()+600000).toISOString(),catalogue_verified_at:now,pricing_verified_at:now,rights_verified_at:now,
    model:"muse-spark-1.3",mode:"Standard",profile:"medium",max_requests:max,max_usd:max*135/100,max_completion_tokens:8192,timeout_ms:180000,retries:0,input_usd_per_million:1.25,output_usd_per_million:4.25,
    sources:[{...input.sources[0],revision:1,image_sha256:null,external_standard_use:"cleared",privacy:"screened"}],references:[{path:"rights.json",sha256:hash(readFileSync(join(root,"rights.json")))}]};
  durableJson(join(root,"authorization.json"),authority);
  const request=(id:string,value=input)=>{const identity=inferenceIdentity(metaRequest(value,"muse-spark-1.3","medium"),"medium");return {id,input:value,input_sha256:hash(JSON.stringify(value)),request_sha256:identity.request_sha256,execution_sha256:identity.execution_sha256};};
  const phase:PhotoPhase={authority_sha256:hash(readFileSync(join(root,"authorization.json"))),requests:[request("observe")],references:[]};
  durableJson(join(root,"plan.json"),phase);
  const fetcher=vi.fn(async()=>Response.json({model:"muse-spark-1.3",choices:[{finish_reason:"stop",message:{content:JSON.stringify(fixtureAnalysis(input))}}],usage:{prompt_tokens:100,completion_tokens:50}}));
  const key=()=>{vi.stubEnv("MODEL_API_KEY","synthetic-mock-key");vi.stubEnv("VERCEL","");};
  return {root,input,authority,phase,request,fetcher,key};
}
it("persists actual dispatch once, keeps previous evidence immutable and rejects replay in a new phase",async()=>{
  const s=setup();s.key();await runPhotoPhase(s.root,join(s.root,"plan.json"),s.fetcher);
  expect(s.fetcher).toHaveBeenCalledTimes(1);
  expect(completedPhotoPhases(s.root)).toMatchObject({attempts:1,cost:0.0003375});
  expect(process.env.META_LIVE_APPROVED).toBe("no");expect(process.env.MODEL_API_KEY).toBe("");
  expect(()=>verifyPhotoPhase(s.root,s.authority,s.phase)).toThrow("Retries");
  writeFileSync(join(s.root,"phase-01","observe.result.json"),"{}");
  expect(()=>completedPhotoPhases(s.root)).toThrow("changed");
});
it("a closed programme cannot consume remaining approval slots",async()=>{
  const s=setup();s.key();durableJson(join(s.root,"programme-closed.json"),{reason:"Work complete"});
  await expect(runPhotoPhase(s.root,join(s.root,"plan.json"),s.fetcher)).rejects.toThrow("closed");
  expect(s.fetcher).not.toHaveBeenCalled();
  expect(process.env.META_LIVE_APPROVED).toBe("no");
});
it("a failed or uncertain call stops the entire programme across new allowance groups",async()=>{
  const s=setup();s.key();
  const fetcher=vi.fn(async()=>{throw Error("Unknown network outcome");});
  await expect(runPhotoPhase(s.root,join(s.root,"plan.json"),fetcher)).rejects.toThrow("stopped");
  expect(fetcher).toHaveBeenCalledTimes(1);
  s.key();await expect(runPhotoPhase(s.root,join(s.root,"plan.json"),fetcher)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("rechecks source rights, hashes, expiry and the cumulative conservative reservation",async()=>{
  const s=setup(1);s.key();await runPhotoPhase(s.root,join(s.root,"plan.json"),s.fetcher);
  expect(()=>verifyPhotoPhase(s.root,s.authority,s.phase)).toThrow("Cumulative");
  const other=setup();
  expect(()=>verifyPhotoPhase(other.root,{...other.authority,expires_at:new Date(0).toISOString()},other.phase)).toThrow("expired");
  const changed=structuredClone(other.phase);changed.requests[0].input.sources[0].content="Different bytes";
  expect(()=>verifyPhotoPhase(other.root,other.authority,changed)).toThrow("Source");
  const hashChanged=structuredClone(other.phase);hashChanged.requests[0].execution_sha256="0".repeat(64);
  expect(()=>verifyPhotoPhase(other.root,other.authority,hashChanged)).toThrow("hash");
  writeFileSync(join(other.root,"rights.json"),"{}");
  expect(()=>verifyPhotoPhase(other.root,other.authority,other.phase)).toThrow("evidence");
});
