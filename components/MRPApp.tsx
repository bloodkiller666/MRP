"use client";

import {
  BarChart3,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileText,
  HardHat,
  Plus,
  RotateCcw,
  Table as IconoTabla,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ColumnasSelector } from "@/components/ColumnasSelector";
import { Dashboard } from "@/components/Dashboard";
import { ExcelImportModal } from "@/components/ExcelImportModal";
import { FiltersBar } from "@/components/FiltersBar";
import { MRPTable } from "@/components/MRPTable";
import { RegistroFormModal } from "@/components/RegistroFormModal";
import { ReportModal } from "@/components/ReportModal";
import { SummaryCards } from "@/components/SummaryCards";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Boton } from "@/components/ui/Boton";
import { useCatalogo } from "@/hooks/use-catalogo";
import { useColumnas } from "@/hooks/use-columnas";
import { useMrpStore } from "@/hooks/use-mrp-store";
import { CAMPOS_TEXTO, ETIQUETAS_CAMPO, FILTROS_INICIALES } from "@/lib/constants";
import { exportarRegistrosExcel } from "@/lib/excel";
import { combinarOpciones, filtrarRegistros, filtrosActivos, opcionesUnicas } from "@/lib/mrp-utils";
import { exportarRegistrosPDF } from "@/lib/pdfExport";
import type { CampoTextoMRP, FiltrosMRP, RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Vistas principales de la aplicación, alternables con pestañas. */
type Vista = "tabla" | "dashboard";

/**
 * Raíz de la aplicación MRP (Client Component).
 *
 * Concentra el estado (vía `useMrpStore` y `useCatalogo`), los filtros activos y
 * la apertura de modales; la presentación se delega en `SummaryCards`,
 * `FiltersBar` y `MRPTable`.
 */
export function MRPApp() {
  const {
    registros,
    listo,
    importar,
    agregar,
    actualizar,
    actualizarCampo,
    actualizarProyeccion,
    eliminar,
    restaurar,
    vaciar,
  } = useMrpStore();

  const { catalogo, registrarVarios, restaurar: restaurarCatalogo } = useCatalogo();

  const {
    ocultas,
    alternar: alternarColumna,
    mostrarTodas: mostrarTodasColumnas,
  } = useColumnas();

  const [filtros, setFiltros] = useState<FiltrosMRP>(FILTROS_INICIALES);
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<Vista>("tabla");
  const [modalImportar, setModalImportar] = useState(false);
  const [modalReporte, setModalReporte] = useState(false);
  const [modalFormulario, setModalFormulario] = useState(false);
  const [registroEditando, setRegistroEditando] = useState<RegistroMRP | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  /* ----------------------------- Datos derivados ---------------------------- */

  const registrosFiltrados = useMemo(
    () => filtrarRegistros(registros, filtros, busqueda),
    [registros, filtros, busqueda],
  );

  /**
   * Opciones por campo: el catálogo global (semilla + lo que el usuario guardó)
   * unido a los valores realmente presentes en la tabla. Es la misma lista para
   * los filtros y para los selectores del formulario, así un valor nuevo aparece
   * en ambos sin recargar la página.
   */
  const opciones = useMemo(() => {
    const mapa = {} as Record<CampoTextoMRP, string[]>;
    for (const campo of CAMPOS_TEXTO) {
      mapa[campo] = combinarOpciones(catalogo[campo], opcionesUnicas(registros, campo));
    }
    return mapa;
  }, [registros, catalogo]);

  /** Descripción textual de los filtros activos, para el encabezado del PDF. */
  const filtrosComoTexto = useMemo(
    () => filtrosActivos(filtros).map(([campo, valor]) => `${ETIQUETAS_CAMPO[campo]}: ${valor}`),
    [filtros],
  );

  /* ------------------------------- Avisos (UI) ------------------------------ */

  const mostrarAviso = useCallback((mensaje: string) => setAviso(mensaje), []);

  useEffect(() => {
    if (!aviso) return;
    const temporizador = window.setTimeout(() => setAviso(null), 5000);
    return () => window.clearTimeout(temporizador);
  }, [aviso]);

  /* --------------------------------- Acciones ------------------------------- */

  const alLimpiarFiltros = () => {
    setFiltros(FILTROS_INICIALES);
    setBusqueda("");
  };

  const alImportar = (nuevos: RegistroMRP[]) => {
    const cantidad = importar(nuevos);
    mostrarAviso(
      `Se anexaron ${cantidad} registro${cantidad === 1 ? "" : "s"}. ` +
        `La tabla ahora tiene ${registros.length + cantidad} registros.`,
    );
  };

  const alExportar = async (registrosAExportar: RegistroMRP[] = registrosFiltrados) => {
    if (registrosAExportar.length === 0) {
      mostrarAviso("No hay registros en la vista actual para exportar.");
      return;
    }
    try {
      await exportarRegistrosExcel({ registros: registrosAExportar });
      mostrarAviso(`Exportados ${registrosAExportar.length} registros a Excel.`);
    } catch {
      mostrarAviso("Ocurrió un error al generar el archivo de Excel.");
    }
  };

  const alExportarPdf = async () => {
    if (registrosFiltrados.length === 0) {
      mostrarAviso("No hay registros en la vista actual para exportar.");
      return;
    }
    setExportandoPdf(true);
    try {
      await exportarRegistrosPDF({
        registros: registrosFiltrados,
        filtrosAplicados: filtrosComoTexto,
        busqueda,
        columnasOcultas: ocultas,
      });
      mostrarAviso(`PDF generado con ${registrosFiltrados.length} registros de la vista actual.`);
    } catch {
      mostrarAviso("Ocurrió un error al generar el PDF.");
    } finally {
      setExportandoPdf(false);
    }
  };

  const alEliminar = (registro: RegistroMRP) => {
    const etiqueta = registro.detalleProducto || registro.cuenta || "el registro";
    if (!window.confirm(`¿Eliminar «${etiqueta}»? Esta acción no se puede deshacer.`)) return;
    eliminar(registro.id);
    mostrarAviso("Registro eliminado.");
  };

  const abrirNuevo = () => {
    setRegistroEditando(null);
    setModalFormulario(true);
  };

  const abrirEdicion = (registro: RegistroMRP) => {
    setRegistroEditando(registro);
    setModalFormulario(true);
  };

  const alGuardarFormulario = (datos: Omit<RegistroMRP, "id">) => {
    // Todo valor inédito pasa al catálogo global: queda disponible de inmediato
    // en los filtros y en el siguiente registro.
    registrarVarios(datos);

    if (registroEditando) {
      actualizar({ ...datos, id: registroEditando.id });
      mostrarAviso("Registro actualizado.");
    } else {
      agregar(datos);
      mostrarAviso("Registro anexado al final de la tabla.");
    }
    setRegistroEditando(null);
  };

  const alRestaurar = () => {
    if (
      !window.confirm(
        "Esto reemplaza los datos actuales por los 8 registros de ejemplo y restablece el catálogo de valores. ¿Continuar?",
      )
    ) {
      return;
    }
    restaurar();
    restaurarCatalogo();
    mostrarAviso("Datos de ejemplo y catálogo restaurados.");
  };

  const alVaciar = () => {
    if (!window.confirm("¿Vaciar toda la tabla? Se perderán todos los registros.")) return;
    vaciar();
    mostrarAviso("Tabla vaciada. Puedes importar un Excel o restaurar los ejemplos.");
  };

  /* ---------------------------------- Render -------------------------------- */

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-700">
              <HardHat className="size-5 text-white" />
            </span>
            <div>
              <h1 className="text-base leading-tight font-semibold text-slate-900 dark:text-white">
                MRP · Planificación de Requerimientos de Materiales
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Proyección mensual de insumos asfálticos · Apurímac, Cusco, Lima y más
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Boton
              variante="primario"
              onClick={abrirNuevo}
              icono={<Plus className="size-4" />}
            >
              Agregar registro
            </Boton>
            <Boton
              onClick={() => setModalImportar(true)}
              icono={<Upload className="size-4" />}
            >
              Importar Excel
            </Boton>
            <Boton
              onClick={() => void alExportar()}
              disabled={registrosFiltrados.length === 0}
              icono={<Download className="size-4" />}
            >
              Exportar Excel
            </Boton>
            <Boton
              onClick={() => void alExportarPdf()}
              disabled={registrosFiltrados.length === 0 || exportandoPdf}
              icono={<FileText className="size-4" />}
            >
              {exportandoPdf ? "Generando PDF…" : "Exportar a PDF"}
            </Boton>
            <Boton
              onClick={() => setModalReporte(true)}
              disabled={registrosFiltrados.length === 0}
              icono={<BarChart3 className="size-4" />}
            >
              Reporte rápido
            </Boton>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-4 px-4 py-4">
        {aviso ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              {aviso}
            </p>
            <button
              type="button"
              onClick={() => setAviso(null)}
              aria-label="Descartar aviso"
              className="rounded p-0.5 text-emerald-700 transition-colors hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/60"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        <SummaryCards registros={registrosFiltrados} />

        <FiltersBar
          busqueda={busqueda}
          alBuscar={setBusqueda}
          filtros={filtros}
          alCambiarFiltro={(campo, valor) =>
            setFiltros((previos) => ({ ...previos, [campo]: valor }))
          }
          opciones={opciones}
          alLimpiar={alLimpiarFiltros}
          acciones={
            <ColumnasSelector
              ocultas={ocultas}
              alAlternar={alternarColumna}
              alMostrarTodas={mostrarTodasColumnas}
            />
          }
        />

        {/* Pestañas para alternar la vista de tabla con la vista analítica. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Vistas de la aplicación"
            className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <button
              type="button"
              role="tab"
              aria-selected={vista === "tabla"}
              onClick={() => setVista("tabla")}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                vista === "tabla"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
              )}
            >
              <IconoTabla className="size-4" />
              Vista de Tabla (Data)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={vista === "dashboard"}
              onClick={() => setVista("dashboard")}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                vista === "dashboard"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
              )}
            >
              <BarChart3 className="size-4" />
              Vista Analítica (Dashboard)
            </button>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Los totales y gráficos reflejan siempre la vista filtrada actual.
          </p>
        </div>

        {vista === "tabla" ? (
          <MRPTable
            registros={registrosFiltrados}
            totalSinFiltrar={registros.length}
            ocultas={ocultas}
            alActualizarCampo={actualizarCampo}
            alActualizarProyeccion={actualizarProyeccion}
            alEliminar={alEliminar}
            alEditarFila={abrirEdicion}
          />
        ) : (
          <Dashboard registros={registrosFiltrados} />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
          <p className="flex items-center gap-1.5">
            <Database className="size-3.5 text-slate-400 dark:text-slate-500" />
            {listo ? (
              <>
                Estado guardado automáticamente en este navegador (localStorage) ·{" "}
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {registros.length} registro{registros.length === 1 ? "" : "s"} en total
                </span>
              </>
            ) : (
              "Cargando datos guardados…"
            )}
          </p>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
              <Cloud className="size-3.5" />
              Sin base de datos: todo en memoria del navegador
            </span>
            <Boton
              tamano="sm"
              variante="fantasma"
              onClick={alRestaurar}
              icono={<RotateCcw className="size-3.5" />}
            >
              Restaurar ejemplos
            </Boton>
            <Boton
              tamano="sm"
              variante="peligro"
              onClick={alVaciar}
              icono={<Trash2 className="size-3.5" />}
            >
              Vaciar
            </Boton>
          </div>
        </div>
      </footer>

      {/* Los modales se montan solo al abrirse: así cada apertura parte de un
          estado limpio sin necesidad de efectos de sincronización. */}
      {modalImportar ? (
        <ExcelImportModal
          abierto
          onCerrar={() => setModalImportar(false)}
          onImportar={alImportar}
        />
      ) : null}

      {modalFormulario ? (
        <RegistroFormModal
          abierto
          onCerrar={() => {
            setModalFormulario(false);
            setRegistroEditando(null);
          }}
          onGuardar={alGuardarFormulario}
          registro={registroEditando}
          sugerencias={opciones}
        />
      ) : null}

      {modalReporte ? (
        <ReportModal
          abierto
          onCerrar={() => setModalReporte(false)}
          registros={registrosFiltrados}
          onExportar={() => {
            setModalReporte(false);
            void alExportar();
          }}
        />
      ) : null}
    </div>
  );
}
