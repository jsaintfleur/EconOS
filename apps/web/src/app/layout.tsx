import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteNav } from "@/components/layout/SiteNav";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

/**
 * Every page in EconOS is statically generated from committed data
 * snapshots — there is no request-time data access (docs/architecture.md).
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  metadataBase: new URL("https://econos.vercel.app"),
  title: {
    default: "EconOS — Economic Intelligence Platform",
    template: "%s · EconOS",
  },
  description:
    "EconOS connects macroeconomic forces — inflation, interest rates, employment, housing — to the real-world outcomes experienced by households, workers, businesses, and regions.",
  openGraph: {
    title: "EconOS — Economic Intelligence Platform",
    description:
      "From macroeconomic conditions to household outcomes: transparent data, backtested forecasts, and honest uncertainty.",
    type: "website",
    siteName: "EconOS",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow-lg"
        >
          Skip to main content
        </a>
        <SiteNav />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
