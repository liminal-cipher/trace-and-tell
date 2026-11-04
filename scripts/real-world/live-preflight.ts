import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { hash, parseManifest, prepareCases } from "./core";
import { initialBatch } from "./batch";

export const APPROVED_HEAD="3651b371b02724ae917ad97d15dc4332264ada33";
export const PROPOSAL_SHA="1472be3f36d1c47fd4133ef0e455e627004a2607560fe7ac88a66be6f441c078";
export const PACKET="evaluation-results/real-world-2026-11-03T12-14-45.296Z-b6218c2d-2f29-43da-b60f-134857e39e73";
export const RUN_ROOT=".local/real-photo-batch-2026-11-04";
const read=(path:string)=>JSON.parse(readFileSync(path,"utf8"));
export async function verifyFixedBatch() {
  if(execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()!==APPROVED_HEAD)throw new Error("Approved Git baseline changed");
  const unchanged=["src/lib/model-provider.ts","src/lib/model-budget.ts","src/lib/model-image.ts","src/lib/investigation-contracts.ts","src/lib/investigation-domain.ts","scripts/real-world/core.ts","scripts/real-world/batch.ts","tests/fixtures/real-world/manifest.json","tests/fixtures/real-world/rights-review.json","package-lock.json"];
  if(execFileSync("git",["diff","HEAD","--",...unchanged],{encoding:"utf8"}).trim())throw new Error("Approved model or input code changed");
  const proposalBytes=readFileSync(join(PACKET,"batch-proposal.json"));
  if(hash(proposalBytes)!==PROPOSAL_SHA)throw new Error("Fixed proposal bytes changed");
  const proposal=JSON.parse(proposalBytes.toString()) as ReturnType<typeof initialBatch>;
  const manifest=parseManifest(read(join(PACKET,"manifest.json"))),rights=read(join(PACKET,"rights-review.json"));
  if(JSON.stringify(manifest)!==JSON.stringify(parseManifest(read("tests/fixtures/real-world/manifest.json")))||JSON.stringify(rights)!==JSON.stringify(read("tests/fixtures/real-world/rights-review.json")))throw new Error("Manifest or rights assessment changed");
  const prepared=await prepareCases(manifest,resolve(".local/real-world-v1"));
  const regenerated=initialBatch(manifest,prepared.photos,prepared.cases,rights);
  if(JSON.stringify(proposal)!==JSON.stringify(regenerated))throw new Error("Input/profile/MIME/rights/limits differ from the approved proposal");
  const savedInputs=read(join(PACKET,"inputs.json")) as {case_id:string;input_sha256:string;input:unknown}[];
  const selected=proposal.requests.map(request=>{
    const current=prepared.cases.find(c=>c.id===request.case_id)!,saved=savedInputs.find(c=>c.case_id===request.case_id);
    if(!saved||JSON.stringify(current.input)!==JSON.stringify(saved.input)||saved.input_sha256!==request.input_sha256)throw new Error("Exact saved ModelInput bytes changed");
    return current;
  });
  const baseline=read(join(RUN_ROOT,"protected-before.json")) as {path:string;sha256:string}[];
  for(const file of baseline)if(hash(readFileSync(file.path))!==file.sha256)throw new Error("Previously retained evidence changed");
  const reference=read(join(RUN_ROOT,"frozen-reference.json"));
  if(reference.proposal_sha256!==PROPOSAL_SHA||reference.human_status!=="PENDING")throw new Error("Frozen reference is not bound to this proposal");
  return {proposal,selected,prepared,manifest,rights,reference,protected_files:baseline.length,
    frozen_reference_sha256:hash(readFileSync(join(RUN_ROOT,"frozen-reference.json"))),
    original_expiry:proposal.expires_at,expired:Date.parse(proposal.expires_at)<=Date.now()};
}
