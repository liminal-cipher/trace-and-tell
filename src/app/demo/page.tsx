import Image from "next/image";
import { demoEvidence as evidence } from "@/lib/demo-evidence";

export const metadata = { title: "Trace & Tell — A Living Family Gallery" };

export default function Demo() {
  return (
    <main className="page demo-story" id="story">
      <div className="eyebrow">THE OPEN COLLECTION <span className="badge">SYNTHETIC · READ ONLY</span></div>
      <section className="hero">
        <div><h1>Keep the record.<br /><em>Find the question.</em></h1>
          <p>Photographs outlive the stories behind them. Trace &amp; Tell helps a family record keeper notice clues, ask someone who might remember, and preserve their answer with its sources.</p>
          <a className="button" href="#sources">Follow two records ↓</a>
        </div>
        <aside className="hero-note"><span className="folio">No. 001 / An open inquiry</span><p>A synthetic ticket and a note.<br />A possible connection.<br />Room for “I don’t know”.</p><p>No sign-in. No uploads. No live AI calls.</p></aside>
      </section>
      <nav className="story-nav" aria-label="Demo journey"><a href="#sources">01 Sources</a><a href="#observation">02 Observe</a><a href="#connection">03 Connect</a><a href="#question">04 Ask</a><a href="#testimony">05 Listen</a><a href="#gallery">06 Exhibit</a></nav>
      <aside className="notice"><strong>A real model result, within an invented collection.</strong><p>The image and note are synthetic. Labelled excerpts below come from previously recorded Meta Standard runs. The human question is separately attributed; the testimony and exhibition wording are authored demo examples. This page reads no private workspace and saves nothing.</p></aside>
      <section id="sources" aria-labelledby="sources-heading">
        <div className="section-line"><h2 id="sources-heading">01 / Begin with the originals</h2><span>Two synthetic sources · REV1</span></div>
        <div className="story-grid">
          <article className="demo-card" id="source-photo">
            <a href="/demo/orbit-ticket.png" aria-label="Open original synthetic ticket image"><Image className="story-image" src="/demo/orbit-ticket.png" alt="Synthetic dark teal ticket: ORBIT 47 above a line, ADMIT ONE and BLUE TICKET below it. A pale border surrounds the card." width={640} height={480} unoptimized priority /></a>
            <div className="caption"><span className="eyebrow">Source A · Synthetic image · REV1</span><h3>A ticket without a story</h3><p>Made for testing. No real event, person or family is represented. The original image is available above.</p></div>
          </article>
          <article className="demo-card" id="source-note"><div className="story-note" aria-label="Original synthetic note"><span className="eyebrow">A typed fragment</span><pre>{evidence.note}</pre><span>Date and context unknown</span></div><div className="caption"><span className="eyebrow">Source B · Synthetic text · REV1</span><h3>A note with familiar words</h3><p>These are the complete original words. Similar wording gives us something to ask about; it does not establish a shared event.</p></div></article>
        </div>
      </section>
      <section id="observation" aria-labelledby="observation-heading">
        <div className="section-line"><h2 id="observation-heading">02 / Notice, then review</h2><span>Observation ≠ established history</span></div>
        <article className="evidence-card"><p className="eyebrow">Recorded Meta output · muse-spark-1.3 · Standard · M2-A</p><blockquote>{evidence.observation}</blockquote><a href="#source-photo">Inspect Source A · REV1 ↑</a><p>The image observation was recorded in a separate run using the same synthetic image. The comparison below did not use this observation as an input.</p>
          <details id="correction-history"><summary>Review the original uncertainty and correction</summary><div className="story-history"><p><strong>Original model uncertainty · REV1</strong></p><blockquote>{evidence.originalUncertainty}</blockquote><p><strong>Human correction · REV3</strong></p><blockquote>{evidence.correctedUncertainty}</blockquote><p>The unsupported explanation is preserved for review. REV2 was an earlier wording correction; REV3 corrected the uncertainty. These are excerpts from the separate M2-A review history, not new edits made on this page.</p></div></details>
        </article>
      </section>
      <section id="connection" aria-labelledby="connection-heading">
        <div className="section-line"><h2 id="connection-heading">03 / A connection worth questioning</h2><span>Hypothesis · Candidate</span></div>
        <article className="evidence-card"><p className="eyebrow">Recorded Meta output · muse-spark-1.3 · Standard · M2-B</p><blockquote>{evidence.connection}</blockquote>
          <div className="story-grid"><div><h3 className="story-subtitle">Supporting clues</h3><p>{evidence.supports[0]}</p><a href="#source-photo">Source A · REV1 ↑</a><p>{evidence.supports[1]}</p><a href="#source-note">Source B · REV1 ↑</a></div><div><h3 className="story-subtitle">Still unknown</h3><p>{evidence.unknown}</p><p>No contrary evidence was returned. Absence of a contradiction is not confirmation.</p></div></div>
          <details><summary>What was actually returned?</summary><div className="story-history"><p>One candidate connection, evidence from both source revisions, no observations and an empty question list. These displayed statements are recorded output excerpts; source identifiers are replaced by public aliases A and B.</p><p>The person selected the hypothesis for inquiry (hypothesis REV1 → REV2). Its wording remained unchanged. Selection is not proof.</p></div></details>
        </article>
      </section>
      <section id="question" aria-labelledby="question-heading">
        <div className="section-line"><h2 id="question-heading">04 / A person asks the next question</h2><span>Human-authored · No model attribution</span></div>
        <article className="question-card"><p><strong>The model returned no questions.</strong> Its response was structurally valid, but did not meet our question-generation goal. A record keeper wrote this question instead.</p><blockquote>{evidence.question}</blockquote><p>Human-authored question · original wording REV1; selected REV2. No model generated this question. In the private app, the signed-in recorder is retained; their identity is omitted here.</p><div className="actions"><a href="#connection">Parent hypothesis · REV2 ↑</a><a href="#sources">Both sources · REV1 ↑</a></div><p className="muted">This is a read-only walkthrough of the saved workflow. Writing and saving are available in an authenticated private workspace.</p></article>
      </section>
      <section id="testimony" aria-labelledby="testimony-heading">
        <div className="section-line"><h2 id="testimony-heading">05 / Keep the answer, including doubt</h2><span>Synthetic testimony · Authored demo example</span></div>
        <article className="evidence-card"><p className="eyebrow">Invented speaker · Demo testimony T1 · REV1</p><blockquote>{evidence.testimony}</blockquote><p>Written for this public demonstration, not spoken by a real person or generated by Meta. This illustrative wording is not the verbatim remote acceptance testimony. A real testimony remains an attributed account, not independently verified history.</p><a href="#question">Question behind this answer ↑</a></article>
      </section>
      <section id="gallery" aria-labelledby="gallery-heading">
        <div className="section-line"><h2 id="gallery-heading">06 / A living gallery, with its sources intact</h2><span>Exhibit · Authored demo example</span></div>
        <article className="story-exhibit"><div><span className="eyebrow">THE OPEN COLLECTION / 001</span><h3>Two records.<br /><em>One open question.</em></h3><p>ORBIT 47 and BLUE TICKET appear in both records. Their relationship remains unknown. Our invented speaker cannot confirm where they came from.</p><p className="muted">Curated demo wording. This exhibit preserves uncertainty rather than completing a family story.</p></div><div className="story-trail"><h3 className="story-subtitle">Follow the evidence</h3><a href="#testimony">Synthetic testimony T1 · REV1 ↑</a><a href="#question">Human question · selected REV2 ↑</a><a href="#connection">Meta hypothesis · selected REV2 ↑</a><a href="#source-photo">Original image · REV1 ↑</a><a href="#source-note">Original note · REV1 ↑</a><a href="#correction-history">Separate observation correction history ↑</a></div></article>
        <aside className="notice"><strong>The record can change. Its history should not disappear.</strong><p>In the private workflow, corrections mark dependent material for review and unavailable sources invalidate it. This public page is a curated static illustration, not a live revision viewer. “No supported connection”, “I don’t know” and declining to answer are valid outcomes.</p><p>Recorded model evidence is limited to synthetic cases. General accuracy and real two-user security isolation remain unverified. No real family material is shown.</p><a href="#story">Return to the beginning ↑</a></aside>
      </section>
    </main>
  );
}
