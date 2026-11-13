"use client";

import { useMemo, useState } from "react";

import { useAbastecimiento } from "@/hooks/use-abastecimiento";
import { useHistorialMp } from "@/hooks/use-historial-mp";
import { filasRealPorMateria } from "@/lib/real-por-materia";
import { etiquetaMes } from "@/lib/periodos";
import type { MesKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const cist = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tn = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const porcentaje = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 0 });

type Modo = "cisternas" | "tn";

const TH = "rotulo border-b border-line-strong bg-surface-2 px-2 py-2 text-right";

/**
 * Resumen por materia prima del real + avance del periodo, de las hojas RESUMEN del libro mensual. En cisternas
 * (con demanda y cumplimiento) o en TN (consumo mensual real de la materia prima). Es un total por materia
 * prima; el real por cliente no viene en ese libro.
 */
export function RealPorMateria({ meses }: { meses: MesKey[] }) {
  const { historial } = useHistorialMp();
  const { estado } = useAbastecimiento();
  const [modo, setModo] = useState<Modo>("cisternas");
  const todas = useMemo(
    () => filasRealPorMateria(historial.series, estado.materias.map((m) => ({ id: m.id, nombre: m.nombre })), meses),
    [historial.series, estado.materias, meses],
  );
  const enTn = modo === "tn";
  const filas = todas.filter((f) => (enTn ? f.tieneTn : f.tieneCisternas));
  if (todas.length === 0) return null;

  const mesesConDato = meses.filter((m) =>
    filas.some((f) => (enTn ? f.porMes[m]?.consumoTn !== undefined : f.porMes[m]?.real !== undefined || f.porMes[m]?.demanda !== undefined)),
  );
  const valorMes = (f: (typeof filas)[number], m: MesKey) => (enTn ? f.porMes[m]?.consumoTn : f.porMes[m]?.real);
  const fmt = (n: number) => (enTn ? tn.format(n) : cist.format(n));
  const totalReal = filas.reduce((a, f) => a + f.totalReal, 0);
  const totalDemanda = filas.reduce((a, f) => a + f.demandaConReal, 0);
  const totalConsumo = filas.reduce((a, f) => a + f.totalConsumoTn, 0);

  return (
    <details className="rounded-xl border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
        Real + avance por materia prima ({enTn ? "TN" : "cisternas"}) · {filas.length} materias
        <span className="ml-2 text-xs font-normal text-ink-3">de las hojas RESUMEN del libro mensual</span>
      </summary>
      <div className="border-t border-line p-4">
        <div role="group" aria-label="Unidad" className="mb-3 inline-flex overflow-hidden rounded-lg border border-line text-xs">
          {([["cisternas", "Cisternas"], ["tn", "TN (consumo)"]] as const).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={modo === valor}
              onClick={() => setModo(valor)}
              className={cn("px-3 py-1.5 font-medium", modo === valor ? "bg-accent-soft text-ink" : "bg-surface text-ink-2 hover:bg-surface-2")}
            >
              {texto}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-ink-2">
                <th scope="col" className="rotulo border-b border-line-strong bg-surface-2 px-3 py-2 text-left">Materia prima</th>
                {mesesConDato.map((m) => (
                  <th key={m} scope="col" className={TH}>{etiquetaMes(m)}</th>
                ))}
                {enTn ? (
                  <th scope="col" className={TH}>Consumo real (TN)</th>
                ) : (
                  <>
                    <th scope="col" className={TH}>Demanda</th>
                    <th scope="col" className={TH}>Real + avance</th>
                    <th scope="col" className={TH}>Cumplimiento</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <th scope="row" className="border-b border-line px-3 py-1.5 text-left font-medium text-ink">{f.nombre.replace(/ (.*)$/, "")}</th>
                  {mesesConDato.map((m) => {
                    const v = valorMes(f, m);
                    const d = f.porMes[m];
                    return (
                      <td
                        key={m}
                        title={!enTn && d ? `Demanda ${cist.format(d.demanda ?? 0)} · Real + avance ${d.real === undefined ? "sin dato" : cist.format(d.real)}` : undefined}
                        className={cn("num border-b border-line px-2 py-1.5 text-right", v === undefined ? "text-ink-3" : "text-ink")}
                      >
                        {v === undefined ? "·" : fmt(v)}
                      </td>
                    );
                  })}
                  {enTn ? (
                    <td className="num border-b border-line px-2 py-1.5 text-right text-ink">{tn.format(f.totalConsumoTn)}</td>
                  ) : (
                    <>
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
                    </>
                  )}
                </tr>
              ))}
              <tr>
                <th scope="row" className="px-3 py-1.5 text-left font-semibold text-ink">{enTn ? "Total (TN)" : "Total (cisternas)"}</th>
                {mesesConDato.map((m) => (
                  <td key={m} className="num px-2 py-1.5 text-right font-semibold text-ink">
                    {fmt(filas.reduce((a, f) => a + (valorMes(f, m) ?? 0), 0))}
                  </td>
                ))}
                {enTn ? (
                  <td className="num px-2 py-1.5 text-right font-semibold text-ink">{tn.format(totalConsumo)}</td>
                ) : (
                  <>
                    <td className="num px-2 py-1.5 text-right font-semibold text-ink-2">{cist.format(totalDemanda)}</td>
                    <td className="num px-2 py-1.5 text-right font-semibold text-ink">{cist.format(totalReal)}</td>
                    <td className="num px-2 py-1.5 text-right font-semibold text-ink">
                      {totalDemanda > 1e-9 ? porcentaje.format(totalReal / totalDemanda) : "–"}
                    </td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-3">
          {enTn
            ? "Consumo mensual de la materia prima en toneladas (fila «Consumo Mensual» de cada hoja RESUMEN). No hay demanda en TN en ese libro, por eso no hay cumplimiento; para compararlo con el pronóstico ve a Abastecimiento → Evolución."
            : "Cada materia prima tiene un solo total (no por cliente). «Demanda» suma solo los meses con real + avance. El mes en curso suele traer el avance igual a la demanda hasta que se actualiza el libro."}
        </p>
      </div>
    </details>
  );
}
