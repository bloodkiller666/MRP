"use client";

import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Download,
  FlaskConical,
  History,
  LayoutGrid,
  RotateCcw,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MenuDatos } from "@/components/MenuDatos";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCostos } from "@/hooks/use-costos";
import { formatearFecha, formatearMomento, hoyISO } from "@/lib/costos/calculo";
import { exportarCostosExcel } from "@/lib/costos/excel";
import { NOTAS_RESUMEN } from "@/lib/costos/seed";
import type { Grado, Receta } from "@/lib/costos/types";
import { cn } from "@/lib/utils";

import { CompararModal } from "./CompararModal";
import { DetalleRecetaModal } from "./DetalleRecetaModal";
import { InsumosPrecios } from "./InsumosPrecios";
import { ImportarPreciosModal, ParametrosModal } from "./ModalesCostos";
import { RecetaFormModal } from "./RecetaFormModal";
import { ResumenCostos } from "./ResumenCostos";

type Vista = "resumen" | "insumos" | "cambios";

/**
 * Sección «Costos PLUS»: resumen de costos de los asfaltos grado A, B y C.
 *
 * Es independiente del MRP (ruta, datos y almacenamiento propios) pero comparte su diseño. El centro
 * es el Resumen; el historial de precios vive en «Insumos y precios» y alimenta el costo de cada
 * receta según la fecha consultada.
 */
export function CostosApp() {
  const { datos, insumosPorId, listo, acciones } = useCostos();

  const [vista, setVista] = useState<Vista>("resumen");
  const [fecha, setFecha] = useState(hoyISO);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<{ receta: Receta | null; grado?: Grado } | null>(null);
  const [compararIds, setCompararIds] = useState<string[] | null>(null);
  const [modalParametros, setModalParametros] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 6000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const hoy = hoyISO();
  const esHistorico = fecha !== hoy;

  /** Fechas en que cambió algún precio (más recientes primero): atajo para ver el Resumen «antes» o «después». */
  const fechasDeCambio = useMemo(() => {
    const fechas = new Set<string>();
    for (const i of datos.insumos) for (const p of i.precios) fechas.add(p.fecha);
    return [...fechas].sort().reverse().slice(0, 24);
  }, [datos.insumos]);

  const detalle = datos.recetas.find((r) => r.id === detalleId) ?? null;

  const alArchivar = (receta: Receta, archivada: boolean) => {
    acciones.archivarReceta(receta.id, archivada);
    setAviso(archivada ? `«${receta.nombre}» archivada: sale del Resumen pero no se pierde.` : `«${receta.nombre}» restaurada.`);
  };
  const alDuplicar = (receta: Receta) => {
    const id = acciones.duplicarReceta(receta.id);
    if (id) setAviso(`Se creó una copia de «${receta.nombre}». Edítala para ajustar la mezcla.`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* ------------------------------ Cabecera ------------------------------ */}
      <header className="sticky top-0 z-30 bg-chrome-grad text-chrome-ink shadow-pop">
        <div className="mx-auto flex w-full max-w-[96rem] items-center justify-between gap-3 px-4 pt-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 shadow-inner backdrop-blur">
              <FlaskConical className="size-[18px] text-chrome-ink" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] leading-tight font-semibold">Costos PLUS</h1>
              <p className="truncate text-xs text-chrome-ink-2">Asfaltos grado A, B y C · soles por kg y por galón</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-chrome-line px-3 text-sm font-medium text-chrome-ink transition-colors hover:bg-chrome-2"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Planificación</span>
            </Link>
            <MenuDatos
              opciones={[
                {
                  etiqueta: "Exportar a Excel",
                  detalle: "Resumen, recetas e historial de precios",
                  icono: <Download className="size-4" />,
                  alElegir: () => void exportarCostosExcel(datos, fecha).then(() => setAviso("Excel generado con el Resumen a la fecha consultada.")),
                },
                {
                  etiqueta: "Importar precios",
                  detalle: "Insumo, fecha y precio: se suman al historial",
                  icono: <Upload className="size-4" />,
                  alElegir: () => setModalImportar(true),
                },
                {
                  etiqueta: "Parámetros de costo",
                  detalle: "Gas, mano de obra y kg por galón",
                  icono: <SlidersHorizontal className="size-4" />,
                  alElegir: () => setModalParametros(true),
                  separador: true,
                },
                {
                  etiqueta: "Restaurar datos originales",
                  detalle: "Vuelve a los datos del Excel (borra los cambios)",
                  icono: <RotateCcw className="size-4" />,
                  peligro: true,
                  alElegir: () => {
                    if (window.confirm("Esto reemplaza recetas, precios y el registro de cambios por los datos originales del Excel. ¿Continuar?")) {
                      acciones.restaurar();
                      setFecha(hoyISO());
                      setAviso("Datos originales restaurados.");
                    }
                  },
                },
              ]}
            />
            <ThemeToggle />
          </div>
        </div>

        <nav role="tablist" aria-label="Secciones de costos" className="mx-auto mt-2 flex w-full max-w-[96rem] gap-1 px-4 sm:px-6">
          {(
            [
              { clave: "resumen", etiqueta: "Resumen", icono: LayoutGrid },
              { clave: "insumos", etiqueta: "Insumos y precios", icono: BarChart3 },
              { clave: "cambios", etiqueta: "Registro de cambios", icono: History },
            ] as const
          ).map(({ clave, etiqueta, icono: Icono }) => (
            <button
              key={clave}
              type="button"
              role="tab"
              aria-selected={vista === clave}
              onClick={() => setVista(clave)}
              className={cn(
                "-mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                vista === clave ? "border-white text-white" : "border-transparent text-chrome-ink-2 hover:text-chrome-ink",
              )}
            >
              <Icono className="size-4" />
              {etiqueta}
            </button>
          ))}
        </nav>
        <div className="border-b border-white/10" />
      </header>

      {/* ------------------------------ Contenido ----------------------------- */}
      <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              {vista === "resumen" ? "Resumen de costos" : vista === "insumos" ? "Insumos y precios" : "Registro de cambios"}
            </h2>
            <p className="mt-0.5 text-sm text-ink-2">
              {vista === "resumen"
                ? "Costo de cada variante con los precios vigentes a la fecha elegida."
                : vista === "insumos"
                  ? "Cada cambio de precio se suma al historial; los anteriores se conservan."
                  : "Quién cambió qué y cuándo (en este navegador)."}
            </p>
          </div>

          {vista !== "cambios" ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label htmlFor="fecha-consulta" className="rotulo text-ink-2">
                Costos al
              </label>
              <input
                id="fecha-consulta"
                type="date"
                value={fecha}
                max="2100-12-31"
                onChange={(e) => e.target.value && setFecha(e.target.value)}
                className="h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
              <select
                aria-label="Ir a una fecha de cambio de precio"
                value=""
                onChange={(e) => e.target.value && setFecha(e.target.value)}
                className="h-9 max-w-44 cursor-pointer rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink-2"
              >
                <option value="">Ir a un cambio…</option>
                {fechasDeCambio.map((f) => (
                  <option key={f} value={f}>
                    {formatearFecha(f)}
                  </option>
                ))}
              </select>
              {esHistorico ? (
                <button
                  type="button"
                  onClick={() => setFecha(hoy)}
                  className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
                >
                  Hoy
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {esHistorico && vista !== "cambios" ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn">
            <History className="size-4 shrink-0" />
            <span>
              Estás viendo los costos al <strong>{formatearFecha(fecha)}</strong>, con los precios que regían ese día.
            </span>
            <button type="button" onClick={() => setFecha(hoy)} className="font-semibold underline underline-offset-2">
              Volver a hoy
            </button>
          </p>
        ) : null}

        {vista === "resumen" ? (
          <>
            <ResumenCostos
              datos={datos}
              insumosPorId={insumosPorId}
              fecha={fecha}
              alVerDetalle={(r) => setDetalleId(r.id)}
              alEditar={(r) => setEdicion({ receta: r })}
              alDuplicar={alDuplicar}
              alArchivar={alArchivar}
              alNueva={(grado) => setEdicion({ receta: null, grado })}
              alComparar={setCompararIds}
            />
            {NOTAS_RESUMEN.length > 0 ? (
              <ul className="px-1 text-[11px] text-ink-3">
                {NOTAS_RESUMEN.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        {vista === "insumos" ? (
          <InsumosPrecios datos={datos} insumosPorId={insumosPorId} fecha={fecha} acciones={acciones} alAviso={setAviso} />
        ) : null}

        {vista === "cambios" ? (
          <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            {datos.cambios.length === 0 ? (
              <p className="px-4 py-14 text-center text-sm text-ink-3">Aún no hay cambios registrados. Aparecerán aquí al editar precios y recetas.</p>
            ) : (
              <ul className="divide-y divide-line">
                {datos.cambios.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5 text-[13px]">
                    <span className="num w-44 shrink-0 text-xs text-ink-3">{formatearMomento(c.cuando)}</span>
                    <span className="text-ink">{c.texto}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </main>

      <footer className="border-t border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 text-xs text-ink-3 sm:px-6">
          <p>
            {listo ? "Datos guardados en este navegador" : "Cargando datos guardados…"} ·{" "}
            <span className="font-medium text-ink-2">
              {datos.recetas.filter((r) => !r.archivada).length} recetas · {datos.insumos.length} insumos
            </span>
          </p>
          <p>Origen: modelo integral de costos FLEXPAVE (hojas Precios, Grados A/B/C y Resumen)</p>
        </div>
      </footer>

      {aviso ? (
        <div
          role="status"
          className="fixed right-4 bottom-4 left-4 z-50 flex items-start justify-between gap-3 rounded-xl border border-chrome-line bg-chrome px-4 py-3 text-sm text-chrome-ink shadow-pop sm:left-auto sm:max-w-sm"
        >
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />
            {aviso}
          </p>
          <button type="button" onClick={() => setAviso(null)} aria-label="Descartar aviso" className="rounded p-0.5 text-chrome-ink-2 transition-colors hover:text-chrome-ink">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* Los modales se montan al abrirse: cada apertura parte de un estado limpio. */}
      {detalle ? (
        <DetalleRecetaModal
          receta={detalle}
          datos={datos}
          insumosPorId={insumosPorId}
          fecha={fecha}
          onCerrar={() => setDetalleId(null)}
          alEditar={() => {
            setDetalleId(null);
            setEdicion({ receta: detalle });
          }}
          alDuplicar={() => {
            alDuplicar(detalle);
            setDetalleId(null);
          }}
          alArchivar={() => {
            alArchivar(detalle, !detalle.archivada);
            setDetalleId(null);
          }}
        />
      ) : null}

      {edicion ? (
        <RecetaFormModal
          receta={edicion.receta}
          gradoInicial={edicion.grado}
          datos={datos}
          insumosPorId={insumosPorId}
          onCerrar={() => setEdicion(null)}
          onGuardar={(r) => {
            acciones.guardarReceta(r);
            setAviso(r.id ? `Receta «${r.nombre}» actualizada.` : `Receta «${r.nombre}» creada y agregada al Resumen.`);
          }}
        />
      ) : null}

      {compararIds ? (
        <CompararModal ids={compararIds} datos={datos} insumosPorId={insumosPorId} fecha={fecha} onCerrar={() => setCompararIds(null)} />
      ) : null}

      {modalParametros ? (
        <ParametrosModal
          parametros={datos.parametros}
          onCerrar={() => setModalParametros(false)}
          onGuardar={(p) => {
            acciones.actualizarParametros(p);
            setAviso("Parámetros actualizados: todas las recetas se recalcularon.");
          }}
        />
      ) : null}

      {modalImportar ? (
        <ImportarPreciosModal
          onCerrar={() => setModalImportar(false)}
          onImportar={(filas) => {
            const r = acciones.importarPrecios(filas);
            setAviso(`Importados ${r.precios} precios${r.insumosNuevos > 0 ? ` (${r.insumosNuevos} insumos nuevos)` : ""}. El historial anterior se conserva.`);
          }}
        />
      ) : null}
    </div>
  );
}
