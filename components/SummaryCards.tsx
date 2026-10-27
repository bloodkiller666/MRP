"use client";

import { ANIO_PRONOSTICO, ETIQUETAS_ESTADO, MESES, REGLA_ESTADO } from "@/lib/constants";
import {
  etiquetaPeriodo,
  formatearCompacto,
  formatearNumero,
  formatearPorcentaje,
  mesesHasta,
  resumirPeriodo,
  totalesPorUnidad,
} from "@/lib/mrp-utils";
import type { EstadoCumplimiento, MesKey, RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

import { BarraCumplimiento, ESTILOS_ESTADO, EstadoPastilla } from "./Semaforo";

interface TarjetasResumenProps {
  /** Registros de la vista actual (con todos los filtros, incluido el semáforo). */
  registros: RegistroMRP[];
  /** Registros con todos los filtros salvo el semáforo: base de los contadores. */
  registrosParaSemaforo: RegistroMRP[];
  hasta: MesKey;
  estadoFiltro: EstadoCumplimiento | "";
  alCambiarEstado: (estado: EstadoCumplimiento | "") => void;
}

const ESTADOS_FILTRABLES: EstadoCumplimiento[] = ["verde", "amarillo", "rojo", "sin-real"];

/** Contenedor común de las tarjetas: borde fino, sin sombras. */
function Tarjeta({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card", className)}>
      <h3 className="rotulo text-ink-2">{titulo}</h3>
      {children}
    </article>
  );
}

/** Fila superior de indicadores del periodo: demanda, real + avance, cumplimiento y semáforo. */
export function SummaryCards({
  registros,
  registrosParaSemaforo,
  hasta,
  estadoFiltro,
  alCambiarEstado,
}: TarjetasResumenProps) {
  const meses = mesesHasta(hasta);
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
  const mesesVisibles = MESES.filter((mes) => meses.includes(mes.key));
  const conRealCargado = registros.filter((r) => meses.some((mes) => r.reales[mes] !== undefined)).length;

  return (
    <section
      aria-label={`Indicadores del periodo ${etiquetaPeriodo(hasta, ANIO_PRONOSTICO)}`}
      className="grid grid-cols-2 gap-3 xl:grid-cols-[1.35fr_1fr_1fr_1.1fr]"
    >
      {/* Demanda ------------------------------------------------------------ */}
      <Tarjeta titulo="Total demanda pronosticada" className="col-span-2 sm:col-span-2 xl:col-span-1">
        <div
          className={cn(
            "mt-2 grid gap-x-6 gap-y-4",
            porUnidad.length > 1 ? "grid-cols-1 min-[420px]:grid-cols-2" : "grid-cols-1",
          )}
        >
          {porUnidad.length === 0 ? (
            <p className="num text-[1.75rem] leading-none font-semibold text-ink">–</p>
          ) : (
            porUnidad.map(({ unidad, registros: cantidad, resumen: r }) => {
              const maximoMes = Math.max(...mesesVisibles.map((mes) => r.porMes[mes.key].demanda), 0);
              return (
                <div key={unidad} className="min-w-0">
                  <p className="flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "num leading-none font-semibold tracking-tight text-ink",
                        porUnidad.length > 1 ? "text-[1.5rem]" : "text-[1.75rem]",
                      )}
                    >
                      {formatearNumero(r.demanda)}
                    </span>
                    <span className="text-xs font-semibold text-ink-2">{unidad}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-3">{cantidad} registros</p>
                  <div className="mt-3 grid auto-cols-fr grid-flow-col gap-2.5">
                    {mesesVisibles.map((mes) => {
                      const valor = r.porMes[mes.key].demanda;
                      return (
                        <div key={mes.key}>
                          <p className="rotulo text-ink-3">{mes.label}</p>
                          <p className="num text-xs font-medium text-ink">{formatearCompacto(valor)}</p>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-surface-3">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${maximoMes > 0 ? (valor / maximoMes) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Tarjeta>

      {/* Real + avance ------------------------------------------------------- */}
      <Tarjeta titulo="Real + avance" className="col-span-2 sm:col-span-1">
        <p className="num mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[1.75rem] leading-none font-semibold tracking-tight text-ink">
          {resumen.ratio === null
            ? "–"
            : porUnidad
                .filter((u) => u.resumen.ratio !== null)
                .map((u) => (
                  <span key={u.unidad}>
                    {formatearNumero(u.resumen.real)}
                    <span className="ml-1.5 text-xs font-semibold text-ink-2">{u.unidad}</span>
                  </span>
                ))}
        </p>
        <p className="mt-1.5 text-xs text-ink-2">
          {conRealCargado === 0 ? (
            "Aún no hay despacho cargado en el periodo"
          ) : (
            <>
              <span className="num font-semibold text-ink">{conRealCargado}</span> de {registros.length}{" "}
              registros con despacho cargado
            </>
          )}
        </p>
        <p className="mt-auto pt-4 text-[11px] leading-snug text-ink-3">
          Despacho de meses cerrados + avance del mes en curso. Se carga con doble clic en la columna «Real»
          o importando un Excel.
        </p>
      </Tarjeta>

      {/* Cumplimiento --------------------------------------------------------- */}
      <Tarjeta titulo="Cumplimiento global" className="col-span-2 sm:col-span-1">
        <div className="mt-2 flex items-center gap-3">
          <p
            className={cn(
              "num text-[1.75rem] leading-none font-semibold tracking-tight",
              ESTILOS_ESTADO[resumen.estado].texto,
            )}
          >
            {formatearPorcentaje(resumen.ratio)}
          </p>
          <EstadoPastilla estado={resumen.estado} />
        </div>
        <BarraCumplimiento estado={resumen.estado} ratio={resumen.ratio} className="mt-3 h-2" />
        <p className="mt-2 text-xs text-ink-2">
          {resumen.ratio === null
            ? "Se calcula cuando haya real + avance cargado."
            : "Sobre los registros que ya reportan real."}
        </p>
        <p className="mt-auto pt-3 text-[11px] text-ink-3">
          Verde {REGLA_ESTADO.verde} · Amarillo {REGLA_ESTADO.amarillo} · Rojo {REGLA_ESTADO.rojo}
        </p>
      </Tarjeta>

      {/* Semáforo (también filtra) ------------------------------------------- */}
      <Tarjeta titulo="Semáforo · clic para filtrar" className="col-span-2 sm:col-span-2 xl:col-span-1">
        <ul className="mt-2.5 flex flex-col gap-1">
          {ESTADOS_FILTRABLES.map((estado) => {
            const activo = estadoFiltro === estado;
            const { punto, texto } = ESTILOS_ESTADO[estado];
            return (
              <li key={estado}>
                <button
                  type="button"
                  aria-pressed={activo}
                  onClick={() => alCambiarEstado(activo ? "" : estado)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-[13px] transition-colors",
                    activo ? "bg-accent-soft ring-1 ring-accent" : "hover:bg-surface-2",
                  )}
                >
                  <span className={cn("size-2.5 shrink-0 rounded-full", punto)} aria-hidden />
                  <span className={cn("font-medium", estado === "sin-real" ? "text-ink-2" : texto)}>
                    {ETIQUETAS_ESTADO[estado]}
                  </span>
                  <span className="hidden text-xs text-ink-3 2xl:inline">{REGLA_ESTADO[estado]}</span>
                  <span className="num ml-auto font-semibold text-ink">{conteos[estado]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Tarjeta>
    </section>
  );
}

/** Selector segmentado «Pronóstico hasta» (de octubre al mes elegido). */
export function SelectorPeriodo({
  hasta,
  alCambiar,
}: {
  hasta: MesKey;
  alCambiar: (mes: MesKey) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="rotulo hidden text-ink-2 sm:inline">Pronóstico hasta</span>
      <div
        role="radiogroup"
        aria-label="Pronóstico hasta el mes"
        className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5"
      >
        {MESES.map((mes) => {
          const activo = mes.key === hasta;
          return (
            <button
              key={mes.key}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => alCambiar(mes.key)}
              title={`Ver el pronóstico de octubre hasta ${mes.nombre.toLowerCase()}`}
              className={cn(
                "h-7 min-w-12 rounded-md px-3 text-xs font-semibold transition-colors",
                activo ? "bg-accent text-accent-ink shadow-sm" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
              )}
            >
              {mes.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
