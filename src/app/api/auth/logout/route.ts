import { userClient } from "@/lib/supabase";
import { AppError, checkOrigin, failure } from "@/lib/errors";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { error } = await (await userClient()).auth.signOut();
    if (error) throw new AppError(503, "Sign-out failed. Try again.");
    return Response.json(
      { ok: true },
      {
        headers: { "Cache-Control": "no-store", "Clear-Site-Data": '"cache"' },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
