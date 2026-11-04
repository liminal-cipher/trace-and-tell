"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { photoStories, photoEvaluation, photoTextStudy } from "@/lib/photo-demo-evidence";
import { ConversationGuide, DownloadNotes } from "./conversation-guide";
import { exhibitNotes } from "@/lib/record-export";

export function PhotoDemo() {
  const [selected, setSelected] = useState(0);
  return <main className="page photo-demo">
    <div className="eyebrow">THE OPEN COLLECTION <span className="badge">INTERACTIVE SAMPLE · NOTHING UPLOADED</span></div>
    <div className="photo-intro"><h1>A photograph.<br/><em>A conversation to keep.</em></h1><p>For the person keeping the family’s photos: choose one detail, take a question into a conversation, and keep the person’s words beside their source.</p></div>
    <div className="photo-choice" aria-label="Choose a sample photograph">{photoStories.map((story, i) => <button key={story.id} className={i === selected ? "" : "secondary"} aria-pressed={i === selected} onClick={() => setSelected(i)}>{story.label}</button>)}</div>
    <PhotoJourney key={photoStories[selected].id} story={photoStories[selected]}/>
    <section id="photo-text-study" className="photo-step" aria-labelledby="text-clue-heading">
      <div className="section-line"><h2 id="text-clue-heading">Text in a photograph can be a clue, too.</h2><span>Separate recorded evaluation · read only</span></div>
      <div className="photo-text-study">
        <figure><a href={photoTextStudy.image} target="_blank" rel="noopener noreferrer" aria-label="Open the evaluated storefront image (new tab)"><Image src={photoTextStudy.image} alt="Historical storefront photograph with stevensons in yellow lettering above the display windows." width={330} height={489} unoptimized/></a>
          <figcaption>Flip Schulke / U.S. National Archives, NAID 558126 · Public domain.<br/><a href={photoTextStudy.sourceUrl} target="_blank" rel="noopener noreferrer">Source and rights statement ↗</a><br/>330 × 489 evaluation edition. Lossless web copy; metadata removed.</figcaption>
        </figure>
        <div><p className="eyebrow">Recorded Meta observation · Standard · Medium</p><blockquote>{photoTextStudy.observation}</blockquote><p><strong>Assistant visual check:</strong> the store name matches the visible lettering. A readable name can guide a question about a place; it does not establish who visited or when.</p>
          <details><summary>Inspect the error in the same response</summary><blockquote>{photoTextStudy.overclaim}</blockquote><p>The small window figures do not establish that they are mannequins wearing dresses. This overclaim remains unresolved. The model’s caveat about reflections did not remove it.</p></details>
          <p className="muted">One selected example from the earlier 30-request text-heavy evaluation, separate from the three-photo pilot below. Human quality review is pending. This is not a transcription accuracy score; no new model request runs here.</p>
        </div>
      </div>
    </section>
    <section className="notice photo-limits" aria-labelledby="limits-heading"><h2 id="limits-heading">What this demonstration proves — and what it does not</h2>
      <p>These are licensed historical photographs, not AI-generated family pictures. The observations and questions are excerpts from recorded Meta Standard Medium requests. The practice answer is fictional; it is never attributed to the photographed people.</p>
      <p>{photoEvaluation.scope}</p><p>{photoEvaluation.limitations}</p>
      <details><summary>What needed improvement?</summary><p>{photoEvaluation.improvement}</p><p>Earlier results are retained, including errors and unhelpful questions. The same small set was reused to inspect a prompt revision; this is not an independent accuracy benchmark.</p></details>
      <p>This page uses local sample state only. Refreshing clears your edits. You may explicitly download a text copy; nothing is uploaded or saved by the service. It does not read private collections or call a model. The authenticated app has a separately tested save, revision and source-review workflow.</p>
      <div className="actions"><Link href="/demo">Read the synthetic comparison and correction study</Link>{process.env.NEXT_PUBLIC_DEMO_ONLY !== "true" && <Link href="/archive" prefetch={false}>Open your private archive</Link>}</div>
    </section>
  </main>;
}
function PhotoJourney({ story }: { story: typeof photoStories[number] }) {
  const [step, setStep] = useState(0);
  const [originalQuestion, setOriginalQuestion] = useState<string>(story.questions[0]);
  const [question, setQuestion] = useState<string>(story.questions[0]);
  const [answer, setAnswer] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [exhibit, setExhibit] = useState<{ question:string; answer:string; unknown:boolean }>();
  const journey = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!step) return;
    const heading = journey.current?.querySelector<HTMLElement>(`#${["", "question", "answer", "exhibit"][step]}-heading`);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start" });
  }, [step]);
  const edited = question !== originalQuestion;
  const changed = exhibit && (exhibit.question !== question || exhibit.answer !== answer || exhibit.unknown !== unknown);
  return <div className="photo-journey" ref={journey}>
    <section className="photo-workbench" aria-labelledby="photo-heading">
      <figure id="photo-original"><a href={story.image} target="_blank" rel="noopener noreferrer" aria-label="Open the displayed photograph at full size (new tab)"><Image src={story.image} alt={story.alt} width={story.width} height={story.height} className="story-image" unoptimized priority/></a>
        <figcaption><strong>{story.label}</strong> · Historical photograph · Source edition 1<br/>{story.credit}<br/><a href={story.sourceUrl} target="_blank" rel="noopener noreferrer">View the source and archival description ↗</a> · <a href={story.rightsUrl} target="_blank" rel="noopener noreferrer">Public-domain rights statement ↗</a><br/>{story.edition}</figcaption>
      </figure>
      <div className="photo-clue"><p className="eyebrow">01 / LOOK CLOSELY</p><h2 id="photo-heading">Start with something you can point to.</h2>
        <p>Meta suggests a clue. Check the photograph before using it.</p>
        <div className="recorded-clue"><p className="eyebrow">Recorded Meta observation · Standard · Medium</p><blockquote>{story.observation}</blockquote><p className="muted">Where: {story.locator}</p><p><strong>Still uncertain:</strong> {story.uncertainty}</p></div>
        <p className="muted">A name, family relationship or date is not established by this clue. Choosing it for inquiry does not make it a fact.</p>
        <button onClick={() => setStep(Math.max(step, 1))} disabled={step > 0}>Use this clue for a question</button>
        <p className="muted">The recorded question is loaded from this sample; clicking makes no AI request.</p>
      </div>
    </section>
    {step > 0 && <section className="photo-step" aria-labelledby="question-heading">
      <div className="section-line"><h2 id="question-heading" tabIndex={-1}>02 / Ask for the story the photo cannot tell</h2><span>Recorded suggestions · your choice</span></div>
      <fieldset className="question-options"><legend>Choose a recorded Meta question</legend>{story.questions.map((text) => <label key={text} className="source-choice"><input type="radio" name={"question-"+story.id} checked={originalQuestion === text} onChange={() => { setOriginalQuestion(text); setQuestion(text); }}/>{text}</label>)}</fieldset>
      <label htmlFor="sample-question">Your question</label><textarea id="sample-question" className="photo-question-edit" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={2}/>
      <p className="authorship">{edited ? "Human-edited sample question. The edited wording was not generated by Meta." : "Recorded Meta question. A person still needs to decide whether it is useful."}</p>
      {edited && <details><summary>Keep the original question in view</summary><blockquote>{originalQuestion}</blockquote></details>}
      <button disabled={!question.trim()} onClick={() => setStep(Math.max(step, 2))}>{step > 1 ? "Keep this question" : "Choose this question"}</button>
    </section>}
    {step > 1 && <section className="photo-step" aria-labelledby="answer-heading">
      <div className="section-line"><h2 id="answer-heading" tabIndex={-1}>03 / Let the person supply the memory</h2><span>Fictional practice · no historical testimony</span></div>
      <ConversationGuide question={question} origin={edited ? "Human-edited sample question" : "Recorded Meta question · Standard · Medium"} sources={[{ title: `${story.label} — ${story.credit}`, revision: 1 }]} sample/>
      <p>In your collection, you would ask someone who might remember. Here, try an invented answer or leave the memory unknown. Please use fictional wording only.</p>
      <div className="actions"><button className="secondary" onClick={() => { setUnknown(false); setAnswer(story.practiceAnswers[story.questions.findIndex(text => text === originalQuestion)]); }}>Use an invented practice answer</button><button className="secondary" onClick={() => { setUnknown(true); setAnswer(""); }}>They do not remember</button></div>
      <p className="muted">The example is prewritten for the selected suggestion. If you changed the question, check that the answer still fits.</p>
      <label htmlFor="sample-answer">Fictional practice answer</label><textarea id="sample-answer" value={answer} onChange={event => { setAnswer(event.target.value); setUnknown(false); }} disabled={unknown} placeholder="Write a fictional answer for this practice…" maxLength={4000} rows={3}/>
      {unknown && <p role="status">Does not remember. No answer will be invented to fill the gap.</p>}
      <button disabled={!question.trim() || (!unknown && !answer.trim())} onClick={() => { setExhibit({ question, answer, unknown }); setStep(3); }}>{exhibit ? "Update sample exhibit" : "Create sample exhibit"}</button>
    </section>}
    {exhibit && <section className="photo-step" aria-labelledby="exhibit-heading">
      <div className="section-line"><h2 id="exhibit-heading" tabIndex={-1}>04 / Keep the photograph and the words together</h2><span>Local sample exhibit · nothing saved</span></div>
      {changed && <p role="status" className="notice">Needs review: your question or answer changed. The exhibit below keeps its previous wording until you update it.</p>}
      <article className="photo-exhibit"><Image src={story.image} alt={story.alt} width={story.width} height={story.height} className="story-image" unoptimized/><div><p className="eyebrow">A LIVING GALLERY / PRACTICE</p><h3>{story.exhibitTitle}</h3><p className="muted">The question: {exhibit.question}</p><blockquote>{exhibit.unknown ? "Does not remember." : exhibit.answer}</blockquote><p className="authorship">Fictional practice speaker · {exhibit.unknown ? "memory unknown" : "invented answer"} · not a statement by the people in the photograph</p>
        <a href="#photo-original">Return to the photograph and source ↑</a><details><summary>Follow the evidence</summary><p>Historical photograph → recorded Meta clue → selected or edited question → fictional practice answer → sample exhibit.</p><p>Observations are suggestions. An answer is attributed testimony, not automatically verified history. In the private app, each link keeps the exact source and parent revision.</p></details>
        <DownloadNotes filename="trace-and-tell-exhibit.txt" disabled={!!changed} text={() => exhibitNotes({ sample: true, title: story.exhibitTitle, question: exhibit.question, text: `Fictional practice speaker: ${exhibit.unknown ? "Does not remember." : exhibit.answer}`, sources: [{ title: `${story.label} — ${story.credit}`, revision: 1 }], validity: changed ? "needs_review" : "current" })}>Download exhibit text</DownloadNotes>
        {changed && <p className="muted">Update the exhibit before downloading its text.</p>}</div></article>
    </section>}
    <p className="photo-status" role="status">{step === 0 ? "Choose a clue to begin." : step === 1 ? "A clue is selected. Review or edit a question." : step === 2 ? "A question is ready. Try a fictional response." : "Sample exhibit created locally. Refresh clears this practice."}</p>
  </div>;
}
