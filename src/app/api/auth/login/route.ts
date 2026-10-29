import { z } from "zod";
import { userClient } from "@/lib/supabase";
import { AppError, appOrigin, checkOrigin, failure, readJson } from "@/lib/errors";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { email } = z
      .object({ email: z.email().max(254) })
      .parse(await readJson(request, 2048));
    const client = await userClient();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${appOrigin()}/auth/callback` },
    });
    if (error)
      throw new AppError(
        429,
        "The sign-in email could not be sent. Wait a moment and try again.",
      );
    return Response.json(
      {
        message:
          "Check your email for a sign-in link. Open it in this browser.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
