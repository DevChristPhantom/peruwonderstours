import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { colors } from "@pwt/ui/tokens";

import "./globals.css";

const geist = localFont({ src: "../../../../packages/ui/src/fonts/geist-latin-wght-normal.woff2", variable: "--font-geist", weight: "100 900", display: "swap" });
const geistMono = localFont({ src: "../../../../packages/ui/src/fonts/geist-mono-latin-wght-normal.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Panel · Peru Wonders Tours", template: "%s · Panel PWT" },
  description: "Panel de administración interno de Peru Wonders Tours.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "strict-origin-when-cross-origin",
  formatDetection: { telephone: false, email: false, address: false },
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
    <html lang="es-PE" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh">
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
