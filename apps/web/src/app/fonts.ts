import localFont from "next/font/local";

const geist = localFont({
  src: "../../../../packages/ui/src/fonts/geist-latin-wght-normal.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "../../../../packages/ui/src/fonts/geist-mono-latin-wght-normal.woff2",
  variable: "--font-geist-mono",
  preload: false,
  weight: "100 900",
  display: "swap",
});

const fraunces = localFont({
  src: "../../../../packages/ui/src/fonts/fraunces-latin-full-normal.woff2",
  variable: "--font-fraunces",
  weight: "100 900",
  display: "swap",
});

/** Clases de las variables de fuente para `<html>` (layout por idioma y 404 global). */
export const fontVariables = `${geist.variable} ${geistMono.variable} ${fraunces.variable}`;
