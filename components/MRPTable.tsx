"use client";

import { EyeOff, Inbox, Pencil, Trash2 } from "lucide-react";

import { CAMPOS_TEXTO, ETIQUETAS_CAMPO, MESES, UNIDADES_MEDIDA } from "@/lib/constants";
import { formatearNumero, totalFila, totalesPorMes } from "@/lib/mrp-utils";
import type { CampoTextoMRP, ColumnaTabla, MesKey, RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

import { EditableCell } from "./EditableCell";

interface MRPTableProps {
  /** Registros ya filtrados (lo que se ve y se exporta). */
  registros: RegistroMRP[];
  /** Total de registros sin filtrar, para el contador del pie. */
  totalSinFiltrar: number;
  /** Columnas de datos ocultas. Solo afecta a la vista, nunca a los totales. */
  ocultas: ColumnaTabla[];
  alActualizarCampo: (id: string, campo: CampoTextoMRP, valor: string) => void;
  alActualizarProyeccion: (id: string, mes: MesKey, valor?: number) => void;
  alEliminar: (registro: RegistroMRP) => void;
  alEditarFila: (registro: RegistroMRP) => void;
}

const clasesTh =
  "sticky top-0 z-10 border-b border-slate-300 bg-slate-100 px-3 py-2 text-left text-[11px] " +
  "font-semibold tracking-wide text-slate-600 uppercase whitespace-nowrap " +
  "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

const clasesTdTotales =
  "sticky bottom-0 z-10 bg-slate-900 px-3 py-2.5 text-right font-semibold tabular-nums " +
  "text-white dark:bg-slate-800";

/**
 * Tabla principal estilo "Excel moderno" con header y totales fijos.
 *
 * Las columnas pueden ocultarse desde `components/ColumnasSelector.tsx`. Ocultar
 * es puramente visual: `totalFila`, `totalesPorMes` y el total general se
 * calculan siempre sobre todas las columnas, de modo que la fila de totales
 * nunca cambia por ocultar un mes o un campo.
 */
export function MRPTable({
  registros,
  totalSinFiltrar,
  ocultas,
  alActualizarCampo,
  alActualizarProyeccion,
  alEliminar,
  alEditarFila,
}: MRPTableProps) {
  // Los totales se calculan sobre TODOS los meses, sin mirar la visibilidad.
  const totales = totalesPorMes(registros);
  const totalGlobal = registros.reduce((acc, registro) => acc + totalFila(registro), 0);

  const camposVisibles = CAMPOS_TEXTO.filter((campo) => !ocultas.includes(campo));
  const mesesVisibles = MESES.filter((mes) => !ocultas.includes(mes.key));

  // Columnas visibles + "Total" + "Acciones".
  const columnasVisibles = camposVisibles.length + mesesVisibles.length + 2;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="max-h-[calc(100vh-22rem)] min-h-64 overflow-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {camposVisibles.map((campo) => (
                <th key={campo} scope="col" className={clasesTh}>
                  {ETIQUETAS_CAMPO[campo]}
                </th>
              ))}
              {mesesVisibles.map((mes) => (
                <th key={mes.key} scope="col" className={cn(clasesTh, "text-right")}>
                  {mes.label}
                </th>
              ))}
              <th scope="col" className={cn(clasesTh, "text-right")}>
                Total Proyectado
              </th>
              <th scope="col" className={cn(clasesTh, "text-center")}>
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan={columnasVisibles} className="px-4 py-16 text-center">
                  <Inbox className="mx-auto mb-3 size-8 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    No hay registros que coincidan
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Ajusta los filtros, importa un Excel o agrega un registro manualmente.
                  </p>
                </td>
              </tr>
            ) : (
              registros.map((registro, indice) => (
                <tr
                  key={registro.id}
                  className={cn(
                    "group transition-colors hover:bg-amber-50 dark:hover:bg-slate-800/70",
                    indice % 2 === 1 && "bg-slate-50/70 dark:bg-slate-950/40",
                  )}
                >
                  {camposVisibles.map((campo) => (
                    <EditableCell
                      key={campo}
                      valor={registro[campo]}
                      tipo={campo === "unidadMedida" ? "select" : "texto"}
                      opciones={
                        campo === "unidadMedida" ? unirUnidades(registro.unidadMedida) : undefined
                      }
                      alGuardar={(valor) => alActualizarCampo(registro.id, campo, String(valor ?? ""))}
                    />
                  ))}

                  {mesesVisibles.map((mes) => (
                    <EditableCell
                      key={mes.key}
                      valor={registro.proyecciones[mes.key]}
                      tipo="numero"
                      alineacion="derecha"
                      alGuardar={(valor) =>
                        alActualizarProyeccion(
                          registro.id,
                          mes.key,
                          typeof valor === "number" ? valor : undefined,
                        )
                      }
                    />
                  ))}

                  <td className="border-b border-slate-100 bg-slate-50/80 px-3 py-1.5 text-right font-semibold tabular-nums text-slate-800 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100">
                    {formatearNumero(totalFila(registro))}
                  </td>

                  <td className="border-b border-slate-100 px-2 py-1.5 dark:border-slate-800">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => alEditarFila(registro)}
                        title="Editar registro completo"
                        aria-label="Editar registro completo"
                        className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => alEliminar(registro)}
                        title="Eliminar registro"
                        aria-label="Eliminar registro"
                        className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/70 dark:hover:text-red-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          <tfoot>
            <tr>
              <td
                colSpan={Math.max(camposVisibles.length, 1)}
                className="sticky bottom-0 z-10 bg-slate-900 px-3 py-2.5 text-xs font-semibold tracking-wide text-white uppercase dark:bg-slate-800"
              >
                Total por mes
                <span className="ml-2 font-normal text-slate-400 normal-case">
                  ({registros.length} de {totalSinFiltrar} registros)
                </span>
              </td>
              {mesesVisibles.map((mes) => (
                <td key={mes.key} className={clasesTdTotales}>
                  {formatearNumero(totales[mes.key])}
                </td>
              ))}
              <td className={cn(clasesTdTotales, "bg-slate-900 font-bold dark:bg-slate-800")}>
                {formatearNumero(totalGlobal)}
              </td>
              <td className="sticky bottom-0 z-10 bg-slate-900 dark:bg-slate-800" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-500">
        <span>
          Consejo: <span className="font-medium text-slate-500 dark:text-slate-400">doble clic</span>{" "}
          sobre una celda para editarla ·{" "}
          <span className="font-medium text-slate-500 dark:text-slate-400">Enter</span> guarda ·{" "}
          <span className="font-medium text-slate-500 dark:text-slate-400">Esc</span> cancela.
        </span>
        {ocultas.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <EyeOff className="size-3" />
            {ocultas.length} columna{ocultas.length === 1 ? "" : "s"} oculta
            {ocultas.length === 1 ? "" : "s"} · los totales las siguen incluyendo
          </span>
        ) : null}
      </p>
    </section>
  );
}

/** Une el valor actual de UM con el catálogo, sin duplicados. */
function unirUnidades(actual: string): string[] {
  const set = new Set([...UNIDADES_MEDIDA, actual].filter(Boolean));
  return [...set];
}
