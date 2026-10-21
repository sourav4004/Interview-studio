import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Interview Simulator | Campus Placements & Internships",
  description:
    "Realistic, configurable AI interview practice platform for college students preparing for internships and campus placements.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-50 text-[#171827] antialiased">
        {children}
      </body>
    </html>
  );
}
