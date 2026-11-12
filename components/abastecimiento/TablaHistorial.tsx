"use client";

import { Info } from "lucide-react";

import type { SerieHistorial } from "@/lib/consumo-excel";
import { etiquetaMes } from "@/lib/periodos";
import type { MesKey } from "@/lib/types";
import { cn } from "@/lib/utils";

import { formatearTn } from "./formato";

interface Props {
  serie: SerieHistorial;
  anio: number;
  /** Último mes cargado de cada corte, para decir hasta cuándo llega la información. */
  hasta: MesKey | null;
}

const COL_ETIQUETA = "sticky left-0 z-[5] w-56 min-w-56 max-w-56 bg-surface px-3 text-left shadow-[inset_-1px_0_0_var(--line)]";
const COL_MES = "w-[5.25rem] min-w-[5.25rem] px-2 text-right";

/**
 * Historial de un año ya cerrado de una materia prima (stock, consumo e ingresos mes a mes), leído de los
 * libros mensuales. Solo consulta: no se edita ni entra en el cálculo.
 */
export function TablaHistorial({ serie, anio, hasta }: Props) {
  const meses: MesKey[] = Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`);
  const con = meses.filter((m) => serie.meses[m] !== undefined);
  const primero = serie.meses[con[0]];
  const ultimo = serie.meses[con[con.length - 1]];
  const suma = (valor: (m: MesKey) => number | undefined) => meses.reduce((acc, m) => acc + (valor(m) ?? 0), 0);

  const proveedores = Object.entries(serie.ingresosPorProveedor).filter(([, porMes]) =>
    meses.some((m) => (porMes[m] ?? 0) !== 0),
  );

  const celda = (clave: string, valor: number | undefined, negativoRojo = false) => (
    <td
      key={clave}
      className={cn(
        COL_MES,
        "num border-b border-line py-2",
        valor === undefined ? "text-ink-3" : negativoRojo && valor < -1e-9 ? "bg-bad-soft text-bad" : "text-ink",
      )}
    >
      {valor === undefined ? "·" : formatearTn(valor)}
    </td>
  );
  const total = (texto: string, titulo: string) => (
    <td title={titulo} className="num w-24 min-w-24 border-b border-l border-line bg-surface-2/60 px-3 py-2 text-right font-semibold text-ink">
      {texto}
    </td>
  );
  const etiqueta = (children: React.ReactNode) => (
    <th scope="row" className={cn(COL_ETIQUETA, "border-b border-line py-2 font-medium text-ink-2")}>
      {children}
    </th>
  );

  return (
    <>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className={cn(COL_ETIQUETA, "z-10 border-b border-line-strong bg-surface-2 align-bottom")}>
                <span className="rotulo pb-2 text-ink-2">Toneladas (TN)</span>
              </th>
              <th scope="colgroup" colSpan={12} className="rotulo h-7 border-b border-l border-line bg-surface-2 px-3 text-left text-ink-2">
                {anio} · historial
              </th>
              <th scope="col" rowSpan={2} className="w-24 min-w-24 border-b border-l border-line-strong bg-surface-2 px-3 text-right align-bottom">
                <span className="rotulo block pb-2 text-ink">Total {anio}</span>
              </th>
            </tr>
            <tr>
              {meses.map((m) => (
                <th key={m} scope="col" className={cn(COL_MES, "h-10 border-b border-line-strong bg-surface-2 align-bottom")}>
                  <span className="rotulo block pb-2 text-ink">{etiquetaMes(m)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {etiqueta("Stock inicial")}
              {meses.map((m) => celda(m, serie.meses[m]?.stockInicial))}
              {total(primero?.stockInicial === undefined ? "–" : formatearTn(primero.stockInicial), "Stock con el que empezó el año")}
            </tr>
            <tr>
              {etiqueta("Consumo mensual")}
              {meses.map((m) => celda(m, serie.meses[m]?.consumo))}
              {total(formatearTn(suma((m) => serie.meses[m]?.consumo)), "Consumo del año")}
            </tr>
            <tr>
              <td colSpan={14} className="border-b border-line bg-surface-2/60 px-3 py-1">
                <span className="rotulo text-ink-3">Ingresos, por proveedor</span>
              </td>
            </tr>
            {proveedores.map(([nombre, porMes]) => (
              <tr key={nombre}>
                {etiqueta(<span className="block truncate font-normal text-ink">{nombre}</span>)}
                {meses.map((m) => celda(m, porMes[m] || undefined))}
                {total(formatearTn(suma((m) => porMes[m])), `Ingresos de ${nombre} en el año`)}
              </tr>
            ))}
            <tr>
              {etiqueta(<span className="font-semibold">Ingresos totales</span>)}
              {meses.map((m) => celda(m, serie.meses[m]?.ingresos || undefined))}
              {total(formatearTn(suma((m) => serie.meses[m]?.ingresos)), "Ingresos del año")}
            </tr>
            <tr>
              {etiqueta(<span className="font-semibold">Stock final del mes</span>)}
              {meses.map((m) => celda(m, serie.meses[m]?.stockFinal, true))}
              {total(ultimo?.stockFinal === undefined ? "–" : formatearTn(ultimo.stockFinal), "Stock al cierre del año")}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="flex gap-2 border-t border-line px-4 py-3 text-xs text-ink-2">
        <Info className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
        <span className="max-w-4xl">
          Datos del Excel mensual (hoja «{serie.fuente}»{serie.unidadOriginal === "KG" ? ", pasados de kg a TN" : ""}
          {hasta ? `; llegan hasta ${etiquetaMes(hasta)} ${hasta.slice(0, 4)}` : ""}). Es solo consulta: no entra en el cálculo del MRP.
        </span>
      </p>
    </>
  );
}
