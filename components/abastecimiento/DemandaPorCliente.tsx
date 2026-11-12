"use client";

import { useMemo } from "react";

import { demandaPorCliente } from "@/lib/abastecimiento-demanda";
import type { MateriaPrima } from "@/lib/abastecimiento";
import { etiquetaMes } from "@/lib/periodos";
import type { MesKey, RegistroMRP } from "@/lib/types";

import { formatearTn } from "./formato";

interface Props {
  mp: MateriaPrima;
  /** Registros de la fuente de demanda elegida (datos actuales o un corte). */
  registros: RegistroMRP[];
  /** Meses con pronóstico, ordenados. */
  meses: MesKey[];
  /** De dónde sale la demanda, para el título. */
  origen: string;
}

/** Quién pide esta materia prima, mes a mes, en cisternas: las filas de cliente de cada hoja «RESUMEN …». */
export function DemandaPorCliente({ mp, registros, meses, origen }: Props) {
  const filas = useMemo(
    () => (mp.regla ? demandaPorCliente(registros, mp.regla.campo, mp.regla.valor) : []),
    [mp.regla, registros],
  );
  if (!mp.regla) return null;
  const totales = meses.map((m) => filas.reduce((acc, f) => acc + (f.cisternas[m] ?? 0), 0));

  return (
    <details className="rounded-xl border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
        Demanda por cliente (cisternas) · {origen}
        <span className="ml-2 font-normal text-ink-2">{filas.length} cliente{filas.length === 1 ? "" : "s"}</span>
      </summary>
      {filas.length === 0 ? (
        <p className="border-t border-line px-4 py-3 text-sm text-ink-2">Ningún cliente pide esta materia prima en estos datos.</p>
      ) : (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-[5] w-72 min-w-72 border-b border-line-strong bg-surface-2 px-3 py-2 text-left">
                  <span className="rotulo text-ink-2">Cliente</span>
                </th>
                {meses.map((m) => (
                  <th key={m} scope="col" className="w-[4.5rem] min-w-[4.5rem] border-b border-line-strong bg-surface-2 px-2 py-2 text-right">
                    <span className="rotulo text-ink">
                      {etiquetaMes(m)} {m.slice(2, 4)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={`${f.propietario}|${f.cuenta}`}>
                  <th scope="row" className="sticky left-0 z-[5] w-72 min-w-72 max-w-72 border-b border-line bg-surface px-3 py-1.5 text-left font-normal text-ink">
                    <span className="block truncate" title={`${f.cuenta} · ${f.propietario}`}>
                      {f.cuenta}
                    </span>
                  </th>
                  {meses.map((m) => (
                    <td key={m} className="num border-b border-line px-2 py-1.5 text-right text-ink">
                      {f.cisternas[m] ? formatearTn(f.cisternas[m]) : "·"}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row" className="sticky left-0 z-[5] border-b border-line bg-surface-2 px-3 py-2 text-left font-semibold text-ink">
                  Total demanda
                </th>
                {totales.map((t, i) => (
                  <td key={meses[i]} className="num border-b border-line bg-surface-2/60 px-2 py-2 text-right font-semibold text-ink">
                    {t ? formatearTn(t) : "·"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
