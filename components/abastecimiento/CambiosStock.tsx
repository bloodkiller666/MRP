"use client";

import { ChevronDown, GitCompare } from "lucide-react";
import { Fragment } from "react";

import { CATEGORIAS, diferencia, type ComparacionStock, type FilaComparacion } from "@/lib/stock-comparacion";
import { cn } from "@/lib/utils";

import { formatearFechaIso } from "./formato";

interface PropsCambios {
  comparacion: ComparacionStock;
  abierto: boolean;
  onAlternar: () => void;
}

const numero = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const porciento = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1, signDisplay: "exceptZero" });
const conSigno = (v: number) => `${v > 0 ? "+" : ""}${numero.format(v)}`;
const colorDe = (v: number) => (v > 0 ? "text-ok" : v < 0 ? "text-bad" : "text-ink-3");
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const CLASES_TH = "border-b border-line-strong bg-surface-2 px-3 py-2 text-left text-xs font-semibold text-ink-2";
const CLASES_TD = "border-b border-line px-3 py-1.5 text-sm text-ink";
const CLASES_NUM = `${CLASES_TD} num text-right`;

function Medida({ dato }: { dato: FilaComparacion["actual"] | null }) {
  if (!dato) return <span className="text-ink-3">–</span>;
  return (
    <>
      {numero.format(dato.tn)}
      <span className="block text-xs text-ink-3">{formatearFechaIso(dato.fecha)}</span>
    </>
  );
}

/** Resultado de comparar el último Excel de stocks con lo que ya estaba cargado. */
export function CambiosStock({ comparacion: c, abierto, onAlternar }: PropsCambios) {
  const primera = c.archivoAnterior === null;
  const conCambio = c.filas.filter((f) => f.enArchivo && diferencia(f) !== 0 && diferencia(f) !== null).length;
  const materiasNuevas = c.nuevas.length + c.sinMateria.filter((s) => s.nueva).length;
  const resumen = primera
    ? "Primera carga: todavía no hay un stock anterior"
    : [
        plural(conCambio, "materia con diferencia", "materias con diferencia"),
        c.correcciones.length > 0 ? plural(c.correcciones.length, "dato corregido", "datos corregidos") : null,
        materiasNuevas > 0 ? plural(materiasNuevas, "materia nueva", "materias nuevas") : null,
        c.ausentes.length > 0 ? plural(c.ausentes.length, "materia que no vino", "materias que no vinieron") : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <section aria-label="Cambios del último stock" className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls="panel-cambios-stock"
        onClick={onAlternar}
        className="flex w-full cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1 px-3.5 py-3 text-left"
      >
        <GitCompare className="size-4 text-ink-2" aria-hidden />
        <span className="font-semibold text-ink">Cambios del último stock</span>
        <span className="text-xs text-ink-3">{resumen}</span>
        <ChevronDown className={cn("ml-auto size-4 text-ink-3", abierto && "rotate-180")} aria-hidden />
      </button>

      {abierto ? (
        <div id="panel-cambios-stock" className="flex flex-col gap-4 border-t border-line p-3.5">
          <p className="text-sm text-ink-2">
            <span className="font-medium text-ink">{c.archivo}</span> (hasta el {formatearFechaIso(c.hasta)})
            {primera
              ? ". Las diferencias aparecerán cuando suba el siguiente stock."
              : c.archivoAnterior
                ? ` comparado con lo cargado antes (último archivo: ${c.archivoAnterior}).`
                : " comparado con lo cargado antes."}
          </p>

          {c.nuevas.length > 0 ? (
            <p className="rounded-lg border border-warn bg-surface px-3.5 py-2.5 text-sm text-ink">
              <span className="font-semibold">Aparecen por primera vez:</span> {c.nuevas.join(", ")}.
            </p>
          ) : null}
          {c.ausentes.length > 0 ? (
            <p className="rounded-lg border border-warn bg-surface px-3.5 py-2.5 text-sm text-ink">
              <span className="font-semibold">Venían antes y este archivo no las trae:</span> {c.ausentes.join(", ")}. Se
              conserva su último dato.
            </p>
          ) : null}
          {c.sinMateria.length > 0 ? (
            <div className="rounded-lg border border-warn bg-surface px-3.5 py-2.5 text-sm text-ink">
              <p className="font-semibold">
                Filas del archivo que no están en Abastecimiento (no se importaron). Para incluirlas, créelas con «Nueva
                materia prima» usando ese nombre y vuelva a subir el archivo.
              </p>
              <ul className="mt-1.5">
                {c.sinMateria.map((s) => (
                  <li key={s.nombre}>
                    {s.nombre}: <span className="num">{numero.format(s.tn)} TM</span> al {formatearFechaIso(s.fecha)}
                    {s.nueva ? <span className="ml-1.5 font-semibold text-warn">(nueva)</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {c.correcciones.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Datos ya cargados que ahora vienen con otra cifra</h3>
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[40rem] border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className={CLASES_TH}>Materia prima</th>
                      <th className={CLASES_TH}>Fecha del stock</th>
                      <th className={`${CLASES_TH} text-right`}>Antes (TM)</th>
                      <th className={`${CLASES_TH} text-right`}>Ahora (TM)</th>
                      <th className={`${CLASES_TH} text-right`}>Diferencia (TM)</th>
                      <th className={CLASES_TH}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.correcciones.map((x) => (
                      <tr key={`${x.nombre}-${x.fecha}`}>
                        <td className={CLASES_TD}>{x.nombre}</td>
                        <td className={`${CLASES_TD} num`}>{formatearFechaIso(x.fecha)}</td>
                        <td className={CLASES_NUM}>{numero.format(x.antes)}</td>
                        <td className={CLASES_NUM}>{numero.format(x.ahora)}</td>
                        <td className={cn(CLASES_NUM, "font-semibold", colorDe(x.ahora - x.antes))}>{conSigno(x.ahora - x.antes)}</td>
                        <td className={CLASES_TD}>{x.aplicada ? "Reemplazado" : "Se mantiene el anterior"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">
              {primera ? "Stock cargado" : "Diferencia entre el stock anterior y el nuevo"}
            </h3>
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-[40rem] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className={CLASES_TH}>Materia prima</th>
                    <th className={`${CLASES_TH} text-right`}>Anterior (TM)</th>
                    <th className={`${CLASES_TH} text-right`}>Nuevo (TM)</th>
                    <th className={`${CLASES_TH} text-right`}>Diferencia (TM)</th>
                    <th className={`${CLASES_TH} text-right`}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIAS.map((categoria) => {
                    const filas = c.filas.filter((f) => f.categoria === categoria.id);
                    if (filas.length === 0) return null;
                    const comparables = filas.filter((f) => f.enArchivo && f.anterior);
                    const total = comparables.reduce((suma, f) => suma + (diferencia(f) ?? 0), 0);
                    return (
                      <Fragment key={categoria.id}>
                        <tr>
                          <th scope="rowgroup" colSpan={3} className={`${CLASES_TD} bg-surface-2 text-left font-semibold`}>
                            {categoria.nombre}
                          </th>
                          <td className={cn(CLASES_NUM, "bg-surface-2 font-semibold", colorDe(total))}>
                            {comparables.length > 0 ? conSigno(total) : "–"}
                          </td>
                          <td className={`${CLASES_TD} bg-surface-2`} />
                        </tr>
                        {filas.map((f) => {
                          const d = f.enArchivo ? diferencia(f) : null;
                          return (
                            <tr key={f.id}>
                              <th scope="row" className={`${CLASES_TD} text-left font-medium`}>
                                {f.nombre}
                              </th>
                              <td className={CLASES_NUM}>
                                <Medida dato={f.anterior} />
                              </td>
                              <td className={CLASES_NUM}>
                                {f.enArchivo ? <Medida dato={f.actual} /> : <span className="text-ink-3">No vino</span>}
                              </td>
                              <td className={cn(CLASES_NUM, "font-semibold", d === null ? "text-ink-3" : colorDe(d))}>
                                {d === null ? "–" : d === 0 ? "Sin cambio" : conSigno(d)}
                              </td>
                              <td className={cn(CLASES_NUM, d === null ? "text-ink-3" : colorDe(d))}>
                                {d && f.anterior && f.anterior.tn !== 0 ? `${porciento.format((d / f.anterior.tn) * 100)} %` : "–"}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
