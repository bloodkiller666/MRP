"use client";

import { Plus } from "lucide-react";

import { ETIQUETAS_ESTADO, REGLA_ESTADO, UMBRAL_AMARILLO, UMBRAL_VERDE } from "@/lib/constants";
import { formatearNumero, formatearPorcentaje, resumirPeriodo, totalesPorUnidad } from "@/lib/mrp-utils";
import { abarcaVariosAnios, etiquetaMes, etiquetaMesAnio, etiquetaRango, mesesDePeriodo, nombreMes } from "@/lib/periodos";
import type { EstadoCumplimiento, MesKey, Periodo, RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ESTILOS_ESTADO, EstadoPastilla } from "./Semaforo";

interface TarjetasResumenProps {
  /** Registros de la vista actual (con todos los filtros, incluido el semáforo). */
  registros: RegistroMRP[];
  /** Registros con todos los filtros salvo el semáforo: base de los contadores. */
  registrosParaSemaforo: RegistroMRP[];
  /** Meses del periodo que se resumen (hasta el mes elegido). */
  meses: MesKey[];
  estadoFiltro: EstadoCumplimiento | "";
  alCambiarEstado: (estado: EstadoCumplimiento | "") => void;
}

const ESTADOS_FILTRABLES: EstadoCumplimiento[] = ["verde", "amarillo", "rojo", "sin-real"];

/**
 * Barra de cumplimiento con las dos líneas de corte del semáforo (70 % y 90 %) marcadas sobre
 * la propia barra, como las marcas de una calzada: se lee el color y también cuánto falta para
 * el siguiente nivel.
 */
function BarraConUmbrales({ estado, ratio }: { estado: EstadoCumplimiento; ratio: number | null }) {
  const ancho = ratio === null ? 0 : Math.min(ratio, 1) * 100;
  const cortes = [UMBRAL_AMARILLO, UMBRAL_VERDE];
  return (
    <div className="mt-3">
      <div className="relative h-2.5 rounded-full bg-surface-3">
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", ESTILOS_ESTADO[estado].barra)}
          style={{ width: `${ancho}%` }}
        />
        {cortes.map((corte) => (
          <span
            key={corte}
            aria-hidden
            className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-ink-2/70"
            style={{ left: `${corte * 100}%` }}
          />
        ))}
      </div>
      <div className="relative mt-1 h-4 text-xs text-ink-3" aria-hidden>
        {cortes.map((corte) => (
          <span key={corte} className="num absolute -translate-x-1/2" style={{ left: `${corte * 100}%` }}>
            {Math.round(corte * 100)} %
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Tira de indicadores del periodo: cumplimiento global (lo que decide), demanda y real por unidad
 * de medida, y el semáforo, que además filtra la tabla. Ocupa poca altura para que la tabla
 * empiece lo más arriba posible.
 */
export function SummaryCards({
  registros,
  registrosParaSemaforo,
  meses,
  estadoFiltro,
  alCambiarEstado,
}: TarjetasResumenProps) {
  const resumen = resumirPeriodo(registros, meses);
  const conteos = resumirPeriodo(registrosParaSemaforo, meses).porEstado;
  // Cada unidad de medida se resume por separado: no se suman galones con kilos.
  const porUnidad = totalesPorUnidad(registros, meses).map(({ unidad, registros: cantidad }) => ({
    unidad,
    registros: cantidad,
    resumen: resumirPeriodo(
      registros.filter((r) => (r.unidadMedida.trim() || "s/UM") === unidad),
      meses,
    ),
  }));
  const conRealCargado = registros.filter((r) => meses.some((mes) => r.reales[mes] !== undefined)).length;

  return (
    <section
      aria-label={`Indicadores del periodo ${etiquetaRango(meses)}`}
      className="grid divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card lg:grid-cols-[minmax(18rem,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)] lg:divide-x lg:divide-y-0"
    >
      {/* Cumplimiento --------------------------------------------------------- */}
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="rotulo text-ink-2">Cumplimiento global</h3>
          <EstadoPastilla estado={resumen.estado} />
        </div>
        <p
          className={cn(
            "num mt-1 text-[2.5rem] leading-none font-semibold tracking-tight",
            ESTILOS_ESTADO[resumen.estado].texto,
          )}
        >
          {formatearPorcentaje(resumen.ratio)}
        </p>
        <BarraConUmbrales estado={resumen.estado} ratio={resumen.ratio} />
        <p className="text-xs text-ink-2">
          {resumen.ratio === null
            ? "Se calcula cuando haya real + avance cargado."
            : "Sobre los registros que ya reportan real."}
        </p>
      </div>

      {/* Demanda y real ------------------------------------------------------- */}
      <div className="px-4 py-3.5">
        <h3 className="rotulo text-ink-2">Demanda y real por unidad</h3>
        {porUnidad.length === 0 ? (
          <p className="num mt-2 text-2xl font-semibold text-ink">–</p>
        ) : (
          <table className="mt-1.5 w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-3">
                <th scope="col" className="py-1 text-left font-medium">
                  <span className="sr-only">Unidad</span>
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Pronóstico
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Real + avance
                </th>
              </tr>
            </thead>
            <tbody>
              {porUnidad.map(({ unidad, registros: cantidad, resumen: r }) => (
                <tr key={unidad} className="border-t border-line">
                  <th scope="row" className="py-1.5 text-left font-semibold text-ink-2">
                    {unidad}
                    <span className="block text-xs font-normal text-ink-3">{cantidad} registros</span>
                  </th>
                  <td className="num py-1.5 text-right text-lg font-semibold text-ink">{formatearNumero(r.demanda)}</td>
                  <td className="num py-1.5 text-right text-lg font-semibold text-ink">
                    {r.ratio === null ? <span className="font-normal text-ink-3">–</span> : formatearNumero(r.real)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-1.5 text-xs text-ink-2">
          {conRealCargado === 0 ? (
            <>
              Aún no hay despacho cargado. Se carga en la pestaña <strong className="font-semibold">Cargar real</strong>.
            </>
          ) : (
            <>
              <span className="num font-semibold text-ink">{conRealCargado}</span> de {registros.length} registros con
              despacho cargado
            </>
          )}
        </p>
      </div>

      {/* Semáforo (también filtra) -------------------------------------------- */}
      <div className="px-4 py-3.5">
        <h3 className="rotulo text-ink-2">Semáforo · clic para filtrar</h3>
        <ul className="mt-2 grid grid-cols-2 gap-1.5">
          {ESTADOS_FILTRABLES.map((estado) => {
            const activo = estadoFiltro === estado;
            const { punto, texto } = ESTILOS_ESTADO[estado];
            return (
              <li key={estado}>
                <button
                  type="button"
                  aria-pressed={activo}
                  onClick={() => alCambiarEstado(activo ? "" : estado)}
                  title={`${ETIQUETAS_ESTADO[estado]}: ${REGLA_ESTADO[estado]}`}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                    activo ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2",
                  )}
                >
                  <span className={cn("size-2.5 shrink-0 rounded-full", punto)} aria-hidden />
                  <span className={cn("truncate font-medium", estado === "sin-real" ? "text-ink-2" : texto)}>
                    {ETIQUETAS_ESTADO[estado]}
                  </span>
                  <span className="num ml-auto font-semibold text-ink">{conteos[estado]}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-xs text-ink-3">
          Verde {REGLA_ESTADO.verde} · Amarillo {REGLA_ESTADO.amarillo} · Rojo {REGLA_ESTADO.rojo}
        </p>
      </div>
    </section>
  );
}

/** Selector de periodo (Oct – Dic 2026, Ene – Mar 2027…) y del mes hasta el que se quiere ver. */
export function SelectorPeriodo({
  periodos,
  periodoActivo,
  alElegirPeriodo,
  alCrearPeriodo,
  mesesPeriodo,
  hasta,
  alCambiar,
}: {
  periodos: Periodo[];
  periodoActivo: Periodo;
  alElegirPeriodo: (periodo: Periodo) => void;
  alCrearPeriodo: () => void;
  mesesPeriodo: MesKey[];
  hasta: MesKey;
  alCambiar: (mes: MesKey) => void;
}) {
  const idDe = (p: Periodo) => `${p.desde}/${p.cantidad}`;
  const rotulo = abarcaVariosAnios(mesesPeriodo) ? etiquetaMesAnio : etiquetaMes;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor="selector-periodo" className="rotulo text-ink-2">
          Periodo
        </label>
        <select
          id="selector-periodo"
          value={idDe(periodoActivo)}
          onChange={(evento) => {
            const elegido = periodos.find((p) => idDe(p) === evento.target.value);
            if (elegido) alElegirPeriodo(elegido);
          }}
          className="h-9 cursor-pointer rounded-lg border border-field bg-surface px-2.5 text-sm font-medium text-ink"
        >
          {periodos.map((p) => (
            <option key={idDe(p)} value={idDe(p)}>
              {etiquetaRango(mesesDePeriodo(p))}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={alCrearPeriodo}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Plus className="size-3.5" />
          Nuevo periodo
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="rotulo hidden text-ink-2 sm:inline">Pronóstico hasta</span>
        <div
          role="radiogroup"
          aria-label="Pronóstico hasta el mes"
          className="inline-flex max-w-full flex-wrap rounded-lg border border-line-strong bg-surface p-0.5"
        >
          {mesesPeriodo.map((mes) => {
            const activo = mes === hasta;
            return (
              <button
                key={mes}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => alCambiar(mes)}
                title={`Ver el pronóstico de ${nombreMes(mesesPeriodo[0]).toLowerCase()} hasta ${nombreMes(mes).toLowerCase()}`}
                className={cn(
                  "h-7 min-w-12 rounded-md px-3 text-xs font-semibold transition-colors",
                  activo ? "bg-accent text-accent-ink shadow-sm" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                )}
              >
                {rotulo(mes)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
