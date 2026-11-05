import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: "Family archive | Trace & Tell",
  description:
    "Keep family photos, questions and the words of the people who remember them.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="masthead">
          <Link className="wordmark" href="/">
            Trace <span>&</span> Tell
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/demo/photo">Explore the demo</Link>
            {process.env.NEXT_PUBLIC_DEMO_ONLY !== "true" && <Link href="/archive" prefetch={false}>
              Private archive <span aria-hidden="true">↗</span>
            </Link>}
          </nav>
        </header>
        {children}
        <footer className="footer">
          <span>TRACE & TELL</span>
          <span>A Living Family Gallery</span>
        </footer>
      </body>
    </html>
  );
}
