import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { BatchJournal, durableJson, verifyAllowanceLedger, type BatchConfig } from "../scripts/real-world/batch-journal";
import { hash } from "../scripts/real-world/core";
import { generateAnalysis, metaRequest, ProviderFailure } from "@/lib/model-provider";
import { fixtureAnalysis } from "@/lib/model-fixture";
import type { ModelInput } from "@/lib/investigation-contracts";

const directories:string[]=[];
const scratch=()=>{const path=mkdtempSync(join(tmpdir(),"trace-batch-test-"));directories.push(path);return path;};
const body=(i:number)=>JSON.stringify({test:i});
const config=():BatchConfig=>({proposal_sha256:hash("proposal"),authorization_sha256:hash("test-only approval"),approved_at:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+60000).toISOString(),cases:Array.from({length:10},(_,i)=>({id:`case-${i}`,input_sha256:hash(String(i)),request_sha256:hash(body(i))}))});
afterEach(()=>{vi.unstubAllEnvs();for(const path of directories.splice(0)){if(!resolve(path).startsWith(join(tmpdir(),"trace-batch-test-")))throw new Error("Unsafe temporary cleanup");rmSync(path,{recursive:true,force:true});}});
it("bounds a separately approved medium/high comparison at twenty requests and 27 dollars",()=>{
  const c:BatchConfig={...config(),policy:"effort-comparison",cases:Array.from({length:20},(_,i)=>({id:`case-${i}`,input_sha256:hash(String(Math.floor(i/2))),request_sha256:hash(body(i))}))};
  const j=BatchJournal.create(join(scratch(),"run"),c);
  try{
    for(let i=0;i<20;i++){const r=c.cases[i];j.begin(r.id,r.input_sha256,r.request_sha256);j.dispatch(r.id,body(i));j.response(r.id,200);j.succeed(r.id,0.01,hash("result"));}
    expect(()=>j.begin(c.cases[19].id,c.cases[19].input_sha256,c.cases[19].request_sha256)).toThrow();
    const intents=readdirSync(j.directory).filter(n=>n.endsWith(".event.json")).map(n=>JSON.parse(readFileSync(join(j.directory,n),"utf8"))).filter(e=>e.kind==="intent");
    expect(intents.reduce((sum,e)=>sum+e.detail.reserved_cents,0)).toBe(2700);
    expect([0,1,2,3,4,5,6].map(g=>intents.filter(e=>e.detail.group===g).length)).toEqual([3,3,3,3,3,3,2]);
  }finally{j.close();}
});
it("reserves 3+3+3+1 across one durable journal and refuses an eleventh or repeated case",()=>{
  const c=config(),dir=join(scratch(),"run"),j=BatchJournal.create(dir,c);
  try{
    for(let i=0;i<10;i++){const r=c.cases[i];j.begin(r.id,r.input_sha256,r.request_sha256);j.dispatch(r.id,body(i));j.response(r.id,200);j.succeed(r.id,0.001,hash("test result"));}
    expect(()=>j.begin(c.cases[9].id,c.cases[9].input_sha256,c.cases[9].request_sha256)).toThrow();
    const intents=readdirSync(dir).filter(n=>n.endsWith(".event.json")).map(n=>JSON.parse(readFileSync(join(dir,n),"utf8"))).filter(e=>e.kind==="intent");
    expect([0,1,2,3].map(g=>intents.filter(e=>e.detail.group===g).length)).toEqual([3,3,3,1]);
    expect(intents.reduce((sum,e)=>sum+e.detail.reserved_cents,0)).toBe(1320);
  }finally{j.close();}
  expect(()=>BatchJournal.create(dir,c)).toThrow();
});
it("blocks expired approval, changed input/order/body and dispatch retries",()=>{
  const c=config(),dir=join(scratch(),"run");
  expect(()=>BatchJournal.create(dir,{...c,expires_at:new Date(0).toISOString()})).toThrow("current");
  const j=BatchJournal.create(dir,c),r=c.cases[0];
  try{expect(()=>j.begin("case-1",r.input_sha256,r.request_sha256)).toThrow("order");expect(()=>j.begin(r.id,hash("altered"),r.request_sha256)).toThrow("hash");j.begin(r.id,r.input_sha256,r.request_sha256);expect(()=>j.dispatch(r.id,body(1))).toThrow("hash");j.dispatch(r.id,body(0));expect(()=>j.dispatch(r.id,body(0))).toThrow("Retries");}finally{j.close();}
});
it("stops all later allowance groups after unknown outcome, bad cost or chain damage",()=>{
  const c=config(),j=BatchJournal.create(join(scratch(),"run"),c),r=c.cases[0];
  try{j.begin(r.id,r.input_sha256,r.request_sha256);j.dispatch(r.id,body(0));expect(()=>j.begin(c.cases[1].id,c.cases[1].input_sha256,c.cases[1].request_sha256)).toThrow("unresolved");j.response(r.id,200);expect(()=>j.succeed(r.id,Number.NaN,hash("out"))).toThrow("incomplete");j.stop(r.id,"Unknown cost");expect(()=>j.begin(c.cases[1].id,c.cases[1].input_sha256,c.cases[1].request_sha256)).toThrow("stopped");
    writeFileSync(join(j.directory,"002.event.json"),"{}");expect(()=>j.begin(r.id,r.input_sha256,r.request_sha256)).toThrow("inconsistent");
  }finally{j.close();}
});
it("keeps the existing per-call ledger guard and detects a tampered settlement",async()=>{
  const root=scratch(),input:ModelInput={operation:"observe",sources:[{asset_id:"11111111-1111-4111-8111-111111111111",revision:1,content:"TEST"}],observations:[]};
  const file=join(root,"approval.json"),now=new Date().toISOString(),id=crypto.randomUUID();
  durableJson(file,{id,model:"muse-spark-1.3",approved_at:now,expires_at:new Date(Date.now()+60000).toISOString(),catalogue_verified_at:now,pricing_verified_at:now,max_requests:3,max_usd:3.96,input_usd_per_million:1.25,output_usd_per_million:4.25,allowed_input_sha256:[hash(JSON.stringify(input))]});
  vi.stubEnv("META_APPROVAL_FILE",file);vi.stubEnv("META_LIVE_APPROVED","yes");vi.stubEnv("MODEL_API_KEY","test-only-not-a-real-key");vi.stubEnv("VERCEL","");
  verifyAllowanceLedger(file,[]);
  const request=JSON.stringify(metaRequest(input,"muse-spark-1.3"));const c=config();c.cases[0]={id:"case-0",input_sha256:hash(JSON.stringify(input)),request_sha256:hash(request)};
  const j=BatchJournal.create(join(root,"run"),c);let calls=0;
  try{j.begin("case-0",c.cases[0].input_sha256,c.cases[0].request_sha256);
    const run=await generateAnalysis(input,"meta-live",{fetcher:async(_url,options)=>{calls++;j.dispatch("case-0",String(options!.body));j.response("case-0",200);return Response.json({model:"muse-spark-1.3",choices:[{finish_reason:"stop",message:{content:JSON.stringify(fixtureAnalysis(input))}}],usage:{prompt_tokens:100,completion_tokens:50}});}});
    verifyAllowanceLedger(file,[{input_hash:c.cases[0].input_sha256,cost_usd:run.cost_usd!}]);j.succeed("case-0",run.cost_usd!,hash(JSON.stringify(run.raw)));expect(calls).toBe(1);
    const dir=join(root,`allowance-${id}`),settlement=readdirSync(dir).find(n=>n.endsWith("settlement.json"))!;const s=JSON.parse(readFileSync(join(dir,settlement),"utf8"));writeFileSync(join(dir,settlement),JSON.stringify({...s,cost_usd:null}));
    expect(()=>verifyAllowanceLedger(file,[{input_hash:c.cases[0].input_sha256,cost_usd:run.cost_usd!}])).toThrow("mismatch");
  }finally{j.close();}
});
it("blocks all later calls after provider schema failure even when usage is known",async()=>{
  const root=scratch(),input:ModelInput={operation:"observe",sources:[{asset_id:"11111111-1111-4111-8111-111111111111",revision:1,content:"TEST"}],observations:[]};
  const now=new Date().toISOString(),file=join(root,"approval.json");
  durableJson(file,{id:crypto.randomUUID(),model:"muse-spark-1.3",approved_at:now,expires_at:new Date(Date.now()+60000).toISOString(),catalogue_verified_at:now,pricing_verified_at:now,max_requests:3,max_usd:3.96,input_usd_per_million:1.25,output_usd_per_million:4.25,allowed_input_sha256:[hash(JSON.stringify(input))]});
  vi.stubEnv("META_APPROVAL_FILE",file);vi.stubEnv("META_LIVE_APPROVED","yes");vi.stubEnv("MODEL_API_KEY","test-only-not-a-real-key");vi.stubEnv("VERCEL","");
  const c=config();c.cases[0]={id:"case-0",input_sha256:hash(JSON.stringify(input)),request_sha256:hash(JSON.stringify(metaRequest(input,"muse-spark-1.3")))};
  const j=BatchJournal.create(join(root,"run"),c);let calls=0;
  try{
    j.begin("case-0",c.cases[0].input_sha256,c.cases[0].request_sha256);
    const output=fixtureAnalysis(input);output.observations[0].asset_id=crypto.randomUUID();
    await expect(generateAnalysis(input,"meta-live",{fetcher:async(_url,options)=>{calls++;j.dispatch("case-0",String(options!.body));j.response("case-0",200);return Response.json({model:"muse-spark-1.3",choices:[{finish_reason:"stop",message:{content:JSON.stringify(output)}}],usage:{prompt_tokens:100,completion_tokens:50}});}})).rejects.toBeInstanceOf(ProviderFailure);
    verifyAllowanceLedger(file,[{input_hash:c.cases[0].input_sha256,cost_usd:0.0003375}]);
    j.stop("case-0","Provider citation validation failed");
    for(const next of c.cases.slice(1))expect(()=>j.begin(next.id,next.input_sha256,next.request_sha256)).toThrow("stopped");
    expect(calls).toBe(1);
  }finally{j.close();}
});
