import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { AppError } from "./errors";
export function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new AppError(
      503,
      "Archive is not configured yet. The synthetic demo is available.",
    );
  return { url, key };
}
export function configured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
export async function userClient() {
  const { url, key } = config();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items)
          jar.set(name, value, options);
      },
    },
  });
}
export async function requireUser() {
  const client = await userClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous)
    throw new AppError(401, "Your session has expired. Sign in to continue.");
  return { client, user: data.user };
}
// Only called after a verified user and an ownership check. The server-only
// command function independently rechecks ownership inside its transaction.
export function storageAdmin() {
  const { url } = config();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new AppError(503, "Private storage is not configured yet.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
