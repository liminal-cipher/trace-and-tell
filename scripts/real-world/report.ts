import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Manifest, type RecordedCase, type PhotoCheck, outputFields, hash } from "./core";
import type { Analysis } from "../../src/lib/investigation-contracts";

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]!);
export function reviewHtml(m: Pick<Manifest, "photos" | "pairs">, root: string, cases: {id:string;input:{sources:{image?:string}[]};input_sha256:string;blockers:string[]}[], records: RecordedCase[], checks:PhotoCheck[]=[]) {
  const photos = m.photos.map(p => {
    const c = cases.find(c => c.id === `observe-${p.id}`)!;
    const check=checks.find(v=>v.id===p.id);
    const original = `data:image/jpeg;base64,${readFileSync(resolve(root,p.file)).toString("base64")}`;
    return `<article id="${escape(p.id)}"><h2>${escape(p.id)} · ${escape(p.title)}</h2><p>${escape(p.tags.join(" / "))}</p>
      <label for="zoom-${p.id}">Show actual pixel size (scroll inside each image)</label> <input id="zoom-${p.id}" type="checkbox">
      <div class="images"><figure><img src="${original}" alt="${escape(p.id)} downloaded source edition"><figcaption>Downloaded source edition · ${p.width} × ${p.height}</figcaption></figure>
      <figure>${c.input.sources[0].image ? `<img src="${c.input.sources[0].image}" alt="${escape(p.id)} sanitised model input">` : "<p>Preparation failed; no substitute image.</p>"}<figcaption>Exact sanitised model input · orientation, sRGB, lossless PNG; max 2048px</figcaption></figure></div>
      <p><a href="${escape(p.page_url)}">Source and original-resolution download</a> · ${escape(p.author)} · <a href="${escape(p.license_url)}">${escape(p.license)}</a></p>
      <p>${escape(p.rights_note)} ${escape(p.edition)}</p><p>File SHA-256: <code>${p.sha256}</code></p>
      <p>Prepared SHA-256: <code>${escape(check?.prepared_sha256??"See plan.json")}</code></p>
      <p>Rights for Standard inference: ${escape(p.rights_status)}. Public redistribution: check the separate attribution/licence assessment; this worksheet does not authorise publication.</p>
      <p>Decoded pixels equal after orientation/sRGB: ${escape(check?.decoded_pixels_equal??"NOT CHECKED")}. Human visual review: PENDING. Semantic model evaluation: ${records.some(r=>r.case_id===c.id&&r.mode==="meta-live")?"see response below":"NOT RUN"}.</p>
      <details><summary>Input dimensions, conversion and safety checks</summary><pre>${escape(JSON.stringify(check?.preparation??check?.error??null,null,2))}</pre></details>
      <h3>Provisional reference facts — confirm before scoring</h3><ul>${p.facts.map(f=>`<li>${escape(f.id)}: ${escape(f.text)} (${escape(f.locator)})</li>`).join("")}</ul>
      <p>Unconfirmed interpretations: ${escape(p.interpretations?.join(" ")??"None annotated")}</p>
      <p>Illegible / requires source comparison: ${escape(p.illegible?.join(" ")??"Not yet annotated")}</p>
      <p>Source uncertainty: ${escape(p.source_uncertainties?.join(" ")??"Not yet annotated")}</p>
      <p>Unknown: ${escape(p.unknowns.join(" "))}</p><p>Preflight: ${escape(c.blockers.join("; ") || "structurally ready; this worksheet does not authorise paid calls")}</p></article>`;
  }).join("");
  const pairs = m.pairs.map(p => `<article><h2>${escape(p.id)} · ${escape(p.category)}</h2><p>${p.photo_ids.map(id=>`<a href="#${id}">${id}</a>`).join(" + ")}</p>${p.text_control ? `<pre>${p.category === "contradictory-control" ? "AUTHORED FALSE CONTROL" : "AUTHORED CONTROL"} — NOT A HISTORICAL RECORD\n${escape(p.text_control)}</pre>`:""}<p>${escape(p.expectation)}</p></article>`).join("");
  const results = cases.map(c=>{
    const r=records.find(r=>r.case_id===c.id);
    return `<article><h2>${escape(c.id)} · ${r?escape(`${r.mode} / ${r.transport}`):"NOT RUN"}</h2><p>Review: ${r?.review?escape(r.review.kind+" completed; verify original evidence"):"PENDING"}</p><h3>Unedited model output</h3><pre>${escape(JSON.stringify(r?.output ?? null,null,2))}</pre><h3>Separate reviewer judgement</h3><pre>${escape(JSON.stringify(r?.review ?? {status:"pending"},null,2))}</pre></article>`;
  }).join("");
  const reviewStatus = `<section><h2>Review queue</h2><p>Human completed: ${escape(records.filter(r=>r.mode==="meta-live"&&r.review?.kind==="human").map(r=>r.case_id).join(", ")||"none")}</p><p>Assistant only: ${escape(records.filter(r=>r.review?.kind==="assistant").map(r=>r.case_id).join(", ")||"none")}</p><p>Pending human review of recorded live attempts: ${escape(records.filter(r=>r.mode==="meta-live"&&r.review?.kind!=="human").map(r=>r.case_id).join(", ")||"none")}</p><p>Not run live: ${escape(cases.filter(c=>!records.some(r=>r.case_id===c.id&&r.mode==="meta-live")).map(c=>c.id).join(", ")||"none")}</p></section>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Trace & Tell — original comparison worksheet</title><style>body{font:18px/1.55 system-ui;background:#faf8f0;color:#202521;max-width:1200px;margin:auto;padding:24px}article{border-top:1px solid #777;padding:24px 0}.images{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;overflow:auto}input:checked + .images img{max-width:none;max-height:none}img{max-width:100%;max-height:700px;object-fit:contain}pre,code{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#075e45}a:focus{outline:3px solid #a42} @media(max-width:700px){.images{grid-template-columns:1fr}}</style><h1>Original comparison worksheet</h1><p>Offline, no scripts, 0 live calls made by this tool. These are real-photograph candidates, not measured model successes. Reference facts are assistant-provisional. A human must compare both editions, split every response into atomic assertions and record their evidence. Do not infer history from filenames.</p><p>Inspect at full size. Mark illegible characters as uncertain. Score all cases, including failures. Record severity 0 none / 1 minor / 2 materially misleading / 3 invented identity, kinship or history. Review questions and omissions separately. Empty questions on observe are required; empty questions on compare are a product shortfall.</p><p>Exports: <a href="photos.csv" download>Photo preparation CSV</a> · <a href="cases.csv" download>Case status CSV</a> · <a href="records.json" download>Original results JSON</a> · <a href="summary.json" download>Review summary JSON</a> · <a href="rights-review.json" download>Rights assessment</a> · <a href="reviews.csv" download>Claim judgements CSV</a></p>${reviewStatus}${photos}<h1>Predeclared comparisons</h1>${pairs}<h1>Recorded responses</h1>${results || "<p>None: 0 live calls. Semantic accuracy is not measured.</p>"}</html>`;
}

export function reviewTemplate(inputHash: string, output?: Analysis) {
  return { status: "pending — template is deliberately not a valid completed review", kind: "human", reviewer: "", reviewed_at: "", input_sha256: inputHash, output_sha256: output ? hash(JSON.stringify(output)) : null,
    original_and_model_input_compared: false, all_assertions_split_and_reviewed: false,
    claims: output ? Object.entries(outputFields(output)).map(([field,quote]) => ({ field,quote,verdict:null,issue:null,severity:null,evidence:"",rationale:"" })) : [],
    omissions: [], questions: [], uncertainty: null, connection: null };
}

// Escape CSV formulas as well as quotes; future reviewer text is untrusted.
export function toCsv(rows:unknown[][]) {
  return rows.map(row=>row.map(value=>{
    let text=String(value??"");
    if(/^[=+@\-\t\r]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  }).join(",")).join("\r\n")+"\r\n";
}
