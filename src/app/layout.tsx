import type { Metadata } from "next";
import Script from "next/script";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { barlow, inter } from "@/lib/fonts";
import "./globals.css";
import { site } from "@/lib/site";

/** Aktiver glass-tema på /app før første paint (unngår hvit flash og rå layout) */
const APP_GLASS_THEME_BOOT = `(function(){var p=location.pathname;if(p!=='/app'&&p.indexOf('/app/')!==0)return;document.documentElement.classList.add('app-glass-theme');document.body.classList.add('app-glass-theme');document.documentElement.style.backgroundColor='#1e3a5f';document.body.style.color='#f8fafc';})();`;

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
      <body className="bg-white text-brand-navy antialiased">
        <Script
          id="nylead-app-glass-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: APP_GLASS_THEME_BOOT }}
        />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
