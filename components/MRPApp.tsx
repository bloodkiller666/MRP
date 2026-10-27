"use client";

import {
  BarChart3,
  CheckCircle2,
  ClipboardPenLine,
  Download,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Plus,
  RotateCcw,
  Route,
  Table2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ColumnasSelector } from "@/components/ColumnasSelector";
import { Dashboard } from "@/components/Dashboard";
import { CapturaReal } from "@/components/CapturaReal";
import { ExcelImportModal } from "@/components/ExcelImportModal";
import { FiltersBar } from "@/components/FiltersBar";
import { MenuDatos } from "@/components/MenuDatos";
import { MRPTable } from "@/components/MRPTable";
import { PeriodoModal } from "@/components/PeriodoModal";
import { RegistroFormModal } from "@/components/RegistroFormModal";
import { ReportModal } from "@/components/ReportModal";
import { SelectorPeriodo, SummaryCards } from "@/components/SummaryCards";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCatalogo } from "@/hooks/use-catalogo";
import { useColumnas } from "@/hooks/use-columnas";
import { useMrpStore } from "@/hooks/use-mrp-store";
import { usePeriodos } from "@/hooks/use-periodos";
import {
  CAMPOS_TEXTO,
  ETIQUETAS_CAMPO,
  ETIQUETAS_ESTADO,
  FILTROS_INICIALES,
} from "@/lib/constants";
import { convertirATM, desdeTM } from "@/lib/conversion";
import { exportarRegistrosExcel } from "@/lib/excel";
import {
  combinarOpciones,
  cumplimientoRegistro,
  filtrarRegistros,
  filtrosActivos,
  mesesHasta,
  opcionesUnicas,
  tieneDatosEnMeses,
} from "@/lib/mrp-utils";
import {
  anioDeMes,
  claveMes,
  etiquetaRango,
  indiceDeMes,
  mesesDePeriodo,
  periodosFaltantes,
} from "@/lib/periodos";
import { exportarRegistrosPDF } from "@/lib/pdfExport";
import type { CampoTextoMRP, EstadoCumplimiento, FiltrosMRP, MesKey, Periodo, RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Vistas principales de la aplicación, alternables con pestañas. */
type Vista = "seguimiento" | "real" | "analisis";

const clasesBotonCabecera =
  "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap transition-colors";

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
    importarCombinando,
    agregar,
    actualizar,
    actualizarCampo,
    actualizarProyeccion,
    actualizarReal,
    actualizarProbabilidad,
    actualizarComentario,
    eliminar,
    restaurar,
    vaciar,
  } = useMrpStore();

  const { catalogo, registrarVarios, restaurar: restaurarCatalogo } = useCatalogo();

  const { ocultas, alternar: alternarColumna, mostrarTodas: mostrarTodasColumnas } = useColumnas();

  const { periodos, agregar: agregarPeriodos, quitar: quitarPeriodo, restaurar: restaurarPeriodos } = usePeriodos();

  const [filtros, setFiltros] = useState<FiltrosMRP>(FILTROS_INICIALES);
  const [busqueda, setBusqueda] = useState("");
  const [periodoElegido, setPeriodoElegido] = useState<Periodo | null>(null);
  const [hastaElegido, setHastaElegido] = useState<MesKey | "">("");
  const [soloConDatos, setSoloConDatos] = useState(false);
  const [modalPeriodo, setModalPeriodo] = useState(false);
  /** «original» muestra cada UM por separado; «tm» lo convierte todo a toneladas con las fórmulas del Excel. */
  const [modoUnidad, setModoUnidad] = useState<"original" | "tm">("original");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoCumplimiento | "">("");
  const [vista, setVista] = useState<Vista>("seguimiento");
  const [modalImportar, setModalImportar] = useState(false);
  const [modalReporte, setModalReporte] = useState(false);
  const [modalFormulario, setModalFormulario] = useState(false);
  const [registroEditando, setRegistroEditando] = useState<RegistroMRP | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  /* ----------------------------- Datos derivados ---------------------------- */

  /** Periodo activo: el elegido, o el que contiene el mes actual (si no, el último ya iniciado). */
  const periodoActivo = useMemo<Periodo>(() => {
    const vigente = periodoElegido
      ? periodos.find((p) => p.desde === periodoElegido.desde && p.cantidad === periodoElegido.cantidad)
      : undefined;
    if (vigente) return vigente;

    const hoy = new Date();
    const mesActual = claveMes(hoy.getFullYear(), hoy.getMonth());
    return (
      periodos.find((p) => mesesDePeriodo(p).includes(mesActual)) ??
      [...periodos].reverse().find((p) => p.desde <= mesActual) ??
      periodos[0]
    );
  }, [periodos, periodoElegido]);

  const mesesPeriodo = useMemo(() => mesesDePeriodo(periodoActivo), [periodoActivo]);
  const hasta = mesesPeriodo.includes(hastaElegido) ? hastaElegido : mesesPeriodo[mesesPeriodo.length - 1];
  const meses = useMemo(() => mesesHasta(mesesPeriodo, hasta), [mesesPeriodo, hasta]);

  /** Mes siguiente al último periodo: punto de partida sugerido al crear uno nuevo. */
  const mesSugerido = useMemo(() => {
    const ultimos = periodos.map((p) => mesesDePeriodo(p).at(-1) ?? p.desde).sort();
    const ultimo = ultimos[ultimos.length - 1] ?? periodoActivo.desde;
    const siguiente = anioDeMes(ultimo) * 12 + indiceDeMes(ultimo) + 1;
    return { anio: Math.floor(siguiente / 12), indiceMes: siguiente % 12 };
  }, [periodos, periodoActivo]);

  /** Vista con todos los filtros salvo el semáforo: base de los contadores del semáforo. */
  const registrosParaSemaforo = useMemo(() => {
    const filtrados = filtrarRegistros(registros, filtros, busqueda);
    return soloConDatos ? filtrados.filter((r) => tieneDatosEnMeses(r, mesesPeriodo)) : filtrados;
  }, [registros, filtros, busqueda, soloConDatos, mesesPeriodo]);

  /** Registros que no tienen pronóstico ni real en el periodo (se ocultan con «Solo con datos»). */
  const sinDatosEnPeriodo = useMemo(
    () => registros.filter((r) => !tieneDatosEnMeses(r, mesesPeriodo)).length,
    [registros, mesesPeriodo],
  );

  const registrosFiltrados = useMemo(
    () =>
      estadoFiltro
        ? registrosParaSemaforo.filter((r) => cumplimientoRegistro(r, meses).estado === estadoFiltro)
        : registrosParaSemaforo,
    [registrosParaSemaforo, estadoFiltro, meses],
  );

  const enTM = modoUnidad === "tm";

  /** Lo que se ve y se exporta: los registros filtrados, en su UM o convertidos a TM. */
  const registrosMostrados = useMemo(
    () => (enTM ? convertirATM(registrosFiltrados) : registrosFiltrados),
    [enTM, registrosFiltrados],
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

  const elegirPeriodo = (periodo: Periodo) => {
    setPeriodoElegido(periodo);
    setHastaElegido("");
  };

  const alImportar = (nuevos: RegistroMRP[]) => {
    const { anexados, actualizados } = importarCombinando(nuevos);

    // Los meses del archivo que ningún periodo cubre abren su propio periodo.
    const mesesArchivo = new Set<MesKey>();
    for (const registro of nuevos) {
      for (const mes of Object.keys(registro.proyecciones)) mesesArchivo.add(mes);
      for (const mes of Object.keys(registro.reales)) mesesArchivo.add(mes);
    }
    const creados = periodosFaltantes(mesesArchivo, periodos);
    if (creados.length > 0) agregarPeriodos(creados);

    const partes = [
      actualizados > 0 ? `${actualizados} actualizado${actualizados === 1 ? "" : "s"}` : "",
      anexados > 0 ? `${anexados} nuevo${anexados === 1 ? "" : "s"}` : "",
    ].filter(Boolean);
    mostrarAviso(
      `Importación lista: ${partes.join(" y ") || "sin cambios"}.` +
        (creados.length > 0
          ? ` Se abrió el periodo ${creados.map((p) => etiquetaRango(mesesDePeriodo(p))).join(", ")}.`
          : ""),
    );
  };

  const alExportar = async (registrosAExportar: RegistroMRP[] = registrosMostrados) => {
    if (registrosAExportar.length === 0) {
      mostrarAviso("No hay registros en la vista actual para exportar.");
      return;
    }
    try {
      await exportarRegistrosExcel({ registros: registrosAExportar, meses });
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
        registros: registrosMostrados,
        meses,
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

  /** En vista TM las cifras se escriben en toneladas: se guardan de vuelta en la UM original del registro. */
  const aUnidadOriginal = (id: string, valor?: number) => {
    if (valor === undefined || !enTM) return valor;
    const original = registros.find((r) => r.id === id);
    return original ? desdeTM(original, valor) : valor;
  };
  const editarProyeccion = (id: string, mes: MesKey, valor?: number) =>
    actualizarProyeccion(id, mes, aUnidadOriginal(id, valor));
  const editarReal = (id: string, mes: MesKey, valor?: number) => actualizarReal(id, mes, aUnidadOriginal(id, valor));
  const editarCampo = (id: string, campo: CampoTextoMRP, valor: string) => {
    if (enTM && campo === "unidadMedida") {
      mostrarAviso("En la vista TM no se cambia la unidad: vuelve a «UM original» para editarla.");
      return;
    }
    actualizarCampo(id, campo, valor);
  };

  /** Abre la carga de pronóstico y real ya filtrada por el vendedor elegido en el análisis. */
  const cargarDeVendedor = (vendedor: string) => {
    setFiltros((previos) => ({ ...previos, propietario: vendedor }));
    setVista("real");
  };

  const abrirNuevo = () => {
    setRegistroEditando(null);
    setModalFormulario(true);
  };

  const abrirEdicion = (registro: RegistroMRP) => {
    // El formulario trabaja siempre con el registro original (en su UM), aunque la vista esté en TM.
    setRegistroEditando(registros.find((r) => r.id === registro.id) ?? registro);
    setModalFormulario(true);
  };

  const alGuardarFormulario = (datos: Omit<RegistroMRP, "id">) => {
    // Todo valor inédito pasa al catálogo global: queda disponible de inmediato
    // en los filtros y en el siguiente registro.
    registrarVarios(datos);

    if (registroEditando) {
      actualizar({ ...registroEditando, ...datos, id: registroEditando.id });
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
    restaurarPeriodos();
    setPeriodoElegido(null);
    setHastaElegido("");
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
      <header className="sticky top-0 z-30 bg-chrome-grad text-chrome-ink shadow-pop">
        <div className="mx-auto flex w-full max-w-[112rem] items-center justify-between gap-3 px-4 pt-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 shadow-inner backdrop-blur">
              <Route className="size-[18px] text-chrome-ink" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] leading-tight font-semibold">Planificación de suministro</h1>
              <p className="truncate text-xs text-chrome-ink-2">
                Asfaltos y emulsiones · Demanda {etiquetaRango(mesesPeriodo)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/costos"
              title="Costos PLUS: costos de asfaltos grado A, B y C"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-chrome-line px-3 text-sm font-medium text-chrome-ink transition-colors hover:bg-chrome-2"
            >
              <FlaskConical className="size-4 text-chrome-ink-2" />
              <span className="hidden md:inline">Costos PLUS</span>
            </Link>
            <button
              type="button"
              onClick={abrirNuevo}
              className={cn(clasesBotonCabecera, "bg-white text-chrome shadow-sm hover:bg-accent-soft")}
            >
              <Plus className="size-4" strokeWidth={2.25} />
              <span className="hidden sm:inline">Nuevo registro</span>
              <span className="sm:hidden">Nuevo</span>
            </button>

            <MenuDatos
              opciones={[
                {
                  etiqueta: "Importar Excel",
                  detalle: "Actualiza filas existentes y anexa las nuevas",
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
              { clave: "real", etiqueta: "Cargar real", icono: ClipboardPenLine },
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
                    ? "border-white text-white"
                    : "border-transparent text-chrome-ink-2 hover:text-chrome-ink",
                )}
              >
                <Icono className="size-4" />
                {etiqueta}
              </button>
            );
          })}
        </nav>
        <div className="border-b border-white/10" />
      </header>

      {/* ------------------------------ Contenido ----------------------------- */}
      <main className="mx-auto flex w-full max-w-[112rem] flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              {vista === "seguimiento"
                ? "Seguimiento de demanda y cumplimiento"
                : vista === "real"
                  ? "Carga de pronóstico y real"
                  : "Análisis del periodo"}
            </h2>
            <p className="mt-0.5 text-sm text-ink-2">
              Pronóstico por UM de {etiquetaRango(meses)} · {meses.length} {meses.length === 1 ? "mes" : "meses"} ·
              comparado con real + avance
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <span className="rotulo hidden text-ink-2 sm:inline">Unidad</span>
            <div
              role="radiogroup"
              aria-label="Unidad de visualización"
              className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5"
            >
              {(
                [
                  ["original", "UM original", "Cada unidad (GLN, KG…) por separado"],
                  ["tm", "TM", "Todo en toneladas, con las fórmulas de conversión del Excel"],
                ] as const
              ).map(([clave, etiqueta, ayuda]) => (
                <button
                  key={clave}
                  type="button"
                  role="radio"
                  aria-checked={modoUnidad === clave}
                  title={ayuda}
                  onClick={() => setModoUnidad(clave)}
                  className={cn(
                    "h-7 rounded-md px-3 text-xs font-semibold transition-colors",
                    modoUnidad === clave
                      ? "bg-accent text-accent-ink shadow-sm"
                      : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                  )}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          </div>
          <SelectorPeriodo
            periodos={periodos}
            periodoActivo={periodoActivo}
            alElegirPeriodo={elegirPeriodo}
            alCrearPeriodo={() => setModalPeriodo(true)}
            mesesPeriodo={mesesPeriodo}
            hasta={hasta}
            alCambiar={setHastaElegido}
          />
          </div>
        </div>
        {enTM ? (
          <p className="-mt-2 text-xs text-ink-3">
            Vista en toneladas (TM), con las fórmulas del Excel: GLN × 3,785 ÷ 1000 · KG ÷ 1000 · asfaltos modificados
            × 95 % · emulsión × 65 %. Las unidades sin conversión (p. ej. UND) se muestran aparte.
          </p>
        ) : null}

        <SummaryCards
          registros={registrosMostrados}
          registrosParaSemaforo={registrosParaSemaforo}
          meses={meses}
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
            <>
              {sinDatosEnPeriodo > 0 ? (
                <label
                  className="flex cursor-pointer items-center gap-2 text-sm whitespace-nowrap text-ink-2"
                  title="Oculta los registros que no tienen pronóstico ni real en ningún mes del periodo"
                >
                  <input
                    type="checkbox"
                    checked={soloConDatos}
                    onChange={(evento) => setSoloConDatos(evento.target.checked)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  Solo con datos en el periodo
                  <span className="text-xs text-ink-3">({sinDatosEnPeriodo} sin datos)</span>
                </label>
              ) : null}
              {vista === "seguimiento" ? (
                <ColumnasSelector
                  ocultas={ocultas}
                  alAlternar={alternarColumna}
                  alMostrarTodas={mostrarTodasColumnas}
                />
              ) : null}
            </>
          }
        />

        {vista === "real" ? (
          <CapturaReal
            registros={registrosMostrados}
            meses={meses}
            alActualizarReal={editarReal}
            alActualizarProyeccion={editarProyeccion}
            alActualizarProbabilidad={actualizarProbabilidad}
            alActualizarComentario={actualizarComentario}
          />
        ) : vista === "seguimiento" ? (
          <MRPTable
            registros={registrosMostrados}
            totalSinFiltrar={registros.length}
            ocultas={ocultas}
            meses={meses}
            alActualizarCampo={editarCampo}
            alActualizarProyeccion={editarProyeccion}
            alActualizarReal={editarReal}
            alEliminar={alEliminar}
            alEditarFila={abrirEdicion}
          />
        ) : (
          <Dashboard registros={registrosMostrados} meses={meses} alCargarVendedor={cargarDeVendedor} />
        )}
      </main>

      <footer className="border-t border-line bg-surface/80 backdrop-blur">
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
          className="fixed right-4 bottom-4 left-4 z-50 flex items-start justify-between gap-3 rounded-xl border border-chrome-line bg-chrome px-4 py-3 text-sm text-chrome-ink shadow-pop sm:left-auto sm:max-w-sm"
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
        <ExcelImportModal
          abierto
          onCerrar={() => setModalImportar(false)}
          onImportar={alImportar}
          mesesPeriodo={mesesPeriodo}
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
          meses={mesesPeriodo}
        />
      ) : null}

      {modalPeriodo ? (
        <PeriodoModal
          abierto
          onCerrar={() => setModalPeriodo(false)}
          periodos={periodos}
          sugerido={mesSugerido}
          onCrear={(periodo) => {
            agregarPeriodos([periodo]);
            elegirPeriodo(periodo);
            mostrarAviso(`Periodo ${etiquetaRango(mesesDePeriodo(periodo))} creado. Carga el pronóstico o importa un Excel.`);
          }}
          onQuitar={quitarPeriodo}
        />
      ) : null}

      {modalReporte ? (
        <ReportModal
          abierto
          onCerrar={() => setModalReporte(false)}
          registros={registrosMostrados}
          meses={meses}
          onExportar={() => {
            setModalReporte(false);
            void alExportar();
          }}
        />
      ) : null}
    </div>
  );
}
