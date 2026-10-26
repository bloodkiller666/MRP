"use client";

import { ChevronDown, Database } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface OpcionMenu {
  etiqueta: string;
  detalle?: string;
  icono: ReactNode;
  alElegir: () => void;
  deshabilitada?: boolean;
  peligro?: boolean;
  /** Dibuja una línea separadora antes de esta opción. */
  separador?: boolean;
}

/**
 * Menú desplegable «Datos» de la barra superior: importar, exportar, reporte y
 * mantenimiento. Usa `<details>` nativo y se cierra al elegir o al hacer clic fuera.
 */
export function MenuDatos({ opciones }: { opciones: OpcionMenu[] }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const alClicFuera = (evento: MouseEvent) => {
      const detalle = ref.current;
      if (detalle?.open && !detalle.contains(evento.target as Node)) detalle.open = false;
    };
    const alEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && ref.current) ref.current.open = false;
    };

    document.addEventListener("mousedown", alClicFuera);
    document.addEventListener("keydown", alEscape);
    return () => {
      document.removeEventListener("mousedown", alClicFuera);
      document.removeEventListener("keydown", alEscape);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-[5px] border border-chrome-line px-3 text-sm font-medium text-chrome-ink transition-colors hover:bg-chrome-2 [&::-webkit-details-marker]:hidden">
        <Database className="size-4 text-chrome-ink-2" />
        <span className="hidden sm:inline">Datos</span>
        <ChevronDown className="size-3.5 text-chrome-ink-2" />
      </summary>

      <div className="absolute right-0 z-40 mt-1.5 w-72 rounded-md border border-line-strong bg-surface py-1.5 text-ink shadow-xl">
        {opciones.map((opcion) => (
          <div key={opcion.etiqueta}>
            {opcion.separador ? <div className="my-1.5 border-t border-line" /> : null}
            <button
              type="button"
              disabled={opcion.deshabilitada}
              onClick={() => {
                if (ref.current) ref.current.open = false;
                opcion.alElegir();
              }}
              className={cn(
                "flex w-full items-start gap-3 px-3.5 py-2 text-left transition-colors hover:bg-surface-2",
                "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent",
                opcion.peligro && "text-bad",
              )}
            >
              <span className={cn("mt-0.5 shrink-0", opcion.peligro ? "text-bad" : "text-ink-2")}>
                {opcion.icono}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{opcion.etiqueta}</span>
                {opcion.detalle ? <span className="block text-[11px] text-ink-3">{opcion.detalle}</span> : null}
              </span>
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}
