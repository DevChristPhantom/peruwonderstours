import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { colors } from "@pwt/ui/tokens";

import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin", "latin-ext"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

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
