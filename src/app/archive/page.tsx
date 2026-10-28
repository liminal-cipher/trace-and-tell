import Link from "next/link";
import { Archive } from "@/components/archive";
import { configured } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export default function ArchivePage() {
  return (
    <main className="page">
      <div className="eyebrow">PRIVATE WORKSPACE</div>
      <section className="hero compact">
        <div>
          <h1>
            Your <em>archive.</em>
          </h1>
          <p>
            Keep the original. Record the context. Return when you are ready.
          </p>
        </div>
        <span className="folio">PERSISTENT ARCHIVE</span>
      </section>
      {configured() ? (
        <Archive />
      ) : (
        <section className="notice">
          <h2>The private archive is not configured yet.</h2>
          <p>
            Authentication and storage must be connected before records can be
            saved. Nothing has been saved in this browser.
          </p>
          <Link className="button" href="/demo">
            Explore the synthetic demo
          </Link>
        </section>
      )}
    </main>
  );
}
