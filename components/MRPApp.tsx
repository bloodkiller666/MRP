"use client";

import {
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Plus,
  RotateCcw,
  Route,
  Table2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ColumnasSelector } from "@/components/ColumnasSelector";
import { Dashboard } from "@/components/Dashboard";
import { ExcelImportModal } from "@/components/ExcelImportModal";
import { FiltersBar } from "@/components/FiltersBar";
import { MenuDatos } from "@/components/MenuDatos";
import { MRPTable } from "@/components/MRPTable";
import { RegistroFormModal } from "@/components/RegistroFormModal";
import { ReportModal } from "@/components/ReportModal";
import { SelectorPeriodo, SummaryCards } from "@/components/SummaryCards";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCatalogo } from "@/hooks/use-catalogo";
import { useColumnas } from "@/hooks/use-columnas";
import { useMrpStore } from "@/hooks/use-mrp-store";
import {
  ANIO_PRONOSTICO,
  CAMPOS_TEXTO,
  ETIQUETAS_CAMPO,
  ETIQUETAS_ESTADO,
  FILTROS_INICIALES,
} from "@/lib/constants";
import { exportarRegistrosExcel } from "@/lib/excel";
import {
  combinarOpciones,
  cumplimientoRegistro,
  etiquetaPeriodo,
  filtrarRegistros,
  filtrosActivos,
  mesesHasta,
  opcionesUnicas,
} from "@/lib/mrp-utils";
import { exportarRegistrosPDF } from "@/lib/pdfExport";
import type { CampoTextoMRP, EstadoCumplimiento, FiltrosMRP, MesKey, RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Vistas principales de la aplicación, alternables con pestañas. */
type Vista = "seguimiento" | "analisis";

const clasesBotonCabecera =
  "inline-flex h-9 items-center gap-2 rounded-[5px] px-3.5 text-sm font-semibold whitespace-nowrap transition-colors";

/**
 * Raíz de la aplicación MRP (Client Component).
 *
 * Concentra el estado (vía `useMrpStore` y `useCatalogo`), los filtros activos
 * (incluidos el periodo y el semáforo) y la apertura de modales; la presentación
 * se delega en `SummaryCards`, `FiltersBar`, `MRPTable` y `Dashboard`.
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
    actualizarReal,
    eliminar,
    restaurar,
    vaciar,
  } = useMrpStore();

  const { catalogo, registrarVarios, restaurar: restaurarCatalogo } = useCatalogo();

  const { ocultas, alternar: alternarColumna, mostrarTodas: mostrarTodasColumnas } = useColumnas();

  const [filtros, setFiltros] = useState<FiltrosMRP>(FILTROS_INICIALES);
  const [busqueda, setBusqueda] = useState("");
  const [hasta, setHasta] = useState<MesKey>("dic");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoCumplimiento | "">("");
  const [vista, setVista] = useState<Vista>("seguimiento");
  const [modalImportar, setModalImportar] = useState(false);
  const [modalReporte, setModalReporte] = useState(false);
  const [modalFormulario, setModalFormulario] = useState(false);
  const [registroEditando, setRegistroEditando] = useState<RegistroMRP | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  /* ----------------------------- Datos derivados ---------------------------- */

  const meses = useMemo(() => mesesHasta(hasta), [hasta]);

  /** Vista con todos los filtros salvo el semáforo: base de los contadores del semáforo. */
  const registrosParaSemaforo = useMemo(
    () => filtrarRegistros(registros, filtros, busqueda),
    [registros, filtros, busqueda],
  );

  const registrosFiltrados = useMemo(
    () =>
      estadoFiltro
        ? registrosParaSemaforo.filter((r) => cumplimientoRegistro(r, meses).estado === estadoFiltro)
        : registrosParaSemaforo,
    [registrosParaSemaforo, estadoFiltro, meses],
  );

  /**
   * Opciones por campo: el catálogo global (semilla + lo que el usuario guardó)
   * unido a los valores realmente presentes en la tabla. Es la misma lista para
   * los filtros y para los selectores del formulario.
   */
  const opciones = useMemo(() => {
    const mapa = {} as Record<CampoTextoMRP, string[]>;
    for (const campo of CAMPOS_TEXTO) {
      mapa[campo] = combinarOpciones(catalogo[campo], opcionesUnicas(registros, campo));
    }
    return mapa;
  }, [registros, catalogo]);

  /** Descripción textual de los filtros activos, para el encabezado del PDF. */
  const filtrosComoTexto = useMemo(() => {
    const textos = filtrosActivos(filtros).map(([campo, valor]) => `${ETIQUETAS_CAMPO[campo]}: ${valor}`);
    if (estadoFiltro) textos.push(`Semáforo: ${ETIQUETAS_ESTADO[estadoFiltro]}`);
    return textos;
  }, [filtros, estadoFiltro]);

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
    setEstadoFiltro("");
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
      await exportarRegistrosExcel({ registros: registrosAExportar, hasta });
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
        hasta,
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
        "Esto reemplaza los datos actuales por los 85 registros del Excel de origen (pronóstico Oct–Dic 2026) " +
          "y restablece el catálogo de valores. ¿Continuar?",
      )
    ) {
      return;
    }
    restaurar();
    restaurarCatalogo();
    mostrarAviso("Datos originales y catálogo restaurados.");
  };

  const alVaciar = () => {
    if (!window.confirm("¿Vaciar toda la tabla? Se perderán todos los registros.")) return;
    vaciar();
    mostrarAviso("Tabla vaciada. Puedes importar un Excel o restaurar los datos originales.");
  };

  const sinResultados = registrosFiltrados.length === 0;

  /* ---------------------------------- Render -------------------------------- */

  return (
    <div className="flex min-h-screen flex-col">
      {/* ------------------------------ Cabecera ------------------------------ */}
      <header className="sticky top-0 z-30 bg-chrome text-chrome-ink">
        <div className="mx-auto flex w-full max-w-[112rem] items-center justify-between gap-3 px-4 pt-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[5px] border border-chrome-line bg-chrome-2">
              <Route className="size-[18px] text-chrome-ink" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] leading-tight font-semibold">Planificación de suministro</h1>
              <p className="truncate text-xs text-chrome-ink-2">
                Asfaltos y emulsiones · Demanda {ANIO_PRONOSTICO}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={abrirNuevo}
              className={cn(clasesBotonCabecera, "bg-chrome-ink text-chrome hover:bg-white")}
            >
              <Plus className="size-4" strokeWidth={2.25} />
              <span className="hidden sm:inline">Nuevo registro</span>
              <span className="sm:hidden">Nuevo</span>
            </button>

            <MenuDatos
              opciones={[
                {
                  etiqueta: "Importar Excel",
                  detalle: "Anexa filas; reconoce el formato «Base de datos»",
                  icono: <Upload className="size-4" />,
                  alElegir: () => setModalImportar(true),
                },
                {
                  etiqueta: "Exportar a Excel",
                  detalle: "Vista actual con pronóstico, real y cumplimiento",
                  icono: <Download className="size-4" />,
                  alElegir: () => void alExportar(),
                  deshabilitada: sinResultados,
                },
                {
                  etiqueta: exportandoPdf ? "Generando PDF…" : "Exportar a PDF",
                  detalle: "Informe apaisado con semáforo",
                  icono: <FileText className="size-4" />,
                  alElegir: () => void alExportarPdf(),
                  deshabilitada: sinResultados || exportandoPdf,
                },
                {
                  etiqueta: "Reporte rápido",
                  detalle: "Cumplimiento por vendedor y producto",
                  icono: <BarChart3 className="size-4" />,
                  alElegir: () => setModalReporte(true),
                  deshabilitada: sinResultados,
                },
                {
                  etiqueta: "Restaurar datos originales",
                  detalle: "Vuelve a los 85 registros del Excel",
                  icono: <RotateCcw className="size-4" />,
                  alElegir: alRestaurar,
                  separador: true,
                },
                {
                  etiqueta: "Vaciar tabla",
                  icono: <Trash2 className="size-4" />,
                  alElegir: alVaciar,
                  peligro: true,
                },
              ]}
            />
            <ThemeToggle />
          </div>
        </div>

        <nav
          role="tablist"
          aria-label="Vistas de la aplicación"
          className="mx-auto mt-2 flex w-full max-w-[112rem] gap-1 px-4 sm:px-6"
        >
          {(
            [
              { clave: "seguimiento", etiqueta: "Seguimiento", icono: Table2 },
              { clave: "analisis", etiqueta: "Análisis", icono: LayoutDashboard },
            ] as const
          ).map(({ clave, etiqueta, icono: Icono }) => {
            const activa = vista === clave;
            return (
              <button
                key={clave}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => setVista(clave)}
                className={cn(
                  "-mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3.5 text-sm font-medium transition-colors",
                  activa
                    ? "border-chrome-ink text-chrome-ink"
                    : "border-transparent text-chrome-ink-2 hover:text-chrome-ink",
                )}
              >
                <Icono className="size-4" />
                {etiqueta}
              </button>
            );
          })}
        </nav>
        <div className="border-b border-chrome-line" />
      </header>

      {/* ------------------------------ Contenido ----------------------------- */}
      <main className="mx-auto flex w-full max-w-[112rem] flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              {vista === "seguimiento" ? "Seguimiento de demanda y cumplimiento" : "Análisis del periodo"}
            </h2>
            <p className="mt-0.5 text-sm text-ink-2">
              Pronóstico por UM de {etiquetaPeriodo(hasta, ANIO_PRONOSTICO)} · {meses.length}{" "}
              {meses.length === 1 ? "mes" : "meses"} · comparado con real + avance
            </p>
          </div>
          <SelectorPeriodo hasta={hasta} alCambiar={setHasta} />
        </div>

        <SummaryCards
          registros={registrosFiltrados}
          registrosParaSemaforo={registrosParaSemaforo}
          hasta={hasta}
          estadoFiltro={estadoFiltro}
          alCambiarEstado={setEstadoFiltro}
        />

        <FiltersBar
          busqueda={busqueda}
          alBuscar={setBusqueda}
          filtros={filtros}
          alCambiarFiltro={(campo, valor) => setFiltros((previos) => ({ ...previos, [campo]: valor }))}
          opciones={opciones}
          estadoFiltro={estadoFiltro}
          etiquetaEstado={estadoFiltro ? ETIQUETAS_ESTADO[estadoFiltro] : ""}
          alQuitarEstado={() => setEstadoFiltro("")}
          alLimpiar={alLimpiarFiltros}
          acciones={
            vista === "seguimiento" ? (
              <ColumnasSelector
                ocultas={ocultas}
                alAlternar={alternarColumna}
                alMostrarTodas={mostrarTodasColumnas}
              />
            ) : null
          }
        />

        {vista === "seguimiento" ? (
          <MRPTable
            registros={registrosFiltrados}
            totalSinFiltrar={registros.length}
            ocultas={ocultas}
            hasta={hasta}
            alActualizarCampo={actualizarCampo}
            alActualizarProyeccion={actualizarProyeccion}
            alActualizarReal={actualizarReal}
            alEliminar={alEliminar}
            alEditarFila={abrirEdicion}
          />
        ) : (
          <Dashboard registros={registrosFiltrados} hasta={hasta} />
        )}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-[112rem] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 text-xs text-ink-3 sm:px-6">
          <p className="flex items-center gap-1.5">
            <FileSpreadsheet className="size-3.5" />
            {listo ? (
              <>
                Datos guardados en este navegador ·{" "}
                <span className="font-medium text-ink-2">
                  {registros.length} registro{registros.length === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              "Cargando datos guardados…"
            )}
          </p>
          <p>Origen: Base de datos de consumo MP Asfaltos · Oct 2026</p>
        </div>
      </footer>

      {/* Aviso tipo «toast». */}
      {aviso ? (
        <div
          role="status"
          className="fixed right-4 bottom-4 left-4 z-50 flex items-start justify-between gap-3 rounded-md border border-line-strong bg-chrome px-4 py-3 text-sm text-chrome-ink shadow-xl sm:left-auto sm:max-w-sm"
        >
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />
            {aviso}
          </p>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Descartar aviso"
            className="rounded p-0.5 text-chrome-ink-2 transition-colors hover:text-chrome-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* Los modales se montan solo al abrirse: así cada apertura parte de un
          estado limpio sin necesidad de efectos de sincronización. */}
      {modalImportar ? (
        <ExcelImportModal abierto onCerrar={() => setModalImportar(false)} onImportar={alImportar} />
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
          hasta={hasta}
          onExportar={() => {
            setModalReporte(false);
            void alExportar();
          }}
        />
      ) : null}
    </div>
  );
}
