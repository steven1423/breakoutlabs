import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";

/** BreakoutLabs' own typeface (breakoutlab.co sets Assistant for body and headings). One family, three weights. */
const assistant = Assistant({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-assistant",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "BreakoutOS", template: "%s - BreakoutOS" },
  description: "The internal operating system that closes the 90-day retest loop.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={assistant.variable}>
      <body>{children}</body>
    </html>
  );
}
