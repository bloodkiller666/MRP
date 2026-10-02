"use client";

import { ChevronDown, Columns3, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";

import { GRUPOS_COLUMNAS } from "@/lib/constants";
import { etiquetaCampo } from "@/lib/mrp-utils";
import type { ColumnaTabla } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PropsColumnas {
  /** Columnas de datos actualmente ocultas. */
  ocultas: ColumnaTabla[];
  alAlternar: (columna: ColumnaTabla) => void;
  alMostrarTodas: () => void;
}

/**
 * Selector de visibilidad de columnas.
 *
 * Usa `<details>` nativo (sin estado de React para abrir/cerrar) y cierra el
 * panel al hacer clic fuera. Ocultar una columna es **solo visual**: los totales
 * por fila, por mes y el total general se siguen calculando con todas las
 * columnas, por eso el panel lo advierte explícitamente.
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
      <summary
        className={cn(
          "inline-flex h-9 shrink-0 cursor-pointer list-none items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors",
          "hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <Columns3 className="size-4" />
        Columnas
        {hayOcultas ? (
          <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-slate-600">
            {ocultas.length} oculta{ocultas.length === 1 ? "" : "s"}
          </span>
        ) : null}
        <ChevronDown className="size-3.5 text-slate-400" />
      </summary>

      <div className="absolute right-0 z-30 mt-1.5 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-2 border-b border-slate-100 pb-2 dark:border-slate-800">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Visibilidad de columnas
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            Ocultar columnas no altera los totales: siguen sumando todos los meses.
          </p>
        </div>

        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
          {GRUPOS_COLUMNAS.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="mb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {grupo.titulo}
              </p>
              <div className="grid grid-cols-2 gap-x-2">
                {grupo.columnas.map((columna) => {
                  const visible = !ocultas.includes(columna);
                  return (
                    <label
                      key={columna}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => alAlternar(columna)}
                        className="size-3.5 shrink-0 accent-slate-900 dark:accent-slate-400"
                      />
                      <span className="truncate" title={etiquetaCampo(columna)}>
                        {etiquetaCampo(columna)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Total y Acciones siempre visibles
          </span>
          <button
            type="button"
            onClick={alMostrarTodas}
            disabled={!hayOcultas}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RotateCcw className="size-3" />
            Mostrar todas
          </button>
        </div>
      </div>
    </details>
  );
}
