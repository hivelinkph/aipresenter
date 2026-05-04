import type { Metadata } from "next";
import { Montserrat, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

// Display face for the marketing landing — distinctive variable geometric.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "600", "700", "800"],
});

// Mono for control-panel eyebrows + numerals.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Presenter — AI demo driver",
  description: "Live-narrated demo walkthroughs for any website.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${bricolage.variable} ${jetbrains.variable} dark`}
    >
      <body>{children}</body>
    </html>
  );
}
