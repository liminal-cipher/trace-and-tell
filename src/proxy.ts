import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions, failure } from "@/lib/errors";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  try {
    const client = createServerClient(url, key, {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items, headers) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
        },
      },
    });
    await client.auth.getUser();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return failure(error);
  }
}
export const config = { matcher: ["/archive/:path*", "/investigation/:path*", "/api/archive/:path*", "/api/investigation/:path*"] };
