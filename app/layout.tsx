import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SCRIPT_TEMA_INICIAL } from "@/lib/tema-store";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MRP · Proyección de Insumos Asfálticos",
  description:
    "Gestión, proyección y reportes de requerimientos de materiales (MRP): importación de Excel, edición en línea, exportación a PDF y totales por mes, grupo línea y refinería.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `suppressHydrationWarning`: el script de abajo ajusta `<html>` (clase
    // `dark`) antes de que React hidrate, así que la diferencia es intencional.
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
