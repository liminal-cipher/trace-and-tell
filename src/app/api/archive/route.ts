import { z } from "zod";
import { requireUser } from "@/lib/supabase";
import { checkOrigin, failure, readJson } from "@/lib/errors";
import { commandSchema } from "@/lib/contracts";
import { executeCommand, listArchive } from "@/lib/archive";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    const { client } = await requireUser();
    const value = new URL(request.url).searchParams.get("workspace");
    const id = value ? z.uuid().parse(value) : undefined;
    return Response.json(await listArchive(client, id), { headers });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { client, user } = await requireUser();
    const command = commandSchema.parse(await readJson(request));
    return Response.json(await executeCommand(client, user.id, command), {
      headers,
    });
  } catch (error) {
    return failure(error);
  }
}
