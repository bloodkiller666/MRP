"use client";

import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Archive,
  ArchiveRestore,
  ChevronDown,
  Copy,
  GitCompareArrows,
  Inbox,
  Pencil,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  describirMezcla,
  filasResumen,
  formatearFecha,
  porcentaje,
  soles2,
  soles4,
  type FilaResumen,
} from "@/lib/costos/calculo";
import type { DatosCostos, Grado, Insumo, Receta } from "@/lib/costos/types";
import { cn } from "@/lib/utils";

interface PropsResumen {
  datos: DatosCostos;
  insumosPorId: Map<string, Insumo>;
  /** Fecha (AAAA-MM-DD) a la que se calculan los costos. */
  fecha: string;
  alVerDetalle: (receta: Receta) => void;
  alEditar: (receta: Receta) => void;
  alDuplicar: (receta: Receta) => void;
  alArchivar: (receta: Receta, archivada: boolean) => void;
  alNueva: (grado?: Grado) => void;
  alComparar: (ids: string[]) => void;
}

const GRADOS: Grado[] = ["A", "B", "C"];
const NOMBRE_GRADO: Record<Grado, string> = { A: "Grado A PLUS", B: "Grado B PLUS", C: "Grado C PLUS" };

type ClaveOrden = "costo" | "nombre" | "variacion";

/** Insignia con la letra del grado. */
export function InsigniaGrado({ grado, className }: { grado: Grado; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-[5px] border border-accent/40 bg-accent-soft text-xs font-bold text-accent",
        className,
      )}
      aria-label={`Grado ${grado}`}
    >
      {grado}
    </span>
  );
}

/** Variación del costo con flecha, signo y color: nunca solo color. */
export function Variacion({ pct, fecha }: { pct: number; fecha?: string }) {
  const sube = pct > 0.00005;
  const baja = pct < -0.00005;
  const Icono = sube ? ArrowUpRight : baja ? ArrowDownRight : ArrowUpDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap",
        sube ? "text-bad" : baja ? "text-ok" : "text-ink-3",
      )}
      title={fecha ? `Último cambio de precio: ${formatearFecha(fecha)}` : undefined}
    >
      <Icono className="size-3.5" />
      {sube ? "+" : ""}
      {porcentaje(pct)}
      {fecha ? <span className="font-normal text-ink-3">· {formatearFecha(fecha)}</span> : null}
    </span>
  );
}

/**
 * Resumen de costos: el cuadro central de la sección.
 *
 * Reemplaza a la hoja «Resumen» del Excel: una matriz con una columna por variante que crecía hacia
 * la derecha. Aquí cada grado es una tabla ordenable (de la más barata a la más cara), con la mezcla,
 * soles/kg y soles/galón, cuánto se aleja de la mínima y cómo cambió con el último precio.
 */
export function ResumenCostos({
  datos,
  insumosPorId,
  fecha,
  alVerDetalle,
  alEditar,
  alDuplicar,
  alArchivar,
  alNueva,
  alComparar,
}: PropsResumen) {
  const [busqueda, setBusqueda] = useState("");
  const [grado, setGrado] = useState<Grado | "">("");
  const [insumoFiltro, setInsumoFiltro] = useState("");
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [orden, setOrden] = useState<{ clave: ClaveOrden; dir: 1 | -1 }>({ clave: "costo", dir: 1 });
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [colapsados, setColapsados] = useState<Grado[]>([]);

  const termino = busqueda.trim().toLowerCase();
  const visibles = useMemo(
    () =>
      datos.recetas.filter((r) => {
        if (!verArchivadas && r.archivada) return false;
        if (grado && r.grado !== grado) return false;
        if (insumoFiltro && !r.lineas.some((l) => l.insumoId === insumoFiltro)) return false;
        if (!termino) return true;
        return `${r.nombre} ${describirMezcla(r, insumosPorId)}`.toLowerCase().includes(termino);
      }),
    [datos.recetas, verArchivadas, grado, insumoFiltro, termino, insumosPorId],
  );

  // Las posiciones y «sobre la más barata» se calculan sobre todas las recetas activas del grado,
  // no solo sobre las que pasan el filtro: así «más barata» sigue significando lo mismo.
  const todasActivas = useMemo(() => datos.recetas.filter((r) => !r.archivada), [datos.recetas]);
  const referencia = useMemo(
    () => filasResumen(todasActivas, insumosPorId, datos.parametros, fecha),
    [todasActivas, insumosPorId, datos.parametros, fecha],
  );
  const grupos = useMemo(
    () => filasResumen(visibles, insumosPorId, datos.parametros, fecha),
    [visibles, insumosPorId, datos.parametros, fecha],
  );

  const posicionDe = (id: string, g: Grado) => referencia[g].find((f) => f.receta.id === id);

  const ordenar = (filas: FilaResumen[]) =>
    [...filas].sort((a, b) => {
      if (orden.clave === "nombre") return a.receta.nombre.localeCompare(b.receta.nombre, "es") * orden.dir;
      if (orden.clave === "variacion") {
        const va = a.variacion?.pct ?? -Infinity;
        const vb = b.variacion?.pct ?? -Infinity;
        return (va - vb) * orden.dir;
      }
      // Las que no se pueden calcular a esa fecha van al final.
      const ca = a.costo.completo ? a.costo.total : Infinity;
      const cb = b.costo.completo ? b.costo.total : Infinity;
      if (ca === cb) return 0;
      return (ca - cb) * orden.dir;
    });

  const cambiarOrden = (clave: ClaveOrden) =>
    setOrden((previo) => (previo.clave === clave ? { clave, dir: previo.dir === 1 ? -1 : 1 } : { clave, dir: clave === "variacion" ? -1 : 1 }));

  const alternarSeleccion = (id: string) =>
    setSeleccion((previa) => (previa.includes(id) ? previa.filter((x) => x !== id) : [...previa, id].slice(-4)));

  const insumosActivos = datos.insumos.filter((i) => !i.archivado || i.id === insumoFiltro);

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------ Indicadores ------------------------------ */}
      <section aria-label="Resumen por grado" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {GRADOS.map((g) => {
          const filas = referencia[g].filter((f) => f.costo.completo).sort((a, b) => a.costo.total - b.costo.total);
          const barata = filas[0];
          const cara = filas[filas.length - 1];
          const promedio = filas.length ? filas.reduce((acc, f) => acc + f.costo.galon, 0) / filas.length : 0;
          return (
            <article key={g} className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card">
              <header className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <InsigniaGrado grado={g} />
                  {NOMBRE_GRADO[g]}
                </h3>
                <span className="text-xs text-ink-3">
                  {referencia[g].length} variante{referencia[g].length === 1 ? "" : "s"}
                </span>
              </header>
              {barata ? (
                <>
                  <p className="rotulo mt-3 text-ink-3">Más barata</p>
                  <p className="num mt-0.5 flex items-baseline gap-1.5 text-[1.65rem] leading-none font-semibold text-ink">
                    {soles2(barata.costo.galon)}
                    <span className="text-xs font-semibold text-ink-2">S/ por galón</span>
                  </p>
                  <p className="num mt-1 text-xs text-ink-2">{soles4(barata.costo.total)} S/kg</p>
                  <p className="mt-1.5 line-clamp-2 text-xs text-ink-3" title={barata.receta.nombre}>
                    {barata.receta.nombre}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
                    <div>
                      <dt className="text-ink-3">Promedio</dt>
                      <dd className="num font-medium text-ink">{soles2(promedio)} S/gal</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Más cara</dt>
                      <dd className="num font-medium text-ink">{soles2(cara?.costo.galon)} S/gal</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="mt-4 text-sm text-ink-3">Sin variantes con precio a esta fecha.</p>
              )}
            </article>
          );
        })}
      </section>

      {/* -------------------------------- Filtros -------------------------------- */}
      <section className="rounded-xl border border-line bg-surface p-3 shadow-card sm:p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar variante, proveedor o insumo…"
              aria-label="Buscar variante"
              className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-8 text-sm text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
          </div>

          <div role="radiogroup" aria-label="Grado" className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5">
            {(["", ...GRADOS] as const).map((g) => (
              <button
                key={g || "todos"}
                type="button"
                role="radio"
                aria-checked={grado === g}
                onClick={() => setGrado(g)}
                className={cn(
                  "h-7 min-w-10 rounded-md px-3 text-xs font-semibold transition-colors",
                  grado === g ? "bg-accent text-accent-ink shadow-sm" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                )}
              >
                {g || "Todos"}
              </button>
            ))}
          </div>

          <select
            value={insumoFiltro}
            onChange={(e) => setInsumoFiltro(e.target.value)}
            aria-label="Que contenga el insumo"
            className="h-9 max-w-64 cursor-pointer rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink"
          >
            <option value="">Cualquier insumo</option>
            {insumosActivos.map((i) => (
              <option key={i.id} value={i.id}>
                Contiene: {i.nombre}
              </option>
            ))}
          </select>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={verArchivadas}
              onChange={(e) => setVerArchivadas(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Ver archivadas
          </label>

          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              type="button"
              disabled={seleccion.length < 2}
              onClick={() => alComparar(seleccion)}
              title="Selecciona de 2 a 4 variantes para compararlas lado a lado"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-surface"
            >
              <GitCompareArrows className="size-4" />
              Comparar{seleccion.length > 0 ? ` (${seleccion.length})` : ""}
            </button>
            <button
              type="button"
              onClick={() => alNueva(grado || undefined)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
            >
              <Plus className="size-4" />
              Nueva receta
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------- Tablas ---------------------------------- */}
      {GRADOS.filter((g) => !grado || g === grado).map((g) => {
        const filas = ordenar(grupos[g]);
        const abierto = !colapsados.includes(g);
        const maximo = Math.max(...filas.filter((f) => f.costo.completo).map((f) => f.costo.total), 0);
        return (
          <section key={g} className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <button
              type="button"
              onClick={() => setColapsados((c) => (c.includes(g) ? c.filter((x) => x !== g) : [...c, g]))}
              aria-expanded={abierto}
              className="flex w-full items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2.5">
                <InsigniaGrado grado={g} />
                <span className="text-sm font-semibold text-ink">{NOMBRE_GRADO[g]}</span>
                <span className="text-xs text-ink-3">
                  {filas.length} variante{filas.length === 1 ? "" : "s"}
                  {filas.length !== referencia[g].length ? ` de ${referencia[g].length}` : ""}
                </span>
              </span>
              <ChevronDown className={cn("size-4 text-ink-3 transition-transform", abierto && "rotate-180")} />
            </button>

            {abierto ? (
              filas.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Inbox className="mx-auto mb-3 size-8 text-line-strong" />
                  <p className="text-sm font-medium text-ink">Sin variantes que coincidan</p>
                  <p className="mt-1 text-xs text-ink-3">Ajusta los filtros o crea una receta nueva.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 text-[13px] md:min-w-[44rem]">
                    <thead>
                      <tr className="text-left">
                        <th className="w-10 border-b border-line-strong px-3 py-2" />
                        <ThOrden
                          titulo="Variante"
                          clave="nombre"
                          orden={orden}
                          alOrdenar={cambiarOrden}
                          className="w-full"
                        />
                        <th className="rotulo hidden border-b border-line-strong px-3 py-2 text-right text-ink-2 sm:table-cell">S/ kg</th>
                        <ThOrden
                          titulo="S/ galón"
                          clave="costo"
                          orden={orden}
                          alOrdenar={cambiarOrden}
                          derecha
                        />
                        <th className="rotulo hidden border-b border-line-strong px-3 py-2 text-ink-2 md:table-cell">
                          Frente a la más barata
                        </th>
                        <ThOrden
                          titulo="Último cambio"
                          clave="variacion"
                          orden={orden}
                          alOrdenar={cambiarOrden}
                          className="hidden lg:table-cell"
                        />
                        <th className="w-28 border-b border-line-strong px-2 py-2">
                          <span className="sr-only">Acciones</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map(({ receta, costo, variacion }) => {
                        const ref = posicionDe(receta.id, g);
                        const esMinima = ref?.posicion === 1;
                        const marcada = seleccion.includes(receta.id);
                        return (
                          <tr
                            key={receta.id}
                            onClick={() => alVerDetalle(receta)}
                            className={cn(
                              "group cursor-pointer transition-colors hover:bg-surface-2/70",
                              receta.archivada && "opacity-60",
                              marcada && "bg-accent-soft/40",
                            )}
                          >
                            <td className="border-b border-line px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={marcada}
                                onChange={() => alternarSeleccion(receta.id)}
                                aria-label={`Seleccionar ${receta.nombre} para comparar`}
                                className="size-4 accent-[var(--accent)]"
                              />
                            </td>
                            <td className="max-w-0 border-b border-line px-3 py-2">
                              <p className="flex items-center gap-2 font-medium text-ink">
                                <span className="truncate" title={receta.nombre}>
                                  {receta.nombre}
                                </span>
                                {esMinima ? (
                                  <span className="shrink-0 rounded-full border border-ok-line bg-ok-soft px-1.5 py-px text-[10px] font-semibold text-ok">
                                    Más barata
                                  </span>
                                ) : null}
                                {receta.archivada ? (
                                  <span className="shrink-0 rounded-full border border-line-strong px-1.5 py-px text-[10px] font-semibold text-ink-3">
                                    Archivada
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-xs text-ink-3" title={describirMezcla(receta, insumosPorId)}>
                                {describirMezcla(receta, insumosPorId) || "Sin insumos"}
                              </p>
                            </td>
                            <td className="num hidden border-b border-line px-3 py-2 text-right text-ink-2 sm:table-cell">
                              {costo.completo ? soles4(costo.total) : "–"}
                            </td>
                            <td className="num border-b border-line px-3 py-2 text-right">
                              {costo.completo ? (
                                <span className="font-semibold text-ink">{soles2(costo.galon)}</span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-xs font-medium text-warn"
                                  title={`Algún insumo no tiene precio al ${formatearFecha(fecha)}`}
                                >
                                  <TriangleAlert className="size-3.5" />
                                  Sin precio
                                </span>
                              )}
                            </td>
                            <td className="hidden border-b border-line px-3 py-2 md:table-cell">
                              {costo.completo && ref && maximo > 0 ? (
                                <div className="flex items-center gap-2.5">
                                  <div className="h-1.5 w-24 shrink-0 rounded-full" style={{ background: "var(--viz-track)" }}>
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${(costo.total / maximo) * 100}%`, background: "var(--viz-bar)" }}
                                    />
                                  </div>
                                  <span className="num w-14 text-xs text-ink-2">
                                    {esMinima ? "mínima" : `+${porcentaje(ref.sobreMinimo ?? 0)}`}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-ink-3">–</span>
                              )}
                            </td>
                            <td className="hidden border-b border-line px-3 py-2 lg:table-cell">
                              {variacion ? (
                                <Variacion pct={variacion.pct} fecha={variacion.fechaCambio} />
                              ) : (
                                <span className="text-xs text-ink-3">sin cambios</span>
                              )}
                            </td>
                            <td className="border-b border-line px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                                <BotonIcono titulo="Editar receta" onClick={() => alEditar(receta)}>
                                  <Pencil className="size-3.5" />
                                </BotonIcono>
                                <BotonIcono titulo="Duplicar como variante nueva" onClick={() => alDuplicar(receta)}>
                                  <Copy className="size-3.5" />
                                </BotonIcono>
                                <BotonIcono
                                  titulo={receta.archivada ? "Restaurar" : "Archivar (no se borra)"}
                                  onClick={() => alArchivar(receta, !receta.archivada)}
                                >
                                  {receta.archivada ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                                </BotonIcono>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : null}
          </section>
        );
      })}

      {/* -------------------------------- Notas ---------------------------------- */}
      <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-ink-3">
        <span>
          Costo = Σ (proporción × precio vigente del insumo) + gas ({soles4(datos.parametros.gas)}) + mano de obra (
          {soles4(datos.parametros.mo)}) · soles/galón = soles/kg × {datos.parametros.kgPorGalon}
        </span>
        <span>Fila → detalle · casillas → comparar hasta 4 variantes</span>
      </p>
    </div>
  );
}

function BotonIcono({
  titulo,
  onClick,
  children,
}: {
  titulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className="rounded p-1.5 text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
    >
      {children}
    </button>
  );
}

function ThOrden({
  titulo,
  clave,
  orden,
  alOrdenar,
  derecha,
  className,
}: {
  titulo: string;
  clave: ClaveOrden;
  orden: { clave: ClaveOrden; dir: 1 | -1 };
  alOrdenar: (clave: ClaveOrden) => void;
  derecha?: boolean;
  className?: string;
}) {
  const activa = orden.clave === clave;
  const Icono = !activa ? ArrowUpDown : orden.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={activa ? (orden.dir === 1 ? "ascending" : "descending") : "none"}
      className={cn("border-b border-line-strong px-3 py-2", derecha && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => alOrdenar(clave)}
        className={cn(
          "rotulo inline-flex items-center gap-1 text-ink-2 transition-colors hover:text-ink",
          activa && "text-ink",
        )}
      >
        {titulo}
        <Icono className={cn("size-3", activa ? "text-accent" : "text-ink-3")} />
      </button>
    </th>
  );
}
