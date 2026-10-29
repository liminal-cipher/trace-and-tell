import { z } from "zod";
import { requireUser } from "@/lib/supabase";
import { failure } from "@/lib/errors";
import { readInvestigationEntry } from "@/lib/investigation";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { client } = await requireUser();
    const params = new URL(request.url).searchParams;
    const workspace=z.uuid().parse(params.get("workspace"));
    const id=z.uuid().parse(params.get("id"));
    const revision=z.coerce.number().int().positive().parse(params.get("revision"));
    return Response.json(await readInvestigationEntry(client,workspace,id,revision),{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) { return failure(error); }
}
