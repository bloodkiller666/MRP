"use client";

import { Archive, ArchiveRestore, Copy, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  costoReceta,
  describirMezcla,
  entero,
  filasResumen,
  formatearFecha,
  porcentaje,
  serieCosto,
  soles2,
  soles4,
} from "@/lib/costos/calculo";
import type { DatosCostos, Insumo, Receta } from "@/lib/costos/types";
import { parsearNumero } from "@/lib/utils";

import { Boton } from "../ui/Boton";
import { Input } from "../ui/Campos";
import { Modal } from "../ui/Modal";
import { Variacion } from "./ResumenCostos";

interface PropsDetalle {
  receta: Receta;
  datos: DatosCostos;
  insumosPorId: Map<string, Insumo>;
  fecha: string;
  onCerrar: () => void;
  alEditar: () => void;
  alDuplicar: () => void;
  alArchivar: () => void;
}

const EJE = { fill: "var(--ink-2)", fontSize: 12 };

/**
 * Detalle de una variante: composición con los precios vigentes a la fecha, total en soles/kg y
 * soles/galón, evolución del costo cada vez que cambió un precio y balanza de lote.
 */
export function DetalleRecetaModal({
  receta,
  datos,
  insumosPorId,
  fecha,
  onCerrar,
  alEditar,
  alDuplicar,
  alArchivar,
}: PropsDetalle) {
  const [galones, setGalones] = useState("1000");

  const costo = costoReceta(receta, insumosPorId, datos.parametros, fecha);
  const serie = useMemo(() => serieCosto(receta, insumosPorId, datos.parametros), [receta, insumosPorId, datos.parametros]);

  const referencia = useMemo(
    () =>
      filasResumen(
        datos.recetas.filter((r) => !r.archivada),
        insumosPorId,
        datos.parametros,
        fecha,
      )[receta.grado],
    [datos.recetas, insumosPorId, datos.parametros, fecha, receta.grado],
  );
  const fila = referencia.find((f) => f.receta.id === receta.id);
  const variacion = fila?.variacion ?? null;

  // Balanza de lote: como el Excel, galones × kg por galón = kg de mezcla; luego se reparte por proporción.
  const volumen = parsearNumero(galones) ?? 0;
  const kgMezcla = volumen * datos.parametros.kgPorGalon;

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={receta.nombre}
      descripcion={`Costos al ${formatearFecha(fecha)} · ${describirMezcla(receta, insumosPorId) || "sin insumos"}`}
      tamano="lg"
      pie={
        <>
          <Boton variante="fantasma" icono={receta.archivada ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />} onClick={alArchivar}>
            {receta.archivada ? "Restaurar" : "Archivar"}
          </Boton>
          <Boton variante="secundario" icono={<Copy className="size-4" />} onClick={alDuplicar}>
            Duplicar
          </Boton>
          <Boton variante="primario" icono={<Pencil className="size-4" />} onClick={alEditar}>
            Editar receta
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Cifras principales */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cifra etiqueta="Soles por galón" valor={costo.completo ? soles2(costo.galon) : "–"} grande />
          <Cifra etiqueta="Soles por kg" valor={costo.completo ? soles4(costo.total) : "–"} />
          <Cifra
            etiqueta={`Posición en grado ${receta.grado}`}
            valor={fila?.posicion ? `${fila.posicion} de ${referencia.filter((f) => f.costo.completo).length}` : "–"}
            detalle={fila?.sobreMinimo ? `+${porcentaje(fila.sobreMinimo)} sobre la mínima` : fila?.posicion === 1 ? "La más barata" : undefined}
          />
          <div className="rounded-md border border-line bg-surface-2/60 p-3">
            <p className="rotulo text-ink-2">Último cambio</p>
            <div className="mt-1.5">
              {variacion ? <Variacion pct={variacion.pct} fecha={variacion.fechaCambio} /> : <span className="text-sm text-ink-3">sin cambios</span>}
            </div>
            {variacion ? (
              <p className="num mt-1 text-[11px] text-ink-3">
                de {soles2(variacion.anterior)} a {soles2(variacion.actual)} S/gal
              </p>
            ) : null}
          </div>
        </div>

        {!costo.completo ? (
          <p className="rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn">
            Algún insumo todavía no tenía precio al {formatearFecha(fecha)}: el total no se puede calcular a esa fecha.
          </p>
        ) : null}

        {/* Composición */}
        <section>
          <h3 className="rotulo mb-2 text-ink-2">Composición (precios vigentes al {formatearFecha(fecha)})</h3>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[34rem] text-[13px]">
              <thead className="bg-surface-2 text-left">
                <tr>
                  <th className="rotulo px-3 py-2 text-ink-2">Insumo</th>
                  <th className="rotulo px-3 py-2 text-right text-ink-2">Proporción</th>
                  <th className="rotulo px-3 py-2 text-right text-ink-2">Precio S/kg</th>
                  <th className="rotulo px-3 py-2 text-right text-ink-2">Costo S/kg</th>
                </tr>
              </thead>
              <tbody>
                {costo.lineas.map((linea, i) => (
                  <tr key={`${linea.insumoId}-${i}`} className="border-t border-line">
                    <td className="px-3 py-1.5">
                      {linea.nombre}
                      {linea.fechaPrecio ? (
                        <span className="ml-2 text-xs text-ink-3">precio del {formatearFecha(linea.fechaPrecio)}</span>
                      ) : null}
                    </td>
                    <td className="num px-3 py-1.5 text-right">{porcentaje(linea.proporcion)}</td>
                    <td className="num px-3 py-1.5 text-right">{linea.precio === null ? "–" : soles4(linea.precio)}</td>
                    <td className="num px-3 py-1.5 text-right">{soles4(linea.costo)}</td>
                  </tr>
                ))}
                <FilaTotal etiqueta="Materia prima (MP)" prop={costo.sumaProporcion} valor={costo.mp} />
                <FilaTotal etiqueta="Gas" valor={costo.gas} suave />
                <FilaTotal etiqueta="Mano de obra" valor={costo.mo} suave />
                <tr className="border-t border-line-strong bg-surface-2">
                  <td className="px-3 py-2 font-semibold" colSpan={3}>
                    Total soles por kg
                  </td>
                  <td className="num px-3 py-2 text-right font-semibold">{soles4(costo.total)}</td>
                </tr>
                <tr className="bg-surface-2">
                  <td className="px-3 py-2 font-semibold" colSpan={3}>
                    Total soles por galón <span className="font-normal text-ink-3">(× {datos.parametros.kgPorGalon})</span>
                  </td>
                  <td className="num px-3 py-2 text-right font-semibold text-accent">{soles2(costo.galon)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {Math.abs(costo.sumaProporcion - 1) > 0.0005 ? (
            <p className="mt-1.5 text-xs text-warn">Las proporciones suman {porcentaje(costo.sumaProporcion)}, no 100 %.</p>
          ) : null}
          {receta.nota ? <p className="mt-2 text-xs text-ink-2">{receta.nota}</p> : null}
        </section>

        {/* Evolución */}
        <section>
          <h3 className="rotulo mb-2 text-ink-2">Evolución del costo (S/galón)</h3>
          {serie.length < 2 ? (
            <p className="rounded-md border border-line bg-surface-2/60 px-3 py-6 text-center text-sm text-ink-3">
              Aún no hay cambios de precio en los insumos de esta receta: el historial aparecerá aquí.
            </p>
          ) : (
            <div className="h-52 rounded-md border border-line p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
                  <XAxis dataKey="fecha" tick={EJE} tickLine={false} axisLine={{ stroke: "var(--line-strong)" }} tickFormatter={(f) => formatearFecha(String(f)).slice(0, 6)} />
                  <YAxis tick={EJE} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => soles2(Number(v))} width={52} />
                  <Tooltip
                    cursor={{ stroke: "var(--line-strong)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as { fecha: string; galon: number; kg: number };
                      return (
                        <div className="rounded-lg border border-line-strong bg-surface px-3 py-2 shadow-pop">
                          <p className="text-xs font-semibold text-ink">{formatearFecha(p.fecha)}</p>
                          <p className="num mt-1 text-xs text-ink-2">
                            <span className="font-semibold text-ink">{soles2(p.galon)}</span> S/gal · {soles4(p.kg)} S/kg
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Line type="stepAfter" dataKey="galon" stroke="var(--viz-real)" strokeWidth={2} dot={{ r: 3.5, fill: "var(--viz-real)", stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Balanza de lote */}
        <section>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <h3 className="rotulo text-ink-2">Balanza de lote</h3>
            <label className="flex items-center gap-2 text-sm text-ink-2">
              Galones
              <Input
                inputMode="decimal"
                value={galones}
                onChange={(e) => setGalones(e.target.value)}
                className="num w-32 text-right"
                aria-label="Galones del lote"
              />
            </label>
          </div>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[30rem] text-[13px]">
              <thead className="bg-surface-2 text-left">
                <tr>
                  <th className="rotulo px-3 py-2 text-ink-2">Insumo</th>
                  <th className="rotulo px-3 py-2 text-right text-ink-2">Kg</th>
                  <th className="rotulo px-3 py-2 text-right text-ink-2">Costo S/</th>
                </tr>
              </thead>
              <tbody>
                {costo.lineas.map((linea, i) => (
                  <tr key={`${linea.insumoId}-b-${i}`} className="border-t border-line">
                    <td className="px-3 py-1.5">{linea.nombre}</td>
                    <td className="num px-3 py-1.5 text-right">{entero(kgMezcla * linea.proporcion)}</td>
                    <td className="num px-3 py-1.5 text-right">{entero(kgMezcla * linea.costo)}</td>
                  </tr>
                ))}
                <tr className="border-t border-line-strong bg-surface-2 font-semibold">
                  <td className="px-3 py-2">Total del lote</td>
                  <td className="num px-3 py-2 text-right">{entero(kgMezcla)}</td>
                  <td className="num px-3 py-2 text-right text-accent">{entero(volumen * costo.galon)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-xs text-ink-3">
            Kg de mezcla = galones × {datos.parametros.kgPorGalon} (misma conversión del Excel). El costo total incluye gas y mano de obra.
          </p>
        </section>
      </div>
    </Modal>
  );
}

function Cifra({ etiqueta, valor, detalle, grande }: { etiqueta: string; valor: string; detalle?: string; grande?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-surface-2/60 p-3">
      <p className="rotulo text-ink-2">{etiqueta}</p>
      <p className={`num mt-1 font-semibold text-ink ${grande ? "text-2xl" : "text-lg"}`}>{valor}</p>
      {detalle ? <p className="mt-0.5 text-[11px] text-ink-3">{detalle}</p> : null}
    </div>
  );
}

function FilaTotal({ etiqueta, prop, valor, suave }: { etiqueta: string; prop?: number; valor: number; suave?: boolean }) {
  return (
    <tr className="border-t border-line bg-surface-2/50">
      <td className={`px-3 py-1.5 ${suave ? "text-ink-2" : "font-medium"}`}>{etiqueta}</td>
      <td className="num px-3 py-1.5 text-right text-ink-2">{prop === undefined ? "" : porcentaje(prop)}</td>
      <td className="px-3 py-1.5" />
      <td className={`num px-3 py-1.5 text-right ${suave ? "text-ink-2" : "font-medium"}`}>{soles4(valor)}</td>
    </tr>
  );
}

