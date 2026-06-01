import type { Metadata } from "next";
import { barlow, inter } from "@/lib/fonts";
import "./globals.css";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `${site.name} — Finn leads og selg nettsider`,
  description: site.description,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb" className={`${barlow.variable} ${inter.variable}`}>
      <body className="bg-brand-navyDark text-white antialiased">{children}</body>
    </html>
  );
}
