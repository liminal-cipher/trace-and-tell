import { expect,it } from "vitest";
import { metaRequest,promptVersion,generateAnalysis,systemPrompt } from "@/lib/model-provider";
import { inferenceIdentity } from "@/lib/model-settings";
import { inputHash } from "@/lib/model-budget";
import type { ModelInput } from "@/lib/investigation-contracts";
const input:ModelInput={operation:"compare",sources:[{asset_id:crypto.randomUUID(),revision:1,content:"A checked tabletop"},{asset_id:crypto.randomUUID(),revision:1,content:"A table with food"}],observations:[]};
it("versions changed guidance and binds it to new input, request and execution hashes",()=>{
 const changed:ModelInput={...input,guidance:"archive-comparison-v3"};
 expect(promptVersion(input)).toBe("archive-evidence-v2");
 expect(promptVersion(changed)).toBe("archive-comparison-v3");
 expect(inputHash(changed)).not.toBe(inputHash(input));
 const before=inferenceIdentity(metaRequest(input,"muse-spark-1.3","medium"),"medium");
 const after=inferenceIdentity(metaRequest(changed,"muse-spark-1.3","medium"),"medium");
 expect(after.request_sha256).not.toBe(before.request_sha256);expect(after.execution_sha256).not.toBe(before.execution_sha256);
 expect(systemPrompt(changed)).toContain("not by themselves contradictory");
 expect(()=>metaRequest({...input,guidance:"archive-inquiry-v2"},"muse-spark-1.3")).toThrow("does not match");
});
it("keeps compatible historical replay attribution instead of relabelling old output as improved",async()=>{
 const fixture=await generateAnalysis(input,"fixture");
 const replay=await generateAnalysis(input,"replay",{replay:{...fixture,mode:"meta-live",model:"muse-spark-1.3"}});
 expect(replay.prompt_version).toBe("archive-evidence-v2");
 await expect(generateAnalysis({...input,guidance:"archive-comparison-v3"},"replay",{replay:{...fixture,mode:"meta-live"}})).rejects.toThrow("No matching");
 const inquiry:ModelInput={operation:"inquire",guidance:"archive-inquiry-v2",sources:[input.sources[0]],observations:[]};
 expect(systemPrompt(inquiry)).toContain("context missing from the photograph");
});
