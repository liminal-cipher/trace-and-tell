import Link from "next/link";
import { Investigation } from "@/components/investigation";
export const dynamic = "force-dynamic";
export default async function InvestigationPage({ searchParams }: {
    searchParams: Promise<{
        workspace?: string;
    }>;
}) {
    const { workspace } = await searchParams;
    return <main className="page investigation-page">
    <div className="eyebrow">PRIVATE RESEARCH ROOM</div>
    <section className="hero compact"><div><h1>Follow the <em>evidence.</em></h1><p>Look closely. Leave room for another answer.</p></div><Link href="/archive">Back to Archive</Link></section>
    {workspace ? <Investigation key={workspace} workspace={workspace}/> : <section className="notice"><h2>Choose a collection first.</h2><Link href="/archive">Open your archive</Link></section>}
  </main>;
}
