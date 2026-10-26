"use client";

import { ChevronDown, Columns3, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";

import { GRUPOS_COLUMNAS } from "@/lib/constants";
import { etiquetaCampo } from "@/lib/mrp-utils";
import type { ColumnaTabla } from "@/lib/types";

interface PropsColumnas {
  /** Columnas de datos actualmente ocultas. */
  ocultas: ColumnaTabla[];
  alAlternar: (columna: ColumnaTabla) => void;
  alMostrarTodas: () => void;
}

/**
 * Selector de visibilidad de columnas.
 *
 * Usa `<details>` nativo y cierra el panel al hacer clic fuera. Ocultar una
 * columna es **solo visual**: los totales y el cumplimiento siguen calculándose
 * con todos los datos.
 */
export function ColumnasSelector({ ocultas, alAlternar, alMostrarTodas }: PropsColumnas) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const alClicFuera = (evento: MouseEvent) => {
      const detalle = ref.current;
      if (!detalle?.open) return;
      if (!detalle.contains(evento.target as Node)) detalle.open = false;
    };

    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, []);

  const hayOcultas = ocultas.length > 0;

  return (
    <details ref={ref} className="relative">
      <summary className="inline-flex h-9 shrink-0 cursor-pointer list-none items-center gap-2 rounded-[5px] border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <Columns3 className="size-4 text-ink-2" />
        <span className="hidden sm:inline">Columnas</span>
        {hayOcultas ? (
          <span className="num rounded-full bg-surface-3 px-1.5 py-px text-[10px] font-semibold text-ink-2">
            {ocultas.length} oculta{ocultas.length === 1 ? "" : "s"}
          </span>
        ) : null}
        <ChevronDown className="size-3.5 text-ink-3" />
      </summary>

      <div className="absolute right-0 z-30 mt-1.5 w-72 rounded-md border border-line-strong bg-surface p-3 shadow-xl">
        <p className="rotulo text-ink-2">Columnas visibles</p>
        <p className="mt-0.5 text-[11px] text-ink-3">
          Ocultar no altera los totales ni el cumplimiento.
        </p>

        <div className="mt-3 flex max-h-72 flex-col gap-3 overflow-y-auto">
          {GRUPOS_COLUMNAS.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="mb-1 text-[11px] font-semibold text-ink-2">{grupo.titulo}</p>
              <div className="flex flex-col">
                {grupo.columnas.map((columna) => (
                  <label
                    key={columna}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] text-ink transition-colors hover:bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      checked={!ocultas.includes(columna)}
                      onChange={() => alAlternar(columna)}
                      className="size-3.5 shrink-0 accent-[var(--accent)]"
                    />
                    <span className="truncate">{etiquetaCampo(columna)}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
          <span className="text-[11px] text-ink-3">Totales y acciones siempre visibles</span>
          <button
            type="button"
            onClick={alMostrarTodas}
            disabled={!hayOcultas}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="size-3" />
            Mostrar todas
          </button>
        </div>
      </div>
    </details>
  );
}
