import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase";
import { appOrigin, failure } from "@/lib/errors";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function GET(request: Request) {
  let origin: string;
  try {
    origin = appOrigin();
  } catch (error) {
    return failure(error);
  }
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    try {
      const { error } = await (
        await userClient()
      ).auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(new URL("/archive", origin), { status: 303, headers });
    } catch {
      /* A failed callback must never imply a successful sign-in. */
    }
  }
  return NextResponse.redirect(new URL("/login?error=expired", origin), { status: 303, headers });
}
