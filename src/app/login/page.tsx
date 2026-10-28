import { Suspense } from "react";
import { Login } from "@/components/login";
import { configured } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export default function LoginPage() {
  return (
    <main className="page narrow">
      <span className="eyebrow">YOUR PRIVATE COLLECTION</span>
      <h1>
        A place for
        <br />
        <em>your records.</em>
      </h1>
      <p>
        Sign in with an email link to keep your archive private and return to it
        later.
      </p>
      <Suspense>
        <Login configured={configured()} />
      </Suspense>
    </main>
  );
}
