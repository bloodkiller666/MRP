import { MRPApp } from "@/components/MRPApp";

/**
 * Página principal del MRP.
 *
 * Es un Server Component mínimo: toda la interactividad (estado, filtros,
 * edición en celda, import/export) vive dentro del Client Component `MRPApp`.
 */
export default function Home() {
  return <MRPApp />;
}
