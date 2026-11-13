"use client";

import type { Evolucion } from "@/lib/evolucion-mp";
import { etiquetaMes, etiquetaMesAnio } from "@/lib/periodos";
import { cn } from "@/lib/utils";

import { formatearTn } from "./formato";
import { GraficoLineas, type SerieGrafico } from "./GraficoLineas";

interface Props {
  nombre: string;
  evolucion: Evolucion;
}

/** Colores de los cortes: se reparten entre estos para distinguirlos en el gráfico. */
const COLORES_CORTE = ["#c47a00", "#7c5cbf", "#2f9e6e", "#c2417c", "#3b82c4", "#8a6d3b"];

const COL_ETIQUETA = "sticky left-0 z-[5] w-56 min-w-56 max-w-56 bg-surface px-3 text-left shadow-[inset_-1px_0_0_var(--line)]";
const COL_MES = "w-[5.25rem] min-w-[5.25rem] px-2 text-right";

const pct = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });

/**
 * Evolución de una materia prima de enero hasta hoy: stock real contra lo que daba el modelo, y consumo real
 * contra lo que pronosticó cada corte.
 */
export function EvolucionMateria({ nombre, evolucion }: Props) {
  const { filas, resumenes } = evolucion;
  const etiquetas = filas.map((f) => `${etiquetaMes(f.mes)} ${f.mes.slice(2, 4)}`);
  const indiceActual = filas.findIndex((f) => f.esMesActual);
  const hayStockReal = filas.some((f) => f.stockReal !== undefined);
  const cortes = resumenes.map((r) => r.corte);

  const seriesStock: SerieGrafico[] = [
    ...(hayStockReal ? [{ nombre: "Stock real", valores: filas.map((f) => f.stockReal), color: "var(--accent)" }] : []),
    { nombre: "Modelo sin stock real", valores: filas.map((f) => f.stockModelo), color: "var(--ink-3)", discontinua: true },
  ];
  const seriesConsumo: SerieGrafico[] = [
    { nombre: "Consumo real", valores: filas.map((f) => f.consumoReal), color: "var(--accent)" },
    ...cortes.map((c, i) => ({
      nombre: `Pronóstico ${etiquetaMesAnio(c)}`,
      valores: filas.map((f) => f.pronosticos[c]),
      color: COLORES_CORTE[i % COLORES_CORTE.length],
      discontinua: true,
    })),
    { nombre: "Plan actual", valores: filas.map((f) => f.consumoPlan), color: "var(--ink-3)", puntos: false },
  ];

  const celda = (valor: number | undefined, extra?: string) => (
    <td className={cn(COL_MES, "num border-b border-line py-1.5", valor === undefined ? "text-ink-3" : "text-ink", extra)}>
      {valor === undefined ? "·" : formatearTn(valor)}
    </td>
  );
  const fila = (etiqueta: string, titulo: string, cuerpo: React.ReactNode, tenue = false) => (
    <tr>
      <th scope="row" title={titulo} className={cn(COL_ETIQUETA, "border-b border-line py-1.5 font-normal", tenue ? "text-ink-2" : "font-medium text-ink")}>
        <span className="block truncate">{etiqueta}</span>
      </th>
      {cuerpo}
    </tr>
  );

  return (
    <details open className="rounded-xl border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
        Evolución de {nombre} · stock y consumo, real contra proyectado
      </summary>
      <div className="flex flex-col gap-3 border-t border-line p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <GraficoLineas titulo="Stock al cierre de cada mes (TN)" etiquetas={etiquetas} series={seriesStock} marcaActual={indiceActual} />
          <GraficoLineas titulo="Consumo mensual (TN)" etiquetas={etiquetas} series={seriesConsumo} marcaActual={indiceActual} />
        </div>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th scope="col" className={cn(COL_ETIQUETA, "z-10 border-b border-line-strong bg-surface-2 py-2")}>
                  <span className="rotulo text-ink-2">Toneladas (TN)</span>
                </th>
                {filas.map((f) => (
                  <th key={f.mes} scope="col" className={cn(COL_MES, "border-b border-line-strong bg-surface-2 py-2", f.esMesActual && "bg-accent-soft")}>
                    <span className="rotulo text-ink">
                      {etiquetaMes(f.mes)} {f.mes.slice(2, 4)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hayStockReal
                ? fila(
                    "Stock real",
                    "Cierre de mes fijo; en el mes en curso, a la fecha de la última medición",
                    filas.map((f) => <Celda key={f.mes}>{celda(f.stockReal, f.stockReal !== undefined && !f.stockRealFijo ? "italic" : undefined)}</Celda>),
                  )
                : null}
              {fila(
                "Stock según el modelo",
                "Lo que daba el cálculo sin el stock real: arrastra los consumos pronosticados mes a mes",
                filas.map((f) => <Celda key={f.mes}>{celda(f.stockModelo, "text-ink-2")}</Celda>),
                true,
              )}
              {hayStockReal
                ? fila(
                    "Diferencia (modelo − real)",
                    "Cuánto se desviaba el modelo del stock real",
                    filas.map((f) => {
                      const d = f.stockReal === undefined ? undefined : f.stockModelo - f.stockReal;
                      return (
                        <Celda key={f.mes}>
                          {celda(d, d !== undefined && Math.abs(d) >= 0.5 ? (d > 0 ? "text-accent" : "text-bad") : undefined)}
                        </Celda>
                      );
                    }),
                    true,
                  )
                : null}
              <tr>
                <td colSpan={filas.length + 1} className="border-b border-line bg-surface-2/60 px-3 py-1">
                  <span className="rotulo text-ink-3">Consumo</span>
                </td>
              </tr>
              {fila(
                "Consumo real",
                "De meses cerrados: deducido del stock real, de SAP o escrito a mano",
                filas.map((f) => <Celda key={f.mes}>{celda(f.consumoReal)}</Celda>),
              )}
              {cortes.map((c) =>
                fila(
                  `Pronóstico del corte ${etiquetaMesAnio(c)}`,
                  "Consumo que salía de la demanda de ese corte × la tasa de conversión",
                  filas.map((f) => <Celda key={f.mes}>{celda(f.pronosticos[c], "text-ink-2 italic")}</Celda>),
                  true,
                ),
              )}
              {fila(
                "Plan actual",
                "Consumo que usa hoy el plan de Abastecimiento",
                filas.map((f) => <Celda key={f.mes}>{celda(f.consumoPlan, f.cerrado ? "text-ink-2" : "text-ink")}</Celda>),
                true,
              )}
            </tbody>
          </table>
        </div>

        {resumenes.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-xs text-ink-2">
            {resumenes.map((r) => (
              <li key={r.corte} className="rounded-lg border border-line bg-surface-2/50 px-3 py-1.5">
                <span className="font-medium text-ink">Corte {etiquetaMesAnio(r.corte)}</span>
                {r.mesesComparados === 0 ? (
                  <> · sin meses cerrados que comparar</>
                ) : (
                  <>
                    {" "}
                    · pronosticó {formatearTn(r.pronosticado)} TN contra {formatearTn(r.real)} TN reales en {r.mesesComparados} mes
                    {r.mesesComparados === 1 ? "" : "es"}
                    {r.desvio !== null ? (
                      <>
                        {" "}
                        (<span className={cn("font-semibold", Math.abs(r.desvio) > 0.25 ? "text-bad" : "text-ink")}>{pct.format(r.desvio)}</span>)
                      </>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-ink-3">
          El stock real y el consumo deducido salen del Excel de stocks de Suministro; el pronóstico, de la «Base de datos» de cada corte mensual.
          Los meses sin dato quedan en blanco.
        </p>
      </div>
    </details>
  );
}

/** Pasa la celda ya armada tal cual (evita repetir el `<td>` en cada fila). */
function Celda({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
