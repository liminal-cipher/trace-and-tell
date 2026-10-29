import { expect,it } from "vitest";
import { validateRemoteTarget } from "../scripts/remote-m1-preflight.mjs";
it("keeps the separately approved remote preflight closed by default and tied to one target",()=>{
  const env={RUN_APPROVED_REMOTE_M1:"svwzgtsjwcvncxyvdhho",SUPABASE_URL:"https://svwzgtsjwcvncxyvdhho.supabase.co",APP_ORIGIN:"http://127.0.0.1:3000",SUPABASE_PUBLISHABLE_KEY:"synthetic-config-test",SUPABASE_SERVICE_ROLE_KEY:"synthetic-config-test"};
  expect(()=>validateRemoteTarget({})).toThrow("disabled");
  expect(()=>validateRemoteTarget({...env,SUPABASE_URL:"https://another.supabase.co"})).toThrow("refuses");
  expect(()=>validateRemoteTarget({...env,APP_ORIGIN:"https://public.example.test"})).toThrow("refuses");
  expect(()=>validateRemoteTarget({...env,SUPABASE_SERVICE_ROLE_KEY:""})).toThrow("credentials");
  expect(validateRemoteTarget(env).url).toBe(env.SUPABASE_URL);
});
