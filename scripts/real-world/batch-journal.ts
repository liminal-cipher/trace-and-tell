import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { hash } from "./core";

const digest=z.string().regex(/^[a-f0-9]{64}$/);
const configSchema=z.object({
  proposal_sha256:digest, authorization_sha256:digest,
  approved_at:z.iso.datetime(),expires_at:z.iso.datetime(),
  policy:z.literal("effort-comparison").optional(),
  cases:z.array(z.object({id:z.string().min(1),input_sha256:digest,request_sha256:digest})).min(10).max(20),
}).strict();
export type BatchConfig=z.infer<typeof configSchema>;
type Event={sequence:number;previous_sha256:string|null;config_sha256:string;kind:"intent"|"dispatch_started"|"response_received"|"success"|"stopped";case_id:string;at:string;detail:Record<string,unknown>};
const policy=(config:BatchConfig)=>config.policy==="effort-comparison"
  ?{count:20,limits:[3,3,3,3,3,3,2],reservedCents:135,maxCents:2700}
  :{count:10,limits:[3,3,3,1],reservedCents:132,maxCents:1320};

// Exclusive creation plus fsync. A partial write or stale lock blocks reuse.
export function durableJson(path:string,value:unknown) {
  const fd=openSync(path,"wx");
  try {writeFileSync(fd,JSON.stringify(value,null,2)+"\n");fsyncSync(fd);}finally{closeSync(fd);}
}
function assertCurrent(config:BatchConfig,now:number) {
  if(Date.parse(config.approved_at)>now||Date.parse(config.expires_at)<=now)throw new Error("Batch approval is not current");
}
export class BatchJournal {
  private lock:number;
  private configHash:string;
  private closed=false;
  private constructor(readonly directory:string,readonly config:BatchConfig) {
    this.lock=openSync(join(directory,"execution.lock"),"wx");
    this.configHash=hash(JSON.stringify(config));
  }
  static create(directory:string,raw:BatchConfig,now=Date.now()) {
    const config=configSchema.parse(raw);assertCurrent(config,now);
    const count=policy(config).count;
    if(config.cases.length!==count||new Set(config.cases.map(c=>c.id)).size!==count||new Set(config.cases.map(c=>c.request_sha256)).size!==count||(!config.policy&&new Set(config.cases.map(c=>c.input_sha256)).size!==count))throw new Error("Duplicate or invalid approved cases");
    mkdirSync(directory); // No recursive mkdir: an existing execution is never reset.
    durableJson(join(directory,"config.json"),config);
    return new BatchJournal(directory,config);
  }
  private events() {
    if(this.closed)throw new Error("Journal is closed");
    if(hash(JSON.stringify(JSON.parse(readFileSync(join(this.directory,"config.json"),"utf8"))))!==this.configHash)throw new Error("Journal configuration changed");
    const names=readdirSync(this.directory).filter(n=>n.endsWith(".event.json")).sort();
    let previous:string|null=null;
    return names.map((name,i)=>{
      const bytes=readFileSync(join(this.directory,name));const event=JSON.parse(bytes.toString()) as Event;
      if(name!==`${String(i+1).padStart(3,"0")}.event.json`||event.sequence!==i+1||event.previous_sha256!==previous||event.config_sha256!==this.configHash)throw new Error("Journal chain is inconsistent");
      previous=hash(bytes);return event;
    });
  }
  private append(kind:Event["kind"],caseId:string,detail:Record<string,unknown>,now=Date.now()) {
    const events=this.events(),sequence=events.length+1;
    const previous=events.length?hash(readFileSync(join(this.directory,`${String(events.length).padStart(3,"0")}.event.json`))):null;
    durableJson(join(this.directory,`${String(sequence).padStart(3,"0")}.event.json`),{sequence,previous_sha256:previous,config_sha256:this.configHash,kind,case_id:caseId,at:new Date(now).toISOString(),detail});
  }
  private active(caseId:string) {
    const events=this.events();
    if(events.some(e=>e.kind==="stopped"))throw new Error("The entire batch is stopped");
    const intents=events.filter(e=>e.kind==="intent"),last=intents.at(-1);
    if(last?.case_id!==caseId||events.some(e=>e.case_id===caseId&&e.kind==="success"))throw new Error("No active attempt for this case");
    return events.filter(e=>e.case_id===caseId);
  }
  begin(caseId:string,inputHash:string,requestHash:string,now=Date.now()) {
    assertCurrent(this.config,now);
    const events=this.events(),intents=events.filter(e=>e.kind==="intent"),successes=events.filter(e=>e.kind==="success");
    if(events.some(e=>e.kind==="stopped")||intents.length!==successes.length)throw new Error("Prior outcome is unresolved or batch stopped");
    const selected=this.config.cases[intents.length];
    if(!selected||selected.id!==caseId||selected.input_sha256!==inputHash||selected.request_sha256!==requestHash)throw new Error("Case order or approved hash mismatch");
    const group=Math.floor(intents.length/3),groupAttempts=intents.filter(e=>e.detail.group===group).length;
    const {count,limits,reservedCents,maxCents}=policy(this.config);
    if(intents.length>=count||(intents.length+1)*reservedCents>maxCents||groupAttempts>=limits[group]||(groupAttempts+1)*reservedCents>limits[group]*reservedCents)throw new Error("Batch reservation cap exceeded");
    this.append("intent",caseId,{group,reserved_cents:reservedCents,input_sha256:inputHash,request_sha256:requestHash},now);
  }
  dispatch(caseId:string,requestBody:string,now=Date.now()) {
    assertCurrent(this.config,now);const events=this.active(caseId);
    if(events.some(e=>e.kind==="dispatch_started"))throw new Error("Retries are forbidden");
    if(hash(requestBody)!==this.config.cases.find(c=>c.id===caseId)?.request_sha256)throw new Error("Actual request hash mismatch");
    this.append("dispatch_started",caseId,{delivery:"unknown until response; may have been sent"},now);
  }
  response(caseId:string,status:number) {
    const events=this.active(caseId);
    if(!events.some(e=>e.kind==="dispatch_started")||events.some(e=>e.kind==="response_received"))throw new Error("Unexpected response event");
    this.append("response_received",caseId,{http_status:status});
  }
  succeed(caseId:string,cost:number,resultHash:string) {
    const events=this.active(caseId);
    if(!events.some(e=>e.kind==="response_received"&&Number(e.detail.http_status)>=200&&Number(e.detail.http_status)<300)||!Number.isFinite(cost)||cost<0||cost>policy(this.config).reservedCents/100||!digest.safeParse(resultHash).success)throw new Error("Response, cost or result evidence is incomplete");
    this.append("success",caseId,{calculated_usd:cost,result_sha256:resultHash,billing_verified:false});
  }
  stop(caseId:string,reason:string) {
    this.append("stopped",caseId,{reason});
  }
  close() {
    if(!this.closed){closeSync(this.lock);this.closed=true;unlinkSync(join(this.directory,"execution.lock"));}
  }
}

// The existing per-allowance ledger remains authoritative alongside the journal.
export function verifyAllowanceLedger(path:string,expected:{input_hash:string;cost_usd:number;execution_sha256?:string}[],reservedUsd=1.32) {
  const approval=JSON.parse(readFileSync(path,"utf8"));
  const directory=join(dirname(path),`allowance-${approval.id}`);
  if(!existsSync(directory)){if(expected.length)throw new Error("Missing allowance ledger");return;}
  const names=readdirSync(directory);
  if(names.includes("request.lock"))throw new Error("Allowance lock is unresolved");
  const reservations=names.filter(n=>n.endsWith(".reservation.json"));
  if(reservations.length!==expected.length||names.filter(n=>n.endsWith(".settlement.json")).length!==expected.length)throw new Error("Allowance count mismatch");
  const remaining=[...expected];
  for(const name of reservations){
    const reserved=JSON.parse(readFileSync(join(directory,name),"utf8"));
    const settled=JSON.parse(readFileSync(join(directory,name.replace(".reservation.json",".settlement.json")),"utf8"));
    const i=remaining.findIndex(e=>e.input_hash===reserved.input_hash&&e.cost_usd===settled.cost_usd&&(!e.execution_sha256||(e.execution_sha256===reserved.execution_sha256&&e.execution_sha256===settled.execution_sha256)));
    if(i<0||settled.status!=="settled"||settled.id!==reserved.id||settled.input_hash!==reserved.input_hash||reserved.reserved_usd!==reservedUsd||settled.reserved_usd!==reservedUsd||settled.cost_usd===null)throw new Error("Allowance outcome or cost mismatch");
    remaining.splice(i,1);
  }
}
