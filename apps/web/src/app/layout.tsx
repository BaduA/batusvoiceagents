import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Typography from LiveKit's Agent Starter (MIT): Public Sans for UI, Commit Mono for labels and numbers.
const sans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin", "latin-ext"] });
const mono = localFont({
  variable: "--font-commit-mono",
  display: "swap",
  src: [
    { path: "../fonts/CommitMono-400-Regular.otf", weight: "400", style: "normal" },
    { path: "../fonts/CommitMono-700-Regular.otf", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Voice Agent Playground",
  description: "Bir agent tanımla, modelleri seç, konuşarak test et.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${sans.variable} ${mono.variable} h-full scroll-smooth font-sans antialiased`}>
      <body className="flex min-h-full flex-col overflow-x-hidden">{children}</body>
    </html>
  );
}
