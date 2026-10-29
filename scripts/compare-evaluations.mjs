import { readFileSync,readdirSync,writeFileSync } from "node:fs";
import { resolve,join,sep } from "node:path";
import { randomUUID } from "node:crypto";
const root=resolve("evaluation-results");
function read(directory) {
  const target=resolve(directory??"");
  if(!target.startsWith(root+sep))throw new Error("Choose an immutable run directory inside evaluation-results.");
  return readdirSync(target).filter((name)=>name.endsWith(".json")&&name!=="summary.json"&&!name.endsWith(".plan.json")).map((name)=>JSON.parse(readFileSync(join(target,name),"utf8")));
}
const [baselinePath,candidatePath]=process.argv.slice(2);
const baseline=read(baselinePath),candidate=read(candidatePath);
const pairs=baseline.map((a)=>({a,b:candidate.find((b)=>b.case_id===a.case_id)}));
if(!pairs.length||pairs.length!==candidate.length||pairs.some(({a,b})=>!b||a.input_sha256!==b.input_sha256||a.mode!==b.mode||a.split!==b.split||a.run?.model!==b.run?.model))throw new Error("Comparison requires identical cases, inputs, split, provider and model.");
const changedVersions=new Set(pairs.flatMap(({a,b})=>[...(a.prompt_version!==b.prompt_version?["prompt"]:[]),...(a.schema_version!==b.schema_version?["schema"]:[])]));
if(changedVersions.size>1)throw new Error("Change one versioned variable per comparison.");
const summary={baseline:baselinePath,candidate:candidatePath,sample_size:pairs.length,changed_variable:[...changedVersions],
  schema_valid:{baseline:baseline.filter((r)=>r.validation==="passed").length,candidate:candidate.filter((r)=>r.validation==="passed").length},
  semantic_quality:"Not assessed automatically. Complete a separate attributed human review for each run; fixtures are not model-quality evidence.",
  cases:pairs.map(({a,b})=>({id:a.case_id,baseline_validation:a.validation,candidate_validation:b.validation,human_review_required:true}))};
const path=join(root,`comparison-${randomUUID()}.json`);writeFileSync(path,JSON.stringify(summary,null,2),{flag:"wx"});
console.log(`Comparison saved to ${path}; ${pairs.length} paired cases. No semantic accuracy claim.`);
