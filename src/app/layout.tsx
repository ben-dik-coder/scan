import type { Metadata } from "next";
import Script from "next/script";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { barlow, inter } from "@/lib/fonts";
import "./globals.css";
import { site } from "@/lib/site";

/** Aktiver glass-tema på /app før første paint (unngår hvit flash og rå layout) */
const APP_GLASS_THEME_BOOT = `(function(){var p=location.pathname;if(p!=='/app'&&p.indexOf('/app/')!==0)return;document.documentElement.classList.add('app-glass-theme');document.body.classList.add('app-glass-theme');document.documentElement.style.backgroundColor='#234a73';document.body.style.color='#f8fafc';})();`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  applicationName: site.name,
  title: {
    default: `${site.name} — Finn nye firma med kontaktinfo`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  keywords: site.keywords,
  authors: [{ name: "NyLead" }],
  creator: "NyLead",
  publisher: "NyLead",
  category: "B2B sales software",
  alternates: {
    canonical: "/",
    languages: {
      "nb-NO": "/",
    },
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "nb_NO",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — Finn nye firma med kontaktinfo`,
    description: site.description,
    images: [
      {
        url: site.ogImage,
        width: 1991,
        height: 790,
        alt: "NyLead viser nye firma, kontaktinfo, nettside-sjekk og arbeidskø.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — Finn nye firma med kontaktinfo`,
    description: site.description,
    images: [site.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
