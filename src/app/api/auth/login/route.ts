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
    if (error?.code === "over_email_send_rate_limit")
      throw new AppError(
        429,
        "The email sending limit has been reached. Stop resending and wait for the limit to reset before requesting one new link.",
      );
    if (error?.status === 429)
      throw new AppError(
        429,
        "Too many sign-in requests. Please wait before requesting another link.",
      );
    if (error)
      throw new AppError(
        503,
        "The sign-in email could not be sent. Please try again later.",
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
