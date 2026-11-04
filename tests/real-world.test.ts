import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { parseManifest, prepareCases, verifiedBytes, sourceId, hash, summarise, validateReview, outputFields, type Review, type RecordedCase } from "../scripts/real-world/core";
import { reviewTemplate, reviewHtml, toCsv } from "../scripts/real-world/report";
import { initialBatch, batchProposal } from "../scripts/real-world/batch";
import type { Analysis, ModelInput } from "@/lib/investigation-contracts";
import { prepareModelImage, MODEL_IMAGE_BYTE_LIMIT } from "@/lib/model-image";
import { randomBytes } from "node:crypto";

const raw = JSON.parse(readFileSync("tests/fixtures/real-world/manifest.json","utf8"));
const manifest = () => parseManifest(structuredClone(raw));
let directory: string | undefined;
afterEach(() => { vi.unstubAllGlobals(); if (directory) { rmSync(directory,{recursive:true,force:true}); directory=undefined; } });
const input: ModelInput = { operation:"observe",sources:[{asset_id:sourceId("rw-01"),revision:1,content:"SEOUL"}],observations:[] };
const output: Analysis = {observations:[{asset_id:input.sources[0].asset_id,revision:1,claim:"SEOUL is printed.",locator:"Central sign",uncertainty:"Capture date is unknown."}],connection:null,questions:[]};
const caseFor = (id="one",i=input) => ({id,input:i,input_sha256:hash(JSON.stringify(i)),fact_ids:["one-f1"]});
function review(o=output,i=input): Review {
  return {kind:"human",reviewer:"test fixture reviewer",reviewed_at:"2026-11-03",input_sha256:hash(JSON.stringify(i)),output_sha256:hash(JSON.stringify(o)),original_and_model_input_compared:true,all_assertions_split_and_reviewed:true,
    claims:Object.entries(outputFields(o)).map(([field,quote])=>({field,quote,verdict:"grounded",issue:"none",severity:0,evidence:"Visible in the test source",rationale:"Controlled unit fixture, not real-photo evidence"})),
    omissions:[{fact_id:"one-f1",verdict:"present",rationale:"Visible"}],questions:[],uncertainty:"appropriate",connection:"not_applicable"};
}
const record = (overrides:Partial<RecordedCase>={}): RecordedCase => ({case_id:"one",input_sha256:caseFor().input_sha256,mode:"meta-live",transport:"success",output,...overrides});

it("declares a distinct licensed sample, all twelve pairs and unknowns before inference", () => {
  const m=manifest(); expect(m.photos).toHaveLength(23); expect(m.pairs).toHaveLength(12);
  expect(new Set(m.pairs.map(p=>p.category))).toEqual(new Set(["related","unrelated","contradictory-control"]));
  expect(()=>parseManifest({...m,photos:[...m.photos.slice(0,-1),m.photos[0]]})).toThrow("Duplicate");
  expect(()=>parseManifest({...m,pairs:[{...m.pairs[0],photo_ids:["missing","rw-01"]},...m.pairs.slice(1)]})).toThrow("Pair");
});
it("rejects altered source bytes and paths outside the dataset", () => {
  directory=mkdtempSync(join(tmpdir(),"trace-real-test-"));
  const bytes=Buffer.from("source");writeFileSync(join(directory,"a.jpg"),bytes);
  const p={...manifest().photos[0],file:"a.jpg",sha256:hash(bytes),bytes:bytes.length};
  expect(verifiedBytes(directory,p)).toEqual(bytes);
  expect(()=>verifiedBytes(directory!,{...p,sha256:"0".repeat(64)})).toThrow("changed");
  expect(()=>verifiedBytes(directory!,{...p,file:join(process.cwd(),"package.json")})).toThrow("escapes");
});
it("prepares the exact app image recipe offline, hides reference answers, and reports blocked cases", async () => {
  directory=mkdtempSync(join(tmpdir(),"trace-real-test-"));
  const fetcher=vi.fn(()=>{throw new Error("Unexpected network");});vi.stubGlobal("fetch",fetcher);
  const m=manifest();
  for (let n=0;n<m.photos.length;n++) {
    const p=m.photos[n]; const bytes=await sharp({create:{width:4,height:3,channels:3,background:{r:n*8,g:40,b:80}}}).jpeg().toBuffer();
    writeFileSync(join(directory,p.file),bytes);Object.assign(p,{sha256:hash(bytes),bytes:bytes.length,width:4,height:3});
    writeFileSync(join(directory,`${p.id}.metadata.json`),"{}");p.metadata_sha256=hash("{}");
  }
  m.photos[0].rights_status="needs_review";
  const prepared=await prepareCases(m,directory);
  expect(prepared.cases).toHaveLength(35); expect(prepared.cases[0].blockers).toContain("rights_review");
  expect(prepared.cases[1].request_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(prepared.cases[0].input)).not.toContain(m.photos[0].facts[0].text);
  expect(JSON.stringify(prepared.cases[0].input)).not.toContain(m.photos[0].title);
  expect(fetcher).not.toHaveBeenCalled();
  const html=reviewHtml(m,directory,prepared.cases,[]);
  expect(html).toContain("Content-Security-Policy");expect(html).not.toContain("<script");
  expect(html).toContain("0 live calls");expect(html).toContain("AUTHORED FALSE CONTROL");
  const imported=reviewHtml(m,directory,prepared.cases,[{...record(),case_id:prepared.cases[0].id,input_sha256:prepared.cases[0].input_sha256,review:{...review(),kind:"assistant"}}]);
  expect(imported).toContain("Pending human review of recorded live attempts: observe-rw-01</p>");
  expect(imported).toContain("Not run live: observe-rw-02");
  expect(imported).not.toContain("paid execution still blocked");
  const rights=JSON.parse(readFileSync("tests/fixtures/real-world/rights-review.json","utf8"));
  expect(()=>initialBatch(m,prepared.photos,prepared.cases,rights)).toThrow("not eligible");
  expect(batchProposal(m,prepared.photos,prepared.cases,rights)).toMatchObject({max_requests:0,requests:[],allowances:[],approved_at:null});
  m.photos[0].rights_status="cleared";
  const eligible=await prepareCases(m,directory);
  const batch=initialBatch(m,eligible.photos,eligible.cases,rights);
  expect(batch.requests).toHaveLength(10);expect(batch.allowances.map(a=>a.max_requests)).toEqual([3,3,3,1]);
  expect(batch.allowances.reduce((sum,a)=>sum+a.max_usd,0)).toBeCloseTo(13.2);expect(batch.approved_at).toBeNull();
  expect(batch.requests.filter(r=>r.operation==="compare")).toHaveLength(4);
  eligible.photos[0].decoded_pixels_equal=false;
  expect(()=>initialBatch(m,eligible.photos,eligible.cases,rights)).toThrow("lossless check");
  eligible.photos[0].decoded_pixels_equal=true;eligible.cases[0].request_sha256="f".repeat(64);
  expect(()=>initialBatch(m,eligible.photos,eligible.cases,rights)).toThrow("request changed");
});
it("exports reviewer content as data without CSV formula execution",()=>{
  expect(toCsv([["=HYPERLINK(\"x\")","@value","quoted \"text\"","line\nbreak"]])).toBe('"\'=HYPERLINK(""x"")","\'@value","quoted ""text""","line\nbreak"\r\n');
});
it("preserves the synthetic baseline and reports oversized photographic detail without quantisation", async () => {
  const original=readFileSync("tests/fixtures/model/inputs/01.png");
  const converted=await prepareModelImage(original);
  expect(await sharp(converted.bytes).raw().toBuffer()).toEqual(await sharp(original).raw().toBuffer());
  const noisy=await sharp(randomBytes(1024*1024*3),{raw:{width:1024,height:1024,channels:3}}).png().toBuffer();
  const prepared=await prepareModelImage(noisy);
  expect(prepared.bytes.length).toBeLessThan(MODEL_IMAGE_BYTE_LIMIT);
  const metadata=await sharp(prepared.bytes).metadata();expect(metadata.width).toBe(1024);expect(metadata.exif).toBeUndefined();
});
it("never turns unrun, fixture or replay cases into live accuracy", () => {
  const empty=summarise([caseFor()],[]);expect(empty.rates.grounded_claims).toEqual({numerator:0,denominator:0});expect(empty.cases[0].status).toBe("not_run");
  const fixture=summarise([caseFor()],[record({mode:"fixture"})]);expect(fixture.attempted_live).toBe(0);expect(fixture.not_run).toBe(1);
  expect(summarise([caseFor()],[record({mode:"replay"})]).attempted_live).toBe(0);
});
it("counts transport failure, wrong citations and semantic review separately", () => {
  const bad=structuredClone(output);bad.observations[0].asset_id=sourceId("foreign");
  const result=summarise([caseFor("one"),caseFor("two"),caseFor("three")],[record({transport:"failure",output:undefined}),record({case_id:"two",output:bad}),record({case_id:"three"})]);
  expect(result.rates.transport).toEqual({numerator:2,denominator:3});expect(result.rates.schema).toEqual({numerator:1,denominator:2});expect(result.structural_failures).toEqual(["two"]);expect(result.human_reviewed).toBe(0);
});
it("requires bound hashes, complete field, omission and question coverage", () => {
  expect(()=>validateReview({...review(),input_sha256:"0".repeat(64)},output,caseFor().input_sha256,["one-f1"])).toThrow("different");
  expect(()=>validateReview({...review(),claims:review().claims.slice(1)},output,caseFor().input_sha256,["one-f1"])).toThrow("Unreviewed");
  expect(()=>validateReview({...review(),omissions:[]},output,caseFor().input_sha256,["one-f1"])).toThrow("omission");
  expect(()=>validateReview({...review(),questions:[{index:0,verdict:"useful",rationale:"invented"}]},output,caseFor().input_sha256,["one-f1"])).toThrow("question");
  expect(()=>validateReview({...review(),claims:[{...review().claims[0],quote:"unrecorded"}]},output,caseFor().input_sha256,["one-f1"])).toThrow("quotes");
});
it("preserves serious and minor failures with claim and fact denominators", () => {
  const r=review();r.claims[0]={...r.claims[0],verdict:"unsupported",issue:"invented_date",severity:3};r.omissions[0].verdict="omitted";
  const result=summarise([caseFor()],[record({review:r})]);expect(result.severe_cases).toEqual(["one"]);expect(result.unsupported_claims).toBe(1);expect(result.rates.grounded_claims).toEqual({numerator:2,denominator:3});expect(result.rates.omissions).toEqual({numerator:1,denominator:1});
});
it("excludes assistant review from human quality rates and rejects duplicate or stale records", () => {
  expect(summarise([caseFor()],[record({review:{...review(),kind:"assistant"}})]).human_reviewed).toBe(0);
  expect(()=>summarise([caseFor()],[record(),record()])).toThrow("Duplicate");
  expect(()=>summarise([caseFor()],[record({input_sha256:"f".repeat(64)})])).toThrow("mismatched");
  expect(()=>summarise([caseFor()],[{...record(),mode:"imaginary"} as unknown as RecordedCase])).toThrow();
});
it("keeps schema-valid empty comparison questions visible as a product shortfall", () => {
  const i:ModelInput={...input,operation:"compare",sources:[...input.sources,{asset_id:sourceId("other"),revision:1,content:"OTHER"}]};
  const o:Analysis={observations:[],connection:{outcome:"no_connection",statement:"No specific common referent.",supports:[],contradicts:[],unknowns:["Relationship unknown."]},questions:[]};
  const r=review(o,i);r.connection="appropriate_no_connection";
  const result=summarise([caseFor("one",i)],[record({input_sha256:hash(JSON.stringify(i)),output:o,review:r})]);
  expect(result.schema_valid).toBe(1);expect(result.empty_question_comparisons).toBe(1);expect(result.rates.useful_questions).toEqual({numerator:0,denominator:0});
});
it("never treats a blank review template as completed acceptance", () => {
  expect(()=>validateReview(reviewTemplate(caseFor().input_sha256,output) as unknown as Review,output,caseFor().input_sha256,["one-f1"])).toThrow();
});
