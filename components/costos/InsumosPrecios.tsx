"use client";

import { Archive, ArchiveRestore, Check, History, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  costoReceta,
  formatearFecha,
  hoyISO,
  porcentaje,
  precioAnterior,
  precioVigente,
  recetasQueUsan,
  soles2,
  soles4,
} from "@/lib/costos/calculo";
import type { costosStore } from "@/lib/costos/store";
import type { DatosCostos, Insumo, PrecioInsumo } from "@/lib/costos/types";
import { cn, parsearNumero } from "@/lib/utils";

import { Boton } from "../ui/Boton";
import { Campo, Input } from "../ui/Campos";
import { Modal } from "../ui/Modal";
import { Variacion } from "./ResumenCostos";

interface PropsInsumos {
  datos: DatosCostos;
  insumosPorId: Map<string, Insumo>;
  /** Fecha del Resumen: define qué precio se considera «vigente». */
  fecha: string;
  acciones: typeof costosStore;
  alAviso: (mensaje: string) => void;
}

const EJE = { fill: "var(--ink-2)", fontSize: 12 };

/**
 * Insumos y su historial de precios.
 *
 * Cambiar un precio **agrega** una entrada con su fecha: las anteriores se conservan y se ven en el
 * historial (en el Excel esas filas quedaban sueltas en la hoja Precios). El precio vigente de cada
 * fecha alimenta el costo de todas las recetas que usan el insumo.
 */
export function InsumosPrecios({ datos, insumosPorId, fecha, acciones, alAviso }: PropsInsumos) {
  const [busqueda, setBusqueda] = useState("");
  const [verArchivados, setVerArchivados] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);
  const [modalNuevo, setModalNuevo] = useState(false);

  const termino = busqueda.trim().toLowerCase();
  const lista = useMemo(
    () =>
      datos.insumos
        .filter((i) => (verArchivados || !i.archivado) && `${i.nombre} ${i.proveedor}`.toLowerCase().includes(termino))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [datos.insumos, verArchivados, termino],
  );
  const seleccionado = insumosPorId.get(elegido ?? "") ?? lista[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(18rem,24rem)_1fr]">
      {/* --------------------------------- Lista -------------------------------- */}
      <section className="flex flex-col rounded-xl border border-line bg-surface shadow-card">
        <header className="flex flex-col gap-3 border-b border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Insumos</h2>
            <button
              type="button"
              onClick={() => setModalNuevo(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
            >
              <Plus className="size-3.5" />
              Nuevo insumo
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar insumo o proveedor…"
              aria-label="Buscar insumo"
              className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-8 text-sm text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-2">
            <input
              type="checkbox"
              checked={verArchivados}
              onChange={(e) => setVerArchivados(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Ver archivados
          </label>
        </header>

        <ul className="max-h-[34rem] divide-y divide-line overflow-y-auto">
          {lista.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-ink-3">Ningún insumo coincide.</li>
          ) : (
            lista.map((i) => {
              const vigente = precioVigente(i, fecha);
              const anterior = precioAnterior(i, fecha);
              const usos = recetasQueUsan(i.id, datos.recetas).length;
              const activo = seleccionado?.id === i.id;
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => setElegido(i.id)}
                    aria-current={activo}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2",
                      activo && "bg-accent-soft/50",
                      i.archivado && "opacity-60",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink">{i.nombre}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-3">
                        {i.proveedor || "Sin proveedor"} · {usos} receta{usos === 1 ? "" : "s"}
                        {i.archivado ? " · archivado" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="num block text-[13px] font-semibold text-ink">
                        {vigente ? soles4(vigente.precio) : "–"}
                      </span>
                      {vigente && anterior ? <Variacion pct={vigente.precio / anterior.precio - 1} /> : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {/* --------------------------------- Detalle ------------------------------ */}
      {seleccionado ? (
        <DetalleInsumo
          key={seleccionado.id}
          insumo={seleccionado}
          datos={datos}
          insumosPorId={insumosPorId}
          fecha={fecha}
          acciones={acciones}
          alAviso={alAviso}
        />
      ) : (
        <section className="flex items-center justify-center rounded-xl border border-line bg-surface p-10 text-sm text-ink-3 shadow-card">
          Elige un insumo para ver su historial de precios.
        </section>
      )}

      {modalNuevo ? (
        <NuevoInsumoModal
          onCerrar={() => setModalNuevo(false)}
          onCrear={(nombre, proveedor, f, precio) => {
            const id = acciones.crearInsumo(nombre, proveedor, f, precio);
            if (id) {
              setElegido(id);
              alAviso(`Insumo «${nombre.trim()}» creado con su primer precio.`);
              return true;
            }
            return false;
          }}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Panel de un insumo                                                         */
/* -------------------------------------------------------------------------- */

function DetalleInsumo({
  insumo,
  datos,
  insumosPorId,
  fecha,
  acciones,
  alAviso,
}: {
  insumo: Insumo;
  datos: DatosCostos;
  insumosPorId: Map<string, Insumo>;
  fecha: string;
  acciones: typeof costosStore;
  alAviso: (mensaje: string) => void;
}) {
  const kg = datos.parametros.kgPorGalon;
  const vigente = precioVigente(insumo, fecha);
  const usadaEn = recetasQueUsan(insumo.id, datos.recetas);

  const [fechaNueva, setFechaNueva] = useState(hoyISO());
  const [precioNuevo, setPrecioNuevo] = useState("");
  const [notaNueva, setNotaNueva] = useState("");
  const [usarCalculadora, setUsarCalculadora] = useState(false);
  const [cotizacion, setCotizacion] = useState("");
  const [factor, setFactor] = useState("1");
  const [adicional, setAdicional] = useState("0");
  const [editando, setEditando] = useState<string | null>(null);

  // Calculadora: la fórmula de las celdas de la hoja Precios del Excel = (cotización ÷ kg/gal) × factor + adicional ÷ kg/gal.
  const precioCalculado = (() => {
    const c = parsearNumero(cotizacion);
    const f = parsearNumero(factor) ?? 1;
    const a = parsearNumero(adicional) ?? 0;
    return c === undefined ? undefined : (c / kg) * f + a / kg;
  })();
  const precioAGuardar = usarCalculadora ? precioCalculado : parsearNumero(precioNuevo);
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fechaNueva);
  const puedeGuardar = Boolean(precioAGuardar && precioAGuardar > 0 && fechaValida);

  // Vista previa del impacto: cuánto cambiaría el costo (S/gal) de las recetas que lo usan.
  const impacto = useMemo(() => {
    if (!precioAGuardar || precioAGuardar <= 0 || !fechaValida) return null;
    const hipotetico: Insumo = {
      ...insumo,
      precios: [...insumo.precios.filter((p) => p.fecha !== fechaNueva), { id: "x", fecha: fechaNueva, precio: precioAGuardar, nota: "" }].sort((a, b) =>
        a.fecha.localeCompare(b.fecha),
      ),
    };
    const mapa = new Map(insumosPorId).set(insumo.id, hipotetico);
    const cambios = usadaEn
      .map((r) => {
        const antes = costoReceta(r, insumosPorId, datos.parametros, fechaNueva);
        const despues = costoReceta(r, mapa, datos.parametros, fechaNueva);
        return antes.completo && despues.completo && antes.galon > 0 ? despues.galon / antes.galon - 1 : null;
      })
      .filter((v): v is number => v !== null);
    if (cambios.length === 0) return null;
    return { recetas: cambios.length, promedio: cambios.reduce((a, b) => a + b, 0) / cambios.length, maximo: Math.max(...cambios) };
  }, [precioAGuardar, fechaValida, fechaNueva, insumo, insumosPorId, usadaEn, datos.parametros]);

  const registrar = () => {
    if (!puedeGuardar || !precioAGuardar) return;
    const nota =
      notaNueva.trim() ||
      (usarCalculadora ? `(${cotizacion} S/gal ÷ ${kg}) × ${factor}${parsearNumero(adicional) ? ` + ${adicional} ÷ ${kg}` : ""}` : "");
    acciones.registrarPrecio(insumo.id, fechaNueva, Math.round(precioAGuardar * 1e6) / 1e6, nota);
    alAviso(
      `Precio registrado desde ${formatearFecha(fechaNueva)}. ${usadaEn.length} receta${usadaEn.length === 1 ? "" : "s"} se recalcularon; el precio anterior sigue en el historial.`,
    );
    setPrecioNuevo("");
    setNotaNueva("");
    setCotizacion("");
  };

  const historial = [...insumo.precios].reverse();
  const serie = insumo.precios.map((p) => ({ fecha: p.fecha, precio: p.precio }));

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{insumo.nombre}</h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {insumo.proveedor || "Sin proveedor"} · usado en {usadaEn.length} receta{usadaEn.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="rotulo text-ink-3">Precio vigente al {formatearFecha(fecha)}</p>
            <p className="num text-xl font-semibold text-ink">
              {vigente ? soles4(vigente.precio) : "–"} <span className="text-xs font-medium text-ink-2">S/kg</span>
            </p>
            {vigente ? (
              <p className="num text-xs text-ink-3">{soles2(vigente.precio * kg)} S/gal equivalente</p>
            ) : null}
          </div>
          <Boton
            variante="fantasma"
            tamano="sm"
            icono={insumo.archivado ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            onClick={() => acciones.archivarInsumo(insumo.id, !insumo.archivado)}
            title="Archivar oculta el insumo de los selectores; las recetas que lo usan siguen calculándose"
          >
            {insumo.archivado ? "Restaurar" : "Archivar"}
          </Boton>
        </div>
      </header>

      {/* Registrar un precio nuevo */}
      <div className="rounded-md border border-line bg-surface-2/60 p-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="rotulo text-ink">Registrar un precio nuevo</h3>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-2">
            <input
              type="checkbox"
              checked={usarCalculadora}
              onChange={(e) => setUsarCalculadora(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Calcular desde la cotización (S/gal)
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo etiqueta="Vigente desde" htmlFor="precio-fecha" error={fechaValida ? undefined : "Fecha no válida"}>
            <Input id="precio-fecha" type="date" value={fechaNueva} onChange={(e) => setFechaNueva(e.target.value)} />
          </Campo>

          {usarCalculadora ? (
            <>
              <Campo etiqueta="Cotización S/gal" htmlFor="precio-cot">
                <Input id="precio-cot" inputMode="decimal" value={cotizacion} onChange={(e) => setCotizacion(e.target.value)} className="num text-right" placeholder="16.35" />
              </Campo>
              <Campo etiqueta="Factor" htmlFor="precio-factor">
                <Input id="precio-factor" inputMode="decimal" value={factor} onChange={(e) => setFactor(e.target.value)} className="num text-right" />
              </Campo>
              <Campo etiqueta="Adicional S/gal" htmlFor="precio-adic">
                <Input id="precio-adic" inputMode="decimal" value={adicional} onChange={(e) => setAdicional(e.target.value)} className="num text-right" />
              </Campo>
            </>
          ) : (
            <Campo etiqueta="Precio S/kg" htmlFor="precio-valor" className="sm:col-span-1">
              <Input id="precio-valor" inputMode="decimal" value={precioNuevo} onChange={(e) => setPrecioNuevo(e.target.value)} className="num text-right" placeholder="3.2853" />
            </Campo>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
          <Campo etiqueta="Nota (opcional)" htmlFor="precio-nota">
            <Input id="precio-nota" value={notaNueva} onChange={(e) => setNotaNueva(e.target.value)} placeholder="Ej. cotización de septiembre, contrato AFA-09" />
          </Campo>
          <Boton variante="primario" onClick={registrar} disabled={!puedeGuardar} icono={<Check className="size-4" />}>
            Registrar precio
          </Boton>
        </div>

        <p className="num mt-2.5 min-h-5 text-xs text-ink-2" aria-live="polite">
          {usarCalculadora && precioCalculado ? (
            <>
              Precio resultante: <span className="font-semibold text-ink">{soles4(precioCalculado)} S/kg</span>
              {" · "}
            </>
          ) : null}
          {impacto ? (
            <>
              Impacto: {impacto.recetas} receta{impacto.recetas === 1 ? "" : "s"} · promedio{" "}
              <span className="font-semibold text-ink">
                {impacto.promedio >= 0 ? "+" : ""}
                {porcentaje(impacto.promedio)}
              </span>{" "}
              en S/gal (hasta {impacto.maximo >= 0 ? "+" : ""}
              {porcentaje(impacto.maximo)})
            </>
          ) : (
            "Escribe el precio para ver cuánto cambiaría el costo de las recetas."
          )}
        </p>
      </div>

      {/* Evolución */}
      {serie.length >= 2 ? (
        <div className="h-44 rounded-md border border-line p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
              <XAxis dataKey="fecha" tick={EJE} tickLine={false} axisLine={{ stroke: "var(--line-strong)" }} tickFormatter={(f) => formatearFecha(String(f)).slice(0, 6)} />
              <YAxis tick={EJE} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => soles2(Number(v))} width={46} />
              <Tooltip
                cursor={{ stroke: "var(--line-strong)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as { fecha: string; precio: number };
                  return (
                    <div className="rounded-lg border border-line-strong bg-surface px-3 py-2 shadow-pop">
                      <p className="text-xs font-semibold text-ink">{formatearFecha(p.fecha)}</p>
                      <p className="num mt-1 text-xs text-ink-2">
                        <span className="font-semibold text-ink">{soles4(p.precio)}</span> S/kg
                      </p>
                    </div>
                  );
                }}
              />
              <Line type="stepAfter" dataKey="precio" stroke="var(--viz-real)" strokeWidth={2} dot={{ r: 3.5, fill: "var(--viz-real)", stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {/* Historial */}
      <div>
        <h3 className="rotulo mb-2 flex items-center gap-1.5 text-ink-2">
          <History className="size-3.5" />
          Historial de precios ({historial.length})
        </h3>
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[34rem] text-[13px]">
            <thead className="bg-surface-2 text-left">
              <tr>
                <th className="rotulo px-3 py-2 text-ink-2">Desde</th>
                <th className="rotulo px-3 py-2 text-right text-ink-2">S/kg</th>
                <th className="rotulo px-3 py-2 text-right text-ink-2">S/gal</th>
                <th className="rotulo px-3 py-2 text-ink-2">Cambio</th>
                <th className="rotulo px-3 py-2 text-ink-2">Nota</th>
                <th className="w-20 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {historial.map((p, indice) => {
                const previo = historial[indice + 1];
                const esVigente = vigente?.id === p.id;
                const futuro = p.fecha > fecha;
                return editando === p.id ? (
                  <FilaEdicion
                    key={p.id}
                    precio={p}
                    onCancelar={() => setEditando(null)}
                    onGuardar={(cambios) => {
                      acciones.editarPrecio(insumo.id, p.id, cambios);
                      setEditando(null);
                    }}
                  />
                ) : (
                  <tr key={p.id} className={cn("border-t border-line", esVigente && "bg-accent-soft/40")}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatearFecha(p.fecha)}
                      {esVigente ? (
                        <span className="ml-2 rounded-full border border-accent/40 bg-accent-soft px-1.5 py-px text-[10px] font-semibold text-accent">
                          Vigente
                        </span>
                      ) : futuro ? (
                        <span className="ml-2 rounded-full border border-line-strong px-1.5 py-px text-[10px] font-semibold text-ink-3">
                          Posterior
                        </span>
                      ) : null}
                    </td>
                    <td className="num px-3 py-2 text-right font-medium">{soles4(p.precio)}</td>
                    <td className="num px-3 py-2 text-right text-ink-2">{soles2(p.precio * kg)}</td>
                    <td className="px-3 py-2">
                      {previo ? <Variacion pct={p.precio / previo.precio - 1} /> : <span className="text-xs text-ink-3">precio inicial</span>}
                    </td>
                    <td className="max-w-56 truncate px-3 py-2 text-xs text-ink-3" title={p.nota}>
                      {p.nota || "—"}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex justify-end gap-0.5">
                        <button type="button" title="Corregir este precio" aria-label="Corregir este precio" onClick={() => setEditando(p.id)} className="rounded p-1.5 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink">
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Eliminar del historial"
                          aria-label="Eliminar del historial"
                          disabled={insumo.precios.length <= 1}
                          onClick={() => {
                            if (window.confirm(`¿Eliminar el precio del ${formatearFecha(p.fecha)} del historial? Los costos de esa fecha cambiarán.`)) {
                              acciones.eliminarPrecio(insumo.id, p.id);
                            }
                          }}
                          className="rounded p-1.5 text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-3"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-xs text-ink-3">
          El costo de cada receta usa el último precio con fecha igual o anterior a la consultada: por eso los precios viejos se conservan.
        </p>
      </div>
    </section>
  );
}

function FilaEdicion({
  precio,
  onCancelar,
  onGuardar,
}: {
  precio: PrecioInsumo;
  onCancelar: () => void;
  onGuardar: (cambios: { fecha: string; precio: number; nota: string }) => void;
}) {
  const [fecha, setFecha] = useState(precio.fecha);
  const [valor, setValor] = useState(String(precio.precio));
  const [nota, setNota] = useState(precio.nota);
  const numero = parsearNumero(valor);
  const valido = Boolean(numero && numero > 0 && /^\d{4}-\d{2}-\d{2}$/.test(fecha));
  return (
    <tr className="border-t border-line bg-surface-2/60">
      <td className="px-2 py-1.5">
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" />
      </td>
      <td className="px-2 py-1.5">
        <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="num text-right" aria-label="Precio S/kg" />
      </td>
      <td colSpan={2} className="px-2 py-1.5 text-xs text-ink-3">
        Corrige un error de captura; para un cambio de precio real registra uno nuevo.
      </td>
      <td className="px-2 py-1.5">
        <Input value={nota} onChange={(e) => setNota(e.target.value)} aria-label="Nota" />
      </td>
      <td className="px-2 py-1.5">
        <div className="flex justify-end gap-0.5">
          <button
            type="button"
            title="Guardar"
            aria-label="Guardar"
            disabled={!valido}
            onClick={() => numero && onGuardar({ fecha, precio: numero, nota })}
            className="rounded p-1.5 text-ok transition-colors hover:bg-ok-soft disabled:opacity-40"
          >
            <Check className="size-4" />
          </button>
          <button type="button" title="Cancelar" aria-label="Cancelar" onClick={onCancelar} className="rounded p-1.5 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function NuevoInsumoModal({
  onCerrar,
  onCrear,
}: {
  onCerrar: () => void;
  onCrear: (nombre: string, proveedor: string, fecha: string, precio: number) => boolean;
}) {
  const [nombre, setNombre] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    const valor = parsearNumero(precio);
    if (!nombre.trim()) return setError("Escribe el nombre del insumo.");
    if (!valor || valor <= 0) return setError("Indica el precio en soles por kg.");
    if (!onCrear(nombre, proveedor, fecha, valor)) return setError("Ya existe un insumo con ese nombre.");
    onCerrar();
  };

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Nuevo insumo"
      descripcion="Se crea con su primer precio; los siguientes se registran desde el historial."
      tamano="sm"
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={guardar}>
            Crear insumo
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etiqueta="Nombre" htmlFor="ins-nombre" requerido>
          <Input id="ins-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. BINDER F Proveedor Alfa" />
        </Campo>
        <Campo etiqueta="Proveedor" htmlFor="ins-prov">
          <Input id="ins-prov" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Vigente desde" htmlFor="ins-fecha">
            <Input id="ins-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
          <Campo etiqueta="Precio S/kg" htmlFor="ins-precio" requerido>
            <Input id="ins-precio" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} className="num text-right" />
          </Campo>
        </div>
        {error ? <p className="text-sm text-bad">{error}</p> : null}
      </div>
    </Modal>
  );
}
