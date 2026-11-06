import type { Metadata } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono, Newsreader } from "next/font/google";

import { SCRIPT_TEMA_INICIAL } from "@/lib/tema-store";

import "./globals.css";

// Texto de interfaz y cifras de tabla: grotesca de proporciones amplias y números tabulares.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Solo para el título de cada vista y la cifra de cumplimiento: es la única voz con serifa.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "MRP · Planificación de Suministro de Asfaltos",
  description:
    "Seguimiento de demanda de asfaltos y emulsiones por vendedor y cliente: pronóstico mensual, real + avance, cumplimiento con semáforo, importación de Excel y exportación a PDF.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `suppressHydrationWarning`: el script de abajo ajusta `<html>` (clase
    // `dark`) antes de que React hidrate, así que la diferencia es intencional.
    <html
      lang="es"
      className={`${hanken.variable} ${newsreader.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
