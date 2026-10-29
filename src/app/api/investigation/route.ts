import { z } from "zod";
import { requireUser } from "@/lib/supabase";
import { checkOrigin, failure, readJson } from "@/lib/errors";
import { investigationCommandSchema } from "@/lib/investigation-contracts";
import { executeInvestigation, readInvestigation } from "@/lib/investigation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
    try {
        const { client } = await requireUser();
        const id = z.uuid().parse(new URL(request.url).searchParams.get("workspace"));
        return Response.json(await readInvestigation(client, id), { headers });
    }
    catch (error) {
        return failure(error);
    }
}
export async function POST(request: Request) {
    try {
        checkOrigin(request);
        const { client, user } = await requireUser();
        const command = investigationCommandSchema.parse(await readJson(request));
        return Response.json(await executeInvestigation(client, user.id, command), { headers });
    }
    catch (error) {
        return failure(error);
    }
}
