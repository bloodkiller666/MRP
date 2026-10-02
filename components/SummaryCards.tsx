"use client";

import { Boxes, CalendarRange } from "lucide-react";

import { MESES } from "@/lib/constants";
import { formatearNumero, resumenPorCampo, totalesPorMes } from "@/lib/mrp-utils";
import type { RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TarjetasResumenProps {
  /** Registros ya filtrados: las tarjetas reflejan siempre la vista actual. */
  registros: RegistroMRP[];
}

/** Colores de las barras por unidad de medida (rotan si hay más de 4 UM). */
const COLORES_UM = ["bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500"];

/** Tarjetas con el total por mes y el desglose por unidad de medida. */
export function SummaryCards({ registros }: TarjetasResumenProps) {
  const totales = totalesPorMes(registros);
  const totalGlobal = MESES.reduce((acc, mes) => acc + totales[mes.key], 0);
  const maximoMes = Math.max(...MESES.map((mes) => totales[mes.key]), 0);
  const porUnidad = resumenPorCampo(registros, "unidadMedida");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {MESES.map((mes) => {
          const total = totales[mes.key];
          const porcentaje = maximoMes > 0 ? (total / maximoMes) * 100 : 0;
          return (
            <article
              key={mes.key}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <header className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  {mes.nombre}
                </span>
                <CalendarRange className="size-3.5 text-slate-300 dark:text-slate-600" />
              </header>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatearNumero(total)}
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-slate-700 transition-[width] duration-300 dark:bg-slate-300"
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
            </article>
          );
        })}

        <article className="rounded-xl border border-slate-900 bg-slate-900 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <header className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-300 uppercase">
              Total general
            </span>
            <Boxes className="size-3.5 text-slate-500" />
          </header>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-white">
            {formatearNumero(totalGlobal)}
          </p>
          <p className="mt-2 text-[11px] text-slate-400">
            {registros.length} registro{registros.length === 1 ? "" : "s"} · suma de todas las UM
          </p>
        </article>
      </div>

      {porUnidad.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Por unidad de medida
          </span>
          {porUnidad.map((fila, indice) => (
            <div
              key={fila.etiqueta}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-3 pl-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white",
                  COLORES_UM[indice % COLORES_UM.length],
                )}
              >
                {fila.etiqueta.slice(0, 3)}
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {formatearNumero(fila.total)}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                · {fila.registros} reg.
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
