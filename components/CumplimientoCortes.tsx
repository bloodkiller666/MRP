"use client";

import { useMemo, useState } from "react";

import { useCortes } from "@/hooks/use-cortes";
import { cumplimientoContraCorteAnterior, type EstadoCliente } from "@/lib/cumplimiento-cortes";
import { etiquetaMesAnio } from "@/lib/periodos";
import type { EstadoCumplimiento, MesKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const num = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signo = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });
const pct = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 0 });

const COLOR_ESTADO: Record<EstadoCumplimiento, string> = {
  verde: "text-ok",
  amarillo: "text-warn",
  rojo: "text-bad",
  "sin-real": "text-ink-3",
  "sin-demanda": "text-ink-3",
};

const ETIQUETA_CLIENTE: Record<EstadoCliente, { texto: string; clase: string }> = {
  cumple: { texto: "Cumple", clase: "text-ok" },
  "en-riesgo": { texto: "En riesgo", clase: "text-warn" },
  critico: { texto: "Crítico", clase: "text-bad" },
  "sin-real": { texto: "Sin despacho", clase: "text-bad" },
  "sin-pronostico": { texto: "No pronosticado", clase: "text-ink-2" },
};

const LIMITE_FILAS = 15;

/**
 * Cumplimiento de cada mes contra el pronóstico del corte anterior: el real + avance del corte de ese mes frente a
 * lo que el corte previo decía para él. Solo aparece cuando hay al menos dos cortes cargados.
 */
export function CumplimientoCortes() {
  const { cortes } = useCortes();
  const meses = useMemo(() => cumplimientoContraCorteAnterior(cortes), [cortes]);
  const [elegido, setElegido] = useState<MesKey | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  if (meses.length === 0) return null;

  // Por defecto, el último mes cerrado: el mes del corte más reciente solo trae el avance hasta la fecha del corte.
  const porDefecto = meses.filter((m) => !m.enCurso).at(-1) ?? meses[meses.length - 1];
  const actual = meses.find((m) => m.mes === elegido) ?? porDefecto;
  const clientes = verTodos ? actual.clientes : actual.clientes.slice(0, LIMITE_FILAS);

  return (
    <details className="rounded-xl border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
        Cumplimiento contra el pronóstico del corte anterior
        <span className={cn("ml-2 text-xs font-normal", COLOR_ESTADO[actual.estado])}>
          {etiquetaMesAnio(actual.mes)}: {actual.ratio === null ? "sin pronóstico" : pct.format(actual.ratio)}{actual.enCurso ? " (en curso)" : ""}
        </span>
        <span className="ml-2 text-xs font-normal text-ink-3">cisternas · {meses.length} mes(es)</span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-line p-4">
        <p className="text-xs text-ink-3">
          El Excel reemplaza el pronóstico del mes del corte por el real + avance. Por eso cada mes se compara con lo que decía el corte
          anterior para ese mismo mes. Haz clic en un mes para ver el detalle por cliente.
        </p>
        <p role="note" className="rounded-lg border border-line bg-warn-soft px-3 py-2 text-xs text-warn">
          Ojo: el «real + avance» de cada mes es lo despachado <strong>hasta la fecha en que se hizo ese corte</strong>, no necesariamente el
          mes completo. Por eso los porcentajes suelen quedar por debajo de 100 %, y el mes del corte más reciente («en curso») aún no es
          definitivo. Sirve para ver quién se desvía más y para comparar meses entre sí.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-ink-2">
                {["Mes", "Pronóstico del corte de", "Pronosticado", "Real + avance", "Cumplimiento", "Real sin pronóstico"].map((t, i) => (
                  <th key={t} scope="col" className={cn("rotulo border-b border-line-strong bg-surface-2 px-3 py-2", i < 2 ? "text-left" : "text-right")}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr
                  key={m.mes}
                  onClick={() => {
                    setElegido(m.mes);
                    setVerTodos(false);
                  }}
                  className={cn("cursor-pointer", m.mes === actual.mes ? "bg-accent-soft" : "hover:bg-surface-2")}
                >
                  <th scope="row" className="border-b border-line px-3 py-1.5 text-left font-medium text-ink">
                    {etiquetaMesAnio(m.mes)}
                    {m.enCurso ? <span className="ml-1.5 text-xs font-normal text-warn">en curso</span> : null}
                  </th>
                  <td className="border-b border-line px-3 py-1.5 text-ink-2">{etiquetaMesAnio(m.corteBase)}</td>
                  <td className="num border-b border-line px-3 py-1.5 text-right text-ink-2">{num.format(m.pronostico)}</td>
                  <td className="num border-b border-line px-3 py-1.5 text-right text-ink">{num.format(m.real)}</td>
                  <td className={cn("num border-b border-line px-3 py-1.5 text-right font-semibold", m.enCurso ? "text-ink-3 italic" : COLOR_ESTADO[m.estado])}>
                    {m.ratio === null ? "–" : pct.format(m.ratio)}
                  </td>
                  <td className="num border-b border-line px-3 py-1.5 text-right text-ink-3">{m.realSinPronostico > 0 ? num.format(m.realSinPronostico) : "·"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="rotulo mb-2 text-ink-2">
            {etiquetaMesAnio(actual.mes)} por cliente · contra el corte de {etiquetaMesAnio(actual.corteBase)}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr className="text-ink-2">
                  {["Cliente", "Vendedor", "Pronosticado", "Real + avance", "Desvío", "Cumplimiento", "Estado"].map((t, i) => (
                    <th key={t} scope="col" className={cn("rotulo border-b border-line-strong bg-surface-2 px-3 py-2", i < 2 || i === 6 ? "text-left" : "text-right")}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => {
                  const e = ETIQUETA_CLIENTE[c.estado];
                  return (
                    <tr key={c.cuenta}>
                      <th scope="row" className="max-w-[18rem] truncate border-b border-line px-3 py-1.5 text-left font-medium text-ink" title={c.cuenta}>{c.cuenta}</th>
                      <td className="border-b border-line px-3 py-1.5 text-ink-2">{c.propietario}</td>
                      <td className="num border-b border-line px-3 py-1.5 text-right text-ink-2">{num.format(c.pronostico)}</td>
                      <td className="num border-b border-line px-3 py-1.5 text-right text-ink">{num.format(c.real)}</td>
                      <td className={cn("num border-b border-line px-3 py-1.5 text-right", c.desvio < 0 ? "text-bad" : "text-ink-2")}>{signo.format(c.desvio)}</td>
                      <td className="num border-b border-line px-3 py-1.5 text-right text-ink">{c.ratio === null ? "–" : pct.format(c.ratio)}</td>
                      <td className={cn("border-b border-line px-3 py-1.5 font-medium", e.clase)}>{e.texto}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {actual.clientes.length > LIMITE_FILAS ? (
            <button type="button" onClick={() => setVerTodos((v) => !v)} className="mt-2 text-xs font-medium text-accent hover:underline">
              {verTodos ? "Ver solo los de mayor desvío" : `Ver los ${actual.clientes.length} clientes`}
            </button>
          ) : null}
        </div>
      </div>
    </details>
  );
}
