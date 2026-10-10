import { Fraunces, Geist, Geist_Mono } from "next/font/google";

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

/** Clases de las variables de fuente para `<html>` (layout por idioma y 404 global). */
export const fontVariables = `${geist.variable} ${geistMono.variable} ${fraunces.variable}`;
