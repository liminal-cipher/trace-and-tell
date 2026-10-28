import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase";
export async function GET(request: Request) {
  const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    try {
      const { error } = await (
        await userClient()
      ).auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/archive", origin));
    } catch {
      /* A failed callback must never imply a successful sign-in. */
    }
  }
  return NextResponse.redirect(new URL("/login?error=expired", origin));
}
