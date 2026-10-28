import Link from "next/link";
const records = [
  {
    id: "01",
    title: "A shop before opening",
    date: "Date unknown",
    text: "A constructed scene: a blue storefront, two windows and the morning light. No real place or family is represented.",
    kind: "Synthetic illustration",
    className: "shop",
  },
  {
    id: "02",
    title: "A note without a date",
    date: "Date unknown",
    text: "“The chairs were always outside before the door opened.” A fictional typed note, written only for this demonstration.",
    kind: "Synthetic text note",
    className: "note-art",
  },
  {
    id: "03",
    title: "The blue chair",
    date: "Context unrecorded",
    text: "An imagined object study. A shared colour is not evidence of a shared person, place or event.",
    kind: "Synthetic illustration",
    className: "chair",
  },
];
export default function Demo() {
  return (
    <main className="page">
      <div className="eyebrow">
        THE OPEN COLLECTION{" "}
        <span className="badge">SYNTHETIC / FIXTURE · READ ONLY</span>
      </div>
      <section className="hero">
        <div>
          <h1>
            Every record holds
            <br />
            <em>a beginning.</em>
          </h1>
          <p>
            A photograph. A few words. Something worth keeping.
            <br />
            Begin with what is here, and preserve what you know.
          </p>
        </div>
        <div className="hero-note">
          <span className="folio">No. 001</span>
          <p>
            An imagined collection
            <br />
            for exploring the archive.
          </p>
          <Link className="button" href="/archive">
            Open your private archive ↗
          </Link>
        </div>
      </section>
      <div className="section-line">
        <h2>The morning collection</h2>
        <span>3 synthetic records · No AI model used</span>
      </div>
      <div className="demo-grid">
        {records.map((r) => (
          <article className="demo-card" key={r.id}>
            <div
              className={`demo-art ${r.className}`}
              role="img"
              aria-label={`${r.kind}: ${r.title}`}
            >
              <span className="art-mark">{r.id}</span>
              {r.id === "01" ? (
                <div className="storefront">
                  <span>MORNING</span>
                  <i />
                  <i />
                </div>
              ) : r.id === "02" ? (
                <blockquote>
                  The chairs were always outside before the door opened.
                </blockquote>
              ) : (
                <div className="chair-shape" />
              )}
            </div>
            <div className="caption">
              <span className="eyebrow">
                {r.kind} · {r.id}
              </span>
              <h3>{r.title}</h3>
              <span className="muted">{r.date}</span>
              <p>{r.text}</p>
            </div>
          </article>
        ))}
      </div>
      <aside className="notice">
        <strong>A demonstration, with clear boundaries.</strong>
        <p>
          These illustrations and words were created for this project. Nothing
          here is a real family record. This collection is read only, does not
          access private workspaces and makes no model calls.
        </p>
      </aside>
    </main>
  );
}
