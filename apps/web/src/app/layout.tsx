import type { Metadata } from "next";
import { Archivo, Doto } from "next/font/google";
import "./globals.css";

// Archivo with its width axis: UI at normal width, product names stamped wide.
const ui = Archivo({ variable: "--font-ui", subsets: ["latin", "latin-ext"], axes: ["wdth"] });
// Dot-matrix face, used only for readouts on the LCD.
const lcd = Doto({ variable: "--font-lcd", subsets: ["latin", "latin-ext"], weight: "variable" });

export const metadata: Metadata = {
  title: "Voice Agent Playground",
  description: "Bir görevi tanımla, ses modellerini seç, konuşarak test et.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${ui.variable} ${lcd.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
