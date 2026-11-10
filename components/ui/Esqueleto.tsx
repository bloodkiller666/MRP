import { cn } from "@/lib/utils";

/** Bloque gris pulsante: marca el lugar de lo que todavía se está cargando. */
export function Bloque({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-surface-3", className)} />;
}

/**
 * Esqueleto de la vista de seguimiento mientras se leen los datos guardados del navegador.
 * Evita mostrar un instante los datos de ejemplo y que de pronto cambien por los reales.
 */
export function EsqueletoSeguimiento() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Cargando datos guardados…</span>
      <Bloque className="h-24 w-full rounded-xl" />
      <div className="flex flex-wrap gap-2">
        <Bloque className="h-10 w-full max-w-sm" />
        <Bloque className="h-10 w-32" />
        <Bloque className="h-10 w-32" />
        <Bloque className="h-10 w-32" />
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <Bloque className="h-11 rounded-none" />
        <div className="flex flex-col gap-px p-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Bloque key={i} className="mb-2 h-9" />
          ))}
        </div>
      </div>
    </div>
  );
}
