import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import { colors } from "@pwt/ui/tokens";

import { AppProviders } from "@/components/providers/AppProviders";
import { SITE } from "@/lib/site";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} · Tours y paquetes en el sur del Perú`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.defaultDescription,
  applicationName: SITE.name,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.ogLocale,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: colors.light.background },
    { media: "(prefers-color-scheme: dark)", color: colors.dark.background },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-PE" className={`${geist.variable} ${geistMono.variable} ${fraunces.variable}`}>
      <body>
        <a href="#contenido" className="pwt-skip-link">
          Saltar al contenido
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
