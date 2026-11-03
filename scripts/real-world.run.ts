import { test, vi } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { parseManifest, prepareCases, recordsSchema, summarise, hash } from "./real-world/core";
import { reviewHtml, reviewTemplate, toCsv } from "./real-world/report";
import { batchProposal } from "./real-world/batch";

test("prepares an offline real-world review packet without authorising calls", async () => {
  // Even a configured shell cannot turn this command into a live runner.
  vi.stubGlobal("fetch", () => { throw new Error("This evaluator is offline"); });
  try {
    const raw = readFileSync("tests/fixtures/real-world/manifest.json", "utf8");
    const manifest = parseManifest(JSON.parse(raw));
    const root = resolve(process.env.REAL_WORLD_DATA_DIR ?? ".local/real-world-v1");
    const prepared = await prepareCases(manifest, root);
    const cases = prepared.cases.map(c => ({ ...c, fact_ids: c.input.sources.flatMap(s => {
      const id = prepared.cases.find(o => o.id.startsWith("observe-") && o.input.sources[0].asset_id === s.asset_id)?.id.slice(8);
      return manifest.photos.find(p => p.id === id)?.facts.map(f => f.id) ?? [];
    }) }));
    const records = process.env.REAL_WORLD_RECORDS ? recordsSchema.parse(JSON.parse(readFileSync(process.env.REAL_WORLD_RECORDS,"utf8"))) : [];
    const summary = summarise(cases, records);
    const rights=JSON.parse(readFileSync("tests/fixtures/real-world/rights-review.json","utf8"));
    if(rights.photos.length!==manifest.photos.length||manifest.photos.some(p=>{
      const r=rights.photos.find((r:{id:string;external_ai:string})=>r.id===p.id);
      return !r||(p.rights_status==="cleared")!==(r.external_ai==="permitted_standard_inference");
    }))throw new Error("Rights assessment does not match this manifest");
    const directory = join("evaluation-results", `real-world-${new Date().toISOString().replaceAll(":","-")}-${randomUUID()}`);
    mkdirSync(directory, {recursive:true});
    const save = (name:string,value:unknown) => writeFileSync(join(directory,name), JSON.stringify(value,null,2)+"\n",{flag:"wx"});
    save("manifest.json",manifest);
    save("rights-review.json",rights);
    const batch=batchProposal(manifest,prepared.photos,cases,rights);
    save("batch-proposal.json",batch);
    writeFileSync(join(directory,"batch-proposal.sha256"),hash(JSON.stringify(batch,null,2)+"\n")+"\n",{flag:"wx"});
    save("plan.json", { status:"BLOCKED — no paid approval", live_calls:0, dataset_sha256:hash(raw), prompt_version:prepared.prompt_version, prompt_sha256:prepared.prompt_sha256, schema_version:prepared.schema_version,
      model:"muse-spark-1.3", route:"Standard", retries:0, max_completion_tokens:1200,
      approved_at:null, expires_at:batch.expires_at,
      catalogue_and_prices:"See batch-proposal.json for dated public verification; no paid approval",
      existing_guard:{max_requests:20,max_usd:5,reservation_per_call_usd:1.32},
      proposed_batches:batch.allowances,
      source_ids:"Deterministic evaluation-only IDs. No Supabase sources were created. Changing IDs, observations, bytes or order requires new hashes and approval.",
      photos:prepared.photos, cases:cases.map(({input,...rest})=>({...rest,source_revisions:input.sources.map(({asset_id,revision})=>({asset_id,revision}))})) });
    save("inputs.json",cases.map(c=>({case_id:c.id,input_sha256:c.input_sha256,input:c.input})));
    save("records.json",records);
    save("summary.json",summary);
    writeFileSync(join(directory,"photos.csv"),toCsv([["id","source_mime","source_bytes","source_width","source_height","source_sha256","prepared_mime","prepared_bytes","width","height","prepared_sha256","profile","decoded_pixels_equal","rights","human_visual","error"],...prepared.photos.map(p=>[p.id,p.preparation?.source.mime,p.preparation?.source.bytes,p.preparation?.source.width,p.preparation?.source.height,p.file_sha256,p.preparation?.prepared.mime,p.prepared_bytes,p.preparation?.prepared.width,p.preparation?.prepared.height,p.prepared_sha256,p.preparation?.profile.version,p.decoded_pixels_equal,manifest.photos.find(x=>x.id===p.id)?.rights_status,p.human_visual_review,p.error?.category])]),{flag:"wx"});
    writeFileSync(join(directory,"cases.csv"),toCsv([["case_id","input_sha256","request_sha256","provider_valid","blockers","model_semantics"],...cases.map(c=>[c.id,c.input_sha256,c.request_sha256,c.provider_valid,c.blockers.join(";"),summary.cases.find(x=>x.id===c.id)?.status??"NOT RUN"])]),{flag:"wx"});
    writeFileSync(join(directory,"reviews.csv"),toCsv([["case_id","provider_mode","reviewer_kind","field","quote","verdict","issue","severity","evidence","rationale"],...records.flatMap(r=>r.review?.claims.map(c=>[r.case_id,r.mode,r.review!.kind,c.field,c.quote,c.verdict,c.issue,c.severity,c.evidence,c.rationale])??[])]),{flag:"wx"});
    save("review-template.json",reviewTemplate(cases[0].input_sha256));
    writeFileSync(join(directory,"review.html"),reviewHtml(manifest,root,cases,records,prepared.photos),{flag:"wx"});
    console.log(JSON.stringify({directory,photos:manifest.photos.length,pairs:manifest.pairs.length,planned:cases.length,preflight_blocked:cases.filter(c=>c.blockers.length).map(c=>c.id),live_calls:0,human_reviewed:summary.human_reviewed}));
  } finally { vi.unstubAllGlobals(); }
});
