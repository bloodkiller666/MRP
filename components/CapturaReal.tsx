"use client";

import { CheckCircle2, ClipboardPenLine, Inbox } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { cumplimientoRegistro, formatearNumero, resumenPorUnidad } from "@/lib/mrp-utils";
import {
  abarcaVariosAnios,
  claveMes,
  etiquetaMes,
  etiquetaMesAnio,
  lunesDelMes,
  nombreMes,
} from "@/lib/periodos";
import type { MesKey, RegistroMRP } from "@/lib/types";
import { cn, parsearNumero } from "@/lib/utils";

import { EstadoPastilla } from "./Semaforo";

/** Qué se está cargando: el despacho real o el pronóstico (con su probabilidad). */
type Modo = "real" | "pron";

interface PropsCaptura {
  /** Registros de la vista actual (respetan filtros, semáforo y unidad de visualización). */
  registros: RegistroMRP[];
  /** Meses del periodo hasta el mes elegido. */
  meses: MesKey[];
  alActualizarReal: (id: string, mes: MesKey, valor?: number) => void;
  alActualizarProyeccion: (id: string, mes: MesKey, valor?: number) => void;
  alActualizarProbabilidad: (id: string, probabilidad?: number) => void;
  alActualizarComentario: (id: string, comentario: string) => void;
}

const POR_PAGINA = 60;

const TH_BASE = "rotulo sticky top-0 z-10 border-b border-line-strong px-3 py-2";
const CLASES_CAJA =
  "num h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-right text-sm text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

/**
 * Interpreta lo escrito en una caja de cantidad.
 *
 *  - `1500`        → 1500
 *  - `30+30+60`    → 120 (suma de despachos, como el total semanal del Excel)
 *  - `+30`         → lo ya cargado + 30 (añade un despacho al acumulado)
 *
 * Devuelve `null` si el texto no es válido y `undefined` si está vacío (borra el dato).
 */
function interpretarCantidad(texto: string, actual: number | undefined): number | null | undefined {
  const limpio = texto.trim();
  if (limpio === "") return undefined;

  const acumula = limpio.startsWith("+");
  const partes = (acumula ? limpio.slice(1) : limpio).split("+");
  let suma = acumula ? (actual ?? 0) : 0;
  for (const parte of partes) {
    const numero = parsearNumero(parte);
    if (numero === undefined || numero < 0) return null;
    suma += numero;
  }
  return Math.round(suma * 100) / 100;
}

function textoCantidad(valor: number | undefined): string {
  return valor === undefined ? "" : String(Math.round(valor * 100) / 100);
}

function textoProbabilidad(valor: number | undefined): string {
  return valor === undefined ? "" : String(Math.round(valor * 100));
}

/**
 * Carga de pronóstico y despacho real, sin pasar por Excel.
 *
 * Se elige qué cargar (real o pronóstico) y el mes, y se escribe la cifra de cada cliente:
 * **Enter** guarda y baja a la fila siguiente; al salir de la caja también se guarda. El
 * cumplimiento y el semáforo se recalculan al instante porque leen del mismo almacén que la tabla.
 *
 * El pronóstico admite una probabilidad de cierre: al cambiarla se recalcula el pronóstico de
 * la fila (volumen × PROB), igual que las fórmulas del Excel.
 */
export function CapturaReal({
  registros,
  meses,
  alActualizarReal,
  alActualizarProyeccion,
  alActualizarProbabilidad,
  alActualizarComentario,
}: PropsCaptura) {
  const [modo, setModo] = useState<Modo>("real");
  const [mesElegido, setMesElegido] = useState<MesKey | "">("");
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  // Por defecto se captura el mes en curso (si está en el periodo); si no, el último.
  const hoy = new Date();
  const mesActual = claveMes(hoy.getFullYear(), hoy.getMonth());
  const mes = meses.includes(mesElegido)
    ? mesElegido
    : meses.includes(mesActual)
      ? mesActual
      : (meses[meses.length - 1] ?? "");
  const rotulo = abarcaVariosAnios(meses) ? etiquetaMesAnio : etiquetaMes;
  const semanas = mes ? lunesDelMes(mes) : 4;
  const esReal = modo === "real";

  const campo = esReal ? "reales" : "proyecciones";
  const cargados = registros.filter((r) => r[campo][mes] !== undefined).length;
  const visibles = useMemo(
    () => (soloPendientes ? registros.filter((r) => r[campo][mes] === undefined) : registros),
    [registros, soloPendientes, mes, campo],
  );
  const porUnidad = useMemo(() => resumenPorUnidad(registros, [mes]), [registros, mes]);

  const marcarGuardado = (registro: RegistroMRP) =>
    setUltimoGuardado(registro.cuenta || registro.detalleProducto);

  /** Guarda la cantidad escrita; si no es válida, restaura el valor anterior. */
  const guardarCantidad = (registro: RegistroMRP, entrada: HTMLInputElement) => {
    const actual = registro[campo][mes];
    const nuevo = interpretarCantidad(entrada.value, actual);

    if (nuevo === null || nuevo === actual) {
      entrada.value = textoCantidad(actual);
      return;
    }
    (esReal ? alActualizarReal : alActualizarProyeccion)(registro.id, mes, nuevo);
    marcarGuardado(registro);
  };

  /** Probabilidad escrita como 40 (%) o 0,4; vacío o 100 = sin ponderar. Recalcula el pronóstico de la fila. */
  const guardarProbabilidad = (registro: RegistroMRP, entrada: HTMLInputElement) => {
    const texto = entrada.value.trim();
    const actual = registro.probabilidad;

    if (texto === "") {
      if (actual !== undefined) {
        alActualizarProbabilidad(registro.id, undefined);
        marcarGuardado(registro);
      }
      return;
    }
    const numero = parsearNumero(texto);
    const fraccion = numero === undefined ? undefined : numero > 1 ? numero / 100 : numero;
    if (fraccion === undefined || fraccion <= 0 || fraccion > 1 || fraccion === (actual ?? 1)) {
      entrada.value = textoProbabilidad(actual);
      return;
    }
    alActualizarProbabilidad(registro.id, fraccion >= 1 ? undefined : fraccion);
    marcarGuardado(registro);
  };

  /** Mueve el foco a la misma columna de la fila siguiente (o anterior con Shift). */
  const moverFoco = (entrada: HTMLInputElement, retroceder: boolean) => {
    const cajas = Array.from(
      contenedor.current?.querySelectorAll<HTMLInputElement>(`input[data-col="${entrada.dataset.col}"]`) ?? [],
    );
    const siguiente = cajas[cajas.indexOf(entrada) + (retroceder ? -1 : 1)];
    siguiente?.focus();
    siguiente?.select();
  };

  /** Teclas comunes de las cajas: Enter guarda y baja; Escape descarta. */
  const manejarTeclas = (
    evento: KeyboardEvent<HTMLInputElement>,
    guardar: (entrada: HTMLInputElement) => void,
    original: string,
  ) => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      guardar(evento.currentTarget);
      moverFoco(evento.currentTarget, evento.shiftKey);
    } else if (evento.key === "Escape") {
      evento.currentTarget.value = original;
      evento.currentTarget.blur();
    }
  };

  return (
    <section className="rounded-xl border border-line bg-surface shadow-card">
      <header className="flex flex-col gap-3 border-b border-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ClipboardPenLine className="size-4 text-accent" />
              {esReal ? "Cargar despacho real / avance" : "Cargar y recalcular pronóstico"}
            </h3>
            <p className="mt-0.5 text-xs text-ink-3">
              Escribe la cifra y pulsa <kbd className="font-sans font-semibold">Enter</kbd>: se guarda al instante y
              el semáforo se actualiza.{" "}
              {esReal
                ? "Puedes sumar despachos («30+30+60») o añadir al acumulado («+30»). "
                : "Al cambiar la probabilidad, el pronóstico de la fila se recalcula (volumen × PROB). "}
              También puedes importar desde Excel.
            </p>
          </div>
          <p
            aria-live="polite"
            className={cn(
              "flex items-center gap-1.5 text-xs text-ok transition-opacity",
              ultimoGuardado ? "opacity-100" : "opacity-0",
            )}
          >
            <CheckCircle2 className="size-3.5" />
            Guardado · {ultimoGuardado}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-2.5">
            <span className="rotulo text-ink-2">Cargar</span>
            <div
              role="radiogroup"
              aria-label="Qué cargar"
              className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5"
            >
              {(
                [
                  ["real", "Real"],
                  ["pron", "Pronóstico"],
                ] as const
              ).map(([clave, etiqueta]) => (
                <button
                  key={clave}
                  type="button"
                  role="radio"
                  aria-checked={modo === clave}
                  onClick={() => setModo(clave)}
                  className={cn(
                    "h-7 rounded-md px-3 text-xs font-semibold transition-colors",
                    modo === clave
                      ? "bg-accent text-accent-ink shadow-sm"
                      : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                  )}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="rotulo text-ink-2">Mes</span>
            <div
              role="radiogroup"
              aria-label="Mes a cargar"
              className="inline-flex flex-wrap rounded-lg border border-line-strong bg-surface p-0.5"
            >
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
                    clave === mes
                      ? "bg-accent text-accent-ink shadow-sm"
                      : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                  )}
                >
                  {rotulo(clave)}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={soloPendientes}
              onChange={(evento) => setSoloPendientes(evento.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Solo pendientes de este mes
          </label>

          <p className="text-xs text-ink-3 sm:ml-auto">
            <span className="num font-semibold text-ink">{cargados}</span> de {registros.length} con{" "}
            {esReal ? "real" : "pronóstico"} cargado
            {porUnidad.map(({ unidad, resumen }) => (
              <span key={unidad} className="ml-3">
                {unidad}: {esReal ? "real" : "pron."}{" "}
                <span className="num font-semibold text-ink">
                  {formatearNumero(esReal ? resumen.porMes[mes]?.real : resumen.porMes[mes]?.demanda)}
                </span>
                {esReal ? (
                  <>
                    {" "}
                    de <span className="num">{formatearNumero(resumen.porMes[mes]?.demanda)}</span>
                  </>
                ) : null}
              </span>
            ))}
          </p>
        </div>
      </header>

      <div ref={contenedor} className="max-h-[min(68vh,46rem)] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-[13px] sm:min-w-[50rem]">
          <thead>
            <tr className="text-left">
              {["Propietario", "Cliente", "Producto", "UM"].map((titulo) => (
                <th
                  key={titulo}
                  className={cn(TH_BASE, "bg-surface-2 text-ink-2", titulo !== "Cliente" && "hidden sm:table-cell")}
                >
                  {titulo}
                </th>
              ))}
              {esReal ? (
                <>
                  <th className={cn(TH_BASE, "bg-surface-2 text-right text-ink-2")}>Pronóstico {rotulo(mes)}</th>
                  <th
                    className={cn(TH_BASE, "hidden bg-surface-2 text-right text-ink-2 md:table-cell")}
                    title={`Pronóstico del mes ÷ ${semanas} semanas (lunes del mes), como la distribución semanal del Excel`}
                  >
                    Previsto / sem.
                  </th>
                  <th className={cn(TH_BASE, "w-32 bg-accent-soft text-right text-accent sm:w-44")}>
                    Real {rotulo(mes)}
                  </th>
                </>
              ) : (
                <>
                  <th className={cn(TH_BASE, "bg-surface-2 text-right text-ink-2")}>Real {rotulo(mes)}</th>
                  <th
                    className={cn(TH_BASE, "w-24 bg-surface-2 text-right text-ink-2")}
                    title="Probabilidad de cierre (%). Vacío = 100 %. Al cambiarla se recalcula el pronóstico de la fila."
                  >
                    Prob. %
                  </th>
                  <th className={cn(TH_BASE, "w-32 bg-accent-soft text-right text-accent sm:w-44")}>
                    Pronóstico {rotulo(mes)}
                  </th>
                </>
              )}
              <th className={cn(TH_BASE, "bg-surface-2 text-ink-2")}>Cumplimiento</th>
              {!esReal ? (
                <th className={cn(TH_BASE, "hidden bg-surface-2 text-ink-2 lg:table-cell")}>Comentario</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-14 text-center">
                  <Inbox className="mx-auto mb-3 size-8 text-line-strong" />
                  <p className="text-sm font-medium text-ink">
                    {soloPendientes ? "No quedan pendientes en este mes" : "No hay registros que coincidan"}
                  </p>
                  <p className="mt-1 text-xs text-ink-3">Ajusta los filtros o el mes.</p>
                </td>
              </tr>
            ) : (
              visibles.slice(0, limite).map((registro) => {
                const c = cumplimientoRegistro(registro, meses);
                const valor = registro[campo][mes];
                const pron = registro.proyecciones[mes];
                const real = registro.reales[mes];
                const etiquetaAria = `${esReal ? "Real" : "Pronóstico"} ${nombreMes(mes)} · ${registro.cuenta} · ${registro.detalleProducto}`;
                return (
                  <tr key={registro.id} className="hover:bg-surface-2/60">
                    <td
                      className="hidden max-w-[9rem] truncate border-b border-line px-3 py-1.5 text-ink-2 sm:table-cell"
                      title={registro.propietario}
                    >
                      {registro.propietario || "—"}
                    </td>
                    <td
                      className="max-w-[16rem] border-b border-line px-3 py-1.5 font-medium sm:truncate"
                      title={registro.cuenta}
                    >
                      {registro.cuenta || "—"}
                      <span className="block text-xs font-normal text-ink-3 sm:hidden">
                        {registro.detalleProducto} · {registro.unidadMedida}
                      </span>
                    </td>
                    <td
                      className="hidden max-w-[11rem] truncate border-b border-line px-3 py-1.5 sm:table-cell"
                      title={registro.detalleProducto}
                    >
                      {registro.detalleProducto}
                    </td>
                    <td className="hidden border-b border-line px-3 py-1.5 text-ink-2 sm:table-cell">
                      {registro.unidadMedida}
                    </td>

                    {esReal ? (
                      <>
                        <td className="num border-b border-line px-3 py-1.5 text-right">{formatearNumero(pron)}</td>
                        <td className="num hidden border-b border-line px-3 py-1.5 text-right text-ink-3 md:table-cell">
                          {pron === undefined ? "–" : formatearNumero(pron / semanas)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="num border-b border-line px-3 py-1.5 text-right text-ink-2">
                          {formatearNumero(real)}
                        </td>
                        <td className="border-b border-line px-2 py-1">
                          <input
                            key={`${registro.id}-prob-${registro.probabilidad ?? "x"}`}
                            data-col="prob"
                            inputMode="decimal"
                            defaultValue={textoProbabilidad(registro.probabilidad)}
                            placeholder="100"
                            aria-label={`Probabilidad · ${registro.cuenta} · ${registro.detalleProducto}`}
                            onFocus={(evento) => evento.currentTarget.select()}
                            onBlur={(evento) => guardarProbabilidad(registro, evento.currentTarget)}
                            onKeyDown={(evento) =>
                              manejarTeclas(
                                evento,
                                (entrada) => guardarProbabilidad(registro, entrada),
                                textoProbabilidad(registro.probabilidad),
                              )
                            }
                            className={CLASES_CAJA}
                          />
                        </td>
                      </>
                    )}

                    <td className="border-b border-line bg-accent-soft/35 px-2 py-1">
                      <input
                        key={`${registro.id}-${modo}-${mes}-${valor ?? "sin"}`}
                        data-col="valor"
                        inputMode="decimal"
                        defaultValue={textoCantidad(valor)}
                        placeholder="—"
                        aria-label={etiquetaAria}
                        onFocus={(evento) => evento.currentTarget.select()}
                        onBlur={(evento) => guardarCantidad(registro, evento.currentTarget)}
                        onKeyDown={(evento) =>
                          manejarTeclas(
                            evento,
                            (entrada) => guardarCantidad(registro, entrada),
                            textoCantidad(valor),
                          )
                        }
                        className={CLASES_CAJA}
                      />
                    </td>

                    <td className="border-b border-line px-3 py-1.5">
                      <EstadoPastilla estado={c.estado} ratio={c.ratio} />
                    </td>

                    {!esReal ? (
                      <td className="hidden border-b border-line px-2 py-1 lg:table-cell">
                        <input
                          key={`${registro.id}-com-${registro.comentario ?? ""}`}
                          data-col="comentario"
                          defaultValue={registro.comentario ?? ""}
                          placeholder="Nota comercial…"
                          aria-label={`Comentario · ${registro.cuenta} · ${registro.detalleProducto}`}
                          onBlur={(evento) => {
                            if (evento.currentTarget.value.trim() !== (registro.comentario ?? "")) {
                              alActualizarComentario(registro.id, evento.currentTarget.value);
                              marcarGuardado(registro);
                            }
                          }}
                          onKeyDown={(evento) => {
                            if (evento.key === "Enter") evento.currentTarget.blur();
                          }}
                          className="h-8 w-full min-w-40 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                        />
                      </td>
                    ) : null}
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
