import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
const PROJECT="svwzgtsjwcvncxyvdhho";
/** @param {Record<string,string|undefined>} env */
export function validateRemoteTarget(env) {
  if(env.RUN_APPROVED_REMOTE_M1!==PROJECT)throw new Error("Remote preflight is disabled. Set the explicit approved project gate.");
  if(env.SUPABASE_URL!==`https://${PROJECT}.supabase.co`||env.APP_ORIGIN!=="http://127.0.0.1:3000")throw new Error("Remote preflight refuses this project or app origin.");
  if(!env.SUPABASE_PUBLISHABLE_KEY||!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error("Configure server credentials through the ignored environment file.");
  return {url:env.SUPABASE_URL,key:env.SUPABASE_SERVICE_ROLE_KEY};
}
async function main() {
  if(existsSync(".env.local"))process.loadEnvFile(".env.local");
  const {url,key}=validateRemoteTarget(process.env);
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const [tables,buckets]=await Promise.all([
    Promise.all(["workspaces","assets","asset_revisions","upload_intents","command_receipts"].map(async(table)=>{
      const result=await client.from(table).select("*",{head:true,count:"exact"});
      if(result.error)throw new Error("An approved app table could not be inspected.");
      if(result.count!==0)throw new Error("Existing app data detected. Stop and review scope before any tests.");
      return {table,empty:true};
    })),client.storage.listBuckets(),
  ]);
  if(buckets.error||buckets.data.length!==2||buckets.data.some((b)=>!["archive-staging","archive-originals"].includes(b.id)||b.public))throw new Error("Unexpected bucket configuration. Stop and review.");
  console.log(JSON.stringify({project:PROJECT,read_only:true,tables,private_buckets_verified:2,writes:0,auth_email_journey:"not run",storage_upload:"not run"},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch((error)=>{
  // Never print SDK error bodies, URLs containing credentials, or environment values.
  console.error(error instanceof Error&&error.message.startsWith("Remote preflight")?error.message:"Remote preflight blocked or failed. Check the approved target and secure local configuration.");process.exitCode=1;
});
