import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: "Trace & Tell — Archive",
  description:
    "A quiet place for records and the context that belongs with them.",
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
            <Link href="/demo">Explore the demo</Link>
            <Link href="/archive" prefetch={false}>
              Private archive <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </header>
        {children}
        <footer className="footer">
          <span>TRACE & TELL</span>
          <span>Keep the record. Leave room for the unknown.</span>
          <span>A Living Family Gallery</span>
        </footer>
      </body>
    </html>
  );
}
