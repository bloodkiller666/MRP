import type { Metadata } from "next";

import { CostosApp } from "@/components/costos/CostosApp";

export const metadata: Metadata = {
  title: "Costos PLUS · Planificación de suministro",
  description:
    "Resumen de costos de asfaltos grado A, B y C: recetas, precios de materias primas con historial y comparación de variantes.",
};

/** Sección «Costos PLUS»: independiente del MRP (ruta y datos propios). */
export default function CostosPage() {
  return <CostosApp />;
}
