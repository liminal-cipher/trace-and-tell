// Build an explicit public-file allowlist in a fresh directory. No private app,
// credentials, API routes, provider code or local evidence enter this project.
import { mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const root=resolve(import.meta.dirname,".."), target=resolve(root,".local",`public-demo-${Date.now()}`);
mkdirSync(dirname(target), { recursive: true });
mkdirSync(target);
const files=["src/app/layout.tsx","src/app/globals.css","src/app/demo/page.tsx","src/app/demo/photo/page.tsx","src/components/photo-demo.tsx","src/components/conversation-guide.tsx","src/lib/record-export.ts","src/lib/photo-demo-evidence.ts","src/lib/demo-evidence.ts","postcss.config.mjs","public/demo/orbit-ticket.png","public/demo/photo-01.jpg","public/demo/photo-02.jpg","public/demo/photo-03.jpg"];
files.push("public/demo/storefront.webp");
for(const file of files){mkdirSync(dirname(join(target,file)),{recursive:true});copyFileSync(join(root,file),join(target,file));}
writeFileSync(join(target,"src/app/page.tsx"),'export { default } from "./demo/photo/page";\n');
writeFileSync(join(target,"package.json"),JSON.stringify({name:"trace-and-tell-public-demo",private:true,type:"module",dependencies:JSON.parse(readFileSync(join(root,"package.json"),"utf8")).dependencies},null,2));
writeFileSync(join(target,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",lib:["dom","dom.iterable","esnext"],skipLibCheck:true,strict:true,noEmit:true,esModuleInterop:true,module:"esnext",moduleResolution:"bundler",resolveJsonModule:true,isolatedModules:true,jsx:"react-jsx",paths:{"@/*":["./src/*"]}},include:["src/**/*.ts","src/**/*.tsx",".next/types/**/*.ts"]}));
writeFileSync(join(target,"next.config.mjs"),'export default {output:"export",trailingSlash:true,images:{unoptimized:true},env:{NEXT_PUBLIC_DEMO_ONLY:"true"}};\n');
const env={...process.env,NEXT_TELEMETRY_DISABLED:"1"};
for(const name of Object.keys(env))if(/^(SUPABASE|NEXT_PUBLIC_SUPABASE|META_|MODEL_|VERCEL|DATABASE_URL)/.test(name))delete env[name];
const result=spawnSync(process.execPath,[join(root,"node_modules/next/dist/bin/next"),"build",target,"--webpack"],{cwd:target,env,stdio:"inherit"});
if(result.status!==0)throw Error(`Public-only build failed; preserved at ${target}`);
const out=join(target,"out");
const headers=[{key:"X-Content-Type-Options",value:"nosniff"},{key:"X-Frame-Options",value:"DENY"},{key:"Referrer-Policy",value:"no-referrer"},{key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"}];
writeFileSync(join(out,"vercel.json"),JSON.stringify({version:2,cleanUrls:true,trailingSlash:true,headers:[{source:"/(.*)",headers}]},null,2));
const inventory=readdirSync(out,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const path=join(e.parentPath,e.name),bytes=readFileSync(path);return {path:relative(out,path).replaceAll("\\","/"),bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};});
writeFileSync(join(target,"build-manifest.json"),JSON.stringify({built_at:new Date().toISOString(),source_allowlist:files,output:out,files:inventory,deployed:false},null,2));
console.log(`PUBLIC_DEMO_CANDIDATE=${out}`);
