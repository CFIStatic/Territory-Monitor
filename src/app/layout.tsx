import type { Metadata } from "next";
import { Manrope, Syne } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Territory Monitor — Storm-timed restoration outreach",
  description:
    "Upload contacts, set outreach rules, and automatically email the right people before a storm hits their city.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} ${syne.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
