"use client";

import { CalendarDays, Inbox } from "lucide-react";
import { Fragment, useRef, useState, type KeyboardEvent } from "react";

import { interpretarCantidad, textoCantidad } from "@/lib/cantidad";
import { estadoPorRatio, formatearNumero, formatearPorcentaje } from "@/lib/mrp-utils";
import { abarcaVariosAnios, etiquetaMes, etiquetaMesAnio, nombreMes } from "@/lib/periodos";
import { etiquetaSemana, revisionSemanal, semanaDeFecha, semanasDelMes, totalesSemanales } from "@/lib/semanas";
import type { MesKey, RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ESTILOS_ESTADO, EstadoPastilla } from "./Semaforo";
import { useSoloLectura } from "./ui/SoloLectura";

interface PropsSemanal {
  /** Registros de la vista actual (respetan filtros, semáforo y unidad de visualización). */
  registros: RegistroMRP[];
  /** Meses del periodo hasta el mes elegido. */
  meses: MesKey[];
  alActualizarRealSemana: (id: string, mes: MesKey, semana: number, valor?: number) => void;
}

const POR_PAGINA = 60;

const TH = "rotulo sticky top-0 z-10 border-b border-line-strong bg-surface-2 px-3 py-2 text-ink-2";
const TD = "border-b border-line px-3 py-1.5";
const TD_NUM = `${TD} num text-right`;

function Avance({ real, pronostico }: { real: number | undefined; pronostico: number | undefined }) {
  if (real === undefined || !pronostico) return null;
  const ratio = real / pronostico;
  return (
    <span className={cn("num block text-right text-xs font-semibold", ESTILOS_ESTADO[estadoPorRatio(ratio)].texto)}>
      {formatearPorcentaje(ratio)}
    </span>
  );
}

/** Revisión de un mes semana por semana: pronóstico repartido y real de cada semana. */
export function SeguimientoSemanal({ registros, meses, alActualizarRealSemana }: PropsSemanal) {
  const soloLectura = useSoloLectura();
  const [mesElegido, setMesElegido] = useState<MesKey | "">("");
  const [soloConDatos, setSoloConDatos] = useState(true);
  const [limite, setLimite] = useState(POR_PAGINA);
  const contenedor = useRef<HTMLDivElement>(null);

  // Por defecto, el mes de la semana en curso (si está en el periodo); si no, el último.
  const actual = semanaDeFecha(new Date());
  const mes = meses.includes(mesElegido) ? mesElegido : meses.includes(actual.mes) ? actual.mes : (meses.at(-1) ?? "");
  if (!mes) return null;

  const rotulo = abarcaVariosAnios(meses) ? etiquetaMesAnio : etiquetaMes;
  const semanas = semanasDelMes(mes);
  const enCurso = mes === actual.mes ? actual.indice : -1;
  const dias = (i: number) => etiquetaSemana(semanas[i]);

  const visibles = soloConDatos
    ? registros.filter((r) => r.proyecciones[mes] !== undefined || r.reales[mes] !== undefined)
    : registros;
  const totales = totalesSemanales(registros, mes);

  /** Guarda la cifra de una semana; si no es válida o no cambió, restaura la anterior. */
  const guardar = (registro: RegistroMRP, indice: number, entrada: HTMLInputElement) => {
    const { semanas: actuales, totalSinDetalle } = revisionSemanal(registro, mes);
    const actual = actuales[indice];
    if (entrada.value.trim() === textoCantidad(actual)) return;
    const nuevo = interpretarCantidad(entrada.value, actual);
    if (
      nuevo === null ||
      nuevo === actual ||
      (totalSinDetalle &&
        !window.confirm(
          `«${registro.cuenta}» tiene ${formatearNumero(registro.reales[mes])} ${registro.unidadMedida} cargados como total ` +
            `de ${nombreMes(mes)}, sin semanas. Ese total se reemplazará por la suma de lo que escriba por semana. ¿Continuar?`,
        ))
    ) {
      entrada.value = textoCantidad(actual);
      return;
    }
    alActualizarRealSemana(registro.id, mes, indice, nuevo);
  };

  /** Enter guarda y baja a la misma semana de la fila siguiente (Shift: sube); Escape descarta. */
  const manejarTeclas = (evento: KeyboardEvent<HTMLInputElement>, original: string) => {
    const entrada = evento.currentTarget;
    if (evento.key === "Escape") {
      entrada.value = original;
      entrada.blur();
    }
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    const columna = Array.from(
      contenedor.current?.querySelectorAll<HTMLInputElement>(`input[data-semana="${entrada.dataset.semana}"]`) ?? [],
    );
    const siguiente = columna[columna.indexOf(entrada) + (evento.shiftKey ? -1 : 1)];
    if (siguiente) {
      siguiente.focus();
      siguiente.select();
    } else {
      entrada.blur();
    }
  };

  return (
    <section aria-label="Seguimiento semanal" className="rounded-xl border border-line bg-surface shadow-card">
      <header className="flex flex-col gap-3 border-b border-line p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CalendarDays className="size-4 text-accent" />
            Seguimiento semanal · {nombreMes(mes)}
          </h3>
          <p className="mt-0.5 text-xs text-ink-3">
            El pronóstico del mes se reparte entre sus {semanas.length} semanas (lunes a domingo), como en el Excel.{" "}
            {soloLectura
              ? "Este corte es de solo lectura."
              : "Escribe el real de cada semana y pulsa Enter: el total del mes es la suma."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div role="radiogroup" aria-label="Mes a revisar" className="inline-flex flex-wrap rounded-lg border border-line-strong bg-surface p-0.5">
            {meses.map((clave) => (
              <button
                key={clave}
                type="button"
                role="radio"
                aria-checked={clave === mes}
                onClick={() => setMesElegido(clave)}
                title={nombreMes(clave)}
                className={cn(
                  "h-7 min-w-12 rounded-md px-3 text-xs font-semibold transition-colors",
                  clave === mes ? "bg-accent text-accent-ink shadow-sm" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                )}
              >
                {rotulo(clave)}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={soloConDatos}
              onChange={(evento) => setSoloConDatos(evento.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Solo con pronóstico o real en el mes
          </label>
        </div>
      </header>

      {totales.length > 0 ? (
        <div className="overflow-x-auto border-b border-line">
          <table aria-label="Resumen semanal por unidad" className="w-full min-w-[40rem] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className={cn(TH, "text-left")}>Resumen por UM</th>
                {semanas.map((_, i) => (
                  <th key={i} className={cn(TH, "text-right", i === enCurso && "bg-accent-soft text-accent")}>
                    Sem. {i + 1}
                    <span className="block font-normal normal-case">{dias(i)}</span>
                  </th>
                ))}
                <th className={cn(TH, "text-right")}>Mes</th>
              </tr>
            </thead>
            <tbody>
              {totales.map((t) => (
                <Fragment key={t.unidad}>
                  <tr>
                    <th scope="row" className={cn(TD, "text-left font-medium text-ink-2")}>
                      {t.unidad} · pronóstico
                    </th>
                    {semanas.map((_, i) => (
                      <td key={i} className={cn(TD_NUM, "text-ink-2")}>
                        {formatearNumero(t.pronosticoSemana)}
                      </td>
                    ))}
                    <td className={cn(TD_NUM, "text-ink-2")}>{formatearNumero(t.pronostico)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className={cn(TD, "text-left font-semibold text-ink")}>
                      {t.unidad} · real
                      {t.sinDetalle > 0 ? (
                        <span className="block text-xs font-normal text-ink-3">
                          incluye {formatearNumero(t.sinDetalle)} sin detalle semanal
                        </span>
                      ) : null}
                    </th>
                    {t.semanas.map((v, i) => (
                      <td key={i} className={cn(TD_NUM, "font-semibold")}>
                        {formatearNumero(v)}
                        <Avance real={v} pronostico={t.pronosticoSemana} />
                      </td>
                    ))}
                    <td className={cn(TD_NUM, "font-semibold")}>
                      {formatearNumero(t.real)}
                      <Avance real={t.real} pronostico={t.pronostico} />
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div ref={contenedor} className="max-h-[min(68vh,46rem)] overflow-auto">
        <table aria-label="Real semanal por cliente" className="w-full min-w-[60rem] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left">
              <th className={TH}>Propietario</th>
              <th className={TH}>Cliente</th>
              <th className={TH}>Producto</th>
              <th className={TH}>UM</th>
              <th className={cn(TH, "text-right")}>Pron. mes</th>
              <th className={cn(TH, "text-right")}>Pron. por semana</th>
              {semanas.map((_, i) => (
                <th key={i} className={cn(TH, "w-28 text-right", i === enCurso && "bg-accent-soft text-accent")} title={dias(i)}>
                  Real sem. {i + 1}
                </th>
              ))}
              <th className={cn(TH, "text-right")}>Real mes</th>
              <th className={TH} title="Real contra el pronóstico acumulado hasta la última semana cargada">
                Cumplimiento
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={semanas.length + 8} className="px-4 py-14 text-center">
                  <Inbox className="mx-auto mb-3 size-8 text-line-strong" />
                  <p className="text-sm font-medium text-ink">No hay registros que coincidan</p>
                  <p className="mt-1 text-xs text-ink-3">Ajusta los filtros o el mes.</p>
                </td>
              </tr>
            ) : (
              visibles.slice(0, limite).map((registro) => {
                const r = revisionSemanal(registro, mes);
                return (
                  <tr key={registro.id} className="hover:bg-surface-2/60">
                    <td className={cn(TD, "max-w-[9rem] truncate text-ink-2")} title={registro.propietario}>
                      {registro.propietario || "—"}
                    </td>
                    <td className={cn(TD, "max-w-[16rem] truncate font-medium")} title={registro.cuenta}>
                      {registro.cuenta || "—"}
                    </td>
                    <td className={cn(TD, "max-w-[11rem] truncate")} title={registro.detalleProducto}>
                      {registro.detalleProducto}
                    </td>
                    <td className={cn(TD, "text-ink-2")}>{registro.unidadMedida}</td>
                    <td className={TD_NUM}>{formatearNumero(registro.proyecciones[mes])}</td>
                    <td className={cn(TD_NUM, "text-ink-3")}>{formatearNumero(r.pronosticoSemana)}</td>
                    {r.semanas.map((valor, i) => (
                      <td key={i} className={cn("border-b border-line px-2 py-1 align-top", i === enCurso && "bg-accent-soft/35")}>
                        <input
                          key={`${registro.id}-${mes}-${i}-${valor ?? "sin"}`}
                          data-semana={i}
                          inputMode="decimal"
                          defaultValue={textoCantidad(valor)}
                          placeholder="—"
                          disabled={soloLectura}
                          aria-label={`Real semana ${i + 1} de ${nombreMes(mes)} · ${registro.cuenta} · ${registro.detalleProducto}`}
                          onFocus={(evento) => evento.currentTarget.select()}
                          onBlur={(evento) => guardar(registro, i, evento.currentTarget)}
                          onKeyDown={(evento) => manejarTeclas(evento, textoCantidad(valor))}
                          className="num h-8 w-full min-w-20 rounded-md border border-field bg-surface px-2 text-right text-sm text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <Avance real={valor} pronostico={r.pronosticoSemana} />
                      </td>
                    ))}
                    <td className={cn(TD_NUM, "font-semibold")}>
                      {formatearNumero(registro.reales[mes])}
                      {r.totalSinDetalle ? <span className="block text-xs font-normal text-ink-3">sin semanas</span> : null}
                    </td>
                    <td className={TD}>
                      <EstadoPastilla estado={r.estado} ratio={r.ratio} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {visibles.length > limite ? (
          <div className="border-t border-line p-3 text-center">
            <button
              type="button"
              onClick={() => setLimite((previo) => previo + POR_PAGINA)}
              className="h-9 rounded-lg border border-line-strong px-4 text-sm font-medium text-ink hover:bg-surface-2"
            >
              Mostrar más ({visibles.length - limite} restantes)
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
