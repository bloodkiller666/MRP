"use client";

import { BarChart3, Download } from "lucide-react";

import { MESES } from "@/lib/constants";
import {
  formatearNumero,
  resumenPorCampo,
  totalGeneral,
  totalesPorMes,
  type FilaResumen,
} from "@/lib/mrp-utils";
import type { RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Boton } from "./ui/Boton";
import { Modal } from "./ui/Modal";

interface PropsReporte {
  abierto: boolean;
  onCerrar: () => void;
  /** Vista actual (ya filtrada). */
  registros: RegistroMRP[];
  onExportar: () => void;
}

/** Color de la barra según la refinería, para distinguir PETROPERU de IMPORTADO. */
function colorRefineria(etiqueta: string): string {
  const valor = etiqueta.toUpperCase();
  if (valor.includes("PETROPERU")) return "bg-emerald-500";
  if (valor.includes("IMPORTADO")) return "bg-sky-500";
  if (valor.includes("LOCAL")) return "bg-amber-500";
  return "bg-violet-500";
}

const COLORES_GRUPO = [
  "bg-slate-500",
  "bg-sky-600",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-violet-600",
];

const clasesTitulo =
  "text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400";

/** Sección de barras horizontales con el detalle de una agrupación. */
function SeccionBarras({
  titulo,
  filas,
  colorPorFila,
}: {
  titulo: string;
  filas: FilaResumen[];
  colorPorFila?: (etiqueta: string, indice: number) => string;
}) {
  if (filas.length === 0) {
    return (
      <div>
        <h3 className={cn("mb-2", clasesTitulo)}>{titulo}</h3>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Sin datos para la vista actual.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className={cn("mb-3", clasesTitulo)}>{titulo}</h3>
      <div className="flex flex-col gap-3">
        {filas.map((fila, indice) => (
          <div key={fila.etiqueta}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span
                className="truncate font-medium text-slate-700 dark:text-slate-200"
                title={fila.etiqueta}
              >
                {fila.etiqueta}
              </span>
              <span className="shrink-0 tabular-nums text-slate-900 dark:text-slate-100">
                <span className="font-semibold">{formatearNumero(fila.total)}</span>
                <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                  {fila.porcentaje.toFixed(1)}% · {fila.registros} reg.
                </span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  colorPorFila
                    ? colorPorFila(fila.etiqueta, indice)
                    : COLORES_GRUPO[indice % COLORES_GRUPO.length],
                )}
                style={{ width: `${Math.max(fila.porcentaje, 1.5)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Reporte rápido: totales por mes, por grupo línea, por refinería y por UM. */
export function ReportModal({ abierto, onCerrar, registros, onExportar }: PropsReporte) {
  const totales = totalesPorMes(registros);
  const total = totalGeneral(registros);
  const maximoMes = Math.max(...MESES.map((mes) => totales[mes.key]), 0);
  const porGrupo = resumenPorCampo(registros, "grupoLinea");
  const porRefineria = resumenPorCampo(registros, "refineria");
  const porUnidad = resumenPorCampo(registros, "unidadMedida");

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Reporte rápido"
      descripcion="Resumen calculado sobre la vista actual (con los filtros aplicados)."
      tamano="lg"
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cerrar
          </Boton>
          <Boton onClick={onExportar} icono={<Download className="size-4" />}>
            Exportar esta vista a Excel
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { etiqueta: "Registros", valor: registros.length.toString() },
            { etiqueta: "Consumo total", valor: formatearNumero(total) },
            { etiqueta: "Grupos línea", valor: porGrupo.length.toString() },
            { etiqueta: "Unidades de medida", valor: porUnidad.length.toString() },
          ].map((kpi) => (
            <div
              key={kpi.etiqueta}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40"
            >
              <p className={clasesTitulo}>{kpi.etiqueta}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                {kpi.valor}
              </p>
            </div>
          ))}
        </div>

        {/* Por mes */}
        <div>
          <h3 className={cn("mb-3 flex items-center gap-1.5", clasesTitulo)}>
            <BarChart3 className="size-3.5" /> Consumo por mes
          </h3>
          <div className="flex items-end gap-2">
            {MESES.map((mes) => {
              const valor = totales[mes.key];
              const altura = maximoMes > 0 ? Math.max((valor / maximoMes) * 100, 2) : 2;
              return (
                <div key={mes.key} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                    {formatearNumero(valor)}
                  </span>
                  <div className="flex h-24 w-full items-end rounded-md bg-slate-100 dark:bg-slate-800">
                    <div
                      className="w-full rounded-md bg-slate-800 transition-[height] duration-500 dark:bg-slate-300"
                      style={{ height: `${altura}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {mes.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SeccionBarras titulo="Consumo por Grupo Línea" filas={porGrupo} />
          <SeccionBarras
            titulo="Consumo por Refinería"
            filas={porRefineria}
            colorPorFila={(etiqueta) => colorRefineria(etiqueta)}
          />
        </div>

        <SeccionBarras titulo="Consumo por Unidad de Medida" filas={porUnidad} />
      </div>
    </Modal>
  );
}
