"use client";

import { useMemo } from "react";

import { useAbastecimiento } from "@/hooks/use-abastecimiento";
import { useHistorialMp } from "@/hooks/use-historial-mp";
import { filasRealPorMateria } from "@/lib/real-por-materia";
import { etiquetaMes } from "@/lib/periodos";
import type { MesKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const cist = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const porcentaje = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 0 });

/**
 * Resumen por materia prima del real + avance y la demanda del periodo, en cisternas. Sale de las hojas RESUMEN
 * del libro mensual (un total por materia prima; el real por cliente no viene en ese libro).
 */
export function RealPorMateria({ meses }: { meses: MesKey[] }) {
  const { historial } = useHistorialMp();
  const { estado } = useAbastecimiento();
  const filas = useMemo(
    () => filasRealPorMateria(historial.series, estado.materias.map((m) => ({ id: m.id, nombre: m.nombre })), meses),
    [historial.series, estado.materias, meses],
  );
  if (filas.length === 0) return null;

  const mesesConDato = meses.filter((m) => filas.some((f) => f.porMes[m]?.real !== undefined || f.porMes[m]?.demanda !== undefined));
  const totalReal = filas.reduce((a, f) => a + f.totalReal, 0);
  const totalDemanda = filas.reduce((a, f) => a + f.demandaConReal, 0);

  return (
    <details className="rounded-xl border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
        Real + avance por materia prima (cisternas) · {filas.length} materias
        <span className="ml-2 text-xs font-normal text-ink-3">de las hojas RESUMEN del libro mensual</span>
      </summary>
      <div className="overflow-x-auto border-t border-line p-4">
        <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-ink-2">
              <th scope="col" className="rotulo border-b border-line-strong bg-surface-2 px-3 py-2 text-left">Materia prima</th>
              {mesesConDato.map((m) => (
                <th key={m} scope="col" className="rotulo border-b border-line-strong bg-surface-2 px-2 py-2 text-right">{etiquetaMes(m)}</th>
              ))}
              <th scope="col" className="rotulo border-b border-line-strong bg-surface-2 px-2 py-2 text-right">Demanda</th>
              <th scope="col" className="rotulo border-b border-line-strong bg-surface-2 px-2 py-2 text-right">Real + avance</th>
              <th scope="col" className="rotulo border-b border-line-strong bg-surface-2 px-2 py-2 text-right">Cumplimiento</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <th scope="row" className="border-b border-line px-3 py-1.5 text-left font-medium text-ink">{f.nombre.replace(/ (.*)$/, "")}</th>
                {mesesConDato.map((m) => {
                  const d = f.porMes[m];
                  return (
                    <td
                      key={m}
                      title={d ? `Demanda ${cist.format(d.demanda ?? 0)} · Real + avance ${d.real === undefined ? "sin dato" : cist.format(d.real)}` : undefined}
                      className={cn("num border-b border-line px-2 py-1.5 text-right", d?.real === undefined ? "text-ink-3" : "text-ink")}
                    >
                      {d?.real === undefined ? "·" : cist.format(d.real)}
                    </td>
                  );
                })}
                <td className="num border-b border-line px-2 py-1.5 text-right text-ink-2">{cist.format(f.demandaConReal)}</td>
                <td className="num border-b border-line px-2 py-1.5 text-right text-ink">{cist.format(f.totalReal)}</td>
                <td
                  className={cn(
                    "num border-b border-line px-2 py-1.5 text-right",
                    f.cumplimiento !== null && Math.abs(f.cumplimiento - 1) > 0.25 ? "text-bad" : "text-ink",
                  )}
                >
                  {f.cumplimiento === null ? "–" : porcentaje.format(f.cumplimiento)}
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="px-3 py-1.5 text-left font-semibold text-ink">Total</th>
              {mesesConDato.map((m) => (
                <td key={m} className="num px-2 py-1.5 text-right font-semibold text-ink">
                  {cist.format(filas.reduce((a, f) => a + (f.porMes[m]?.real ?? 0), 0))}
                </td>
              ))}
              <td className="num px-2 py-1.5 text-right font-semibold text-ink-2">{cist.format(totalDemanda)}</td>
              <td className="num px-2 py-1.5 text-right font-semibold text-ink">{cist.format(totalReal)}</td>
              <td className="num px-2 py-1.5 text-right font-semibold text-ink">{totalDemanda > 1e-9 ? porcentaje.format(totalReal / totalDemanda) : "–"}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink-3">
          Cada materia prima tiene un solo total (no por cliente). «Demanda» suma solo los meses con real + avance. El mes en curso suele
          traer el avance igual a la demanda hasta que se actualiza el libro.
        </p>
      </div>
    </details>
  );
}
