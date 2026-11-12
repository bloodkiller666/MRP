"use client";

import {
  BarChart3,
  Boxes,
  CheckCircle2,
  History,
  ClipboardPenLine,
  Download,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Plus,
  RotateCcw,
  Scale,
  Table2,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AbastecimientoView } from "@/components/abastecimiento/AbastecimientoView";
import { ColumnasSelector } from "@/components/ColumnasSelector";
import { Dashboard } from "@/components/Dashboard";
import { ImportarCorteModal } from "@/components/ImportarCorteModal";
import { SoloLecturaContext } from "@/components/ui/SoloLectura";
import { useCortes } from "@/hooks/use-cortes";
import { useHistorialMp } from "@/hooks/use-historial-mp";
import type { LibroMensual } from "@/lib/consumo-excel";
import { CapturaReal } from "@/components/CapturaReal";
import { ExcelImportModal } from "@/components/ExcelImportModal";
import { FiltersBar } from "@/components/FiltersBar";
import { MarcaMRP } from "@/components/MarcaMRP";
import { MenuDatos } from "@/components/MenuDatos";
import { MRPTable } from "@/components/MRPTable";
import { PeriodoModal } from "@/components/PeriodoModal";
import { RegistroFormModal } from "@/components/RegistroFormModal";
import { ReportModal } from "@/components/ReportModal";
import { TasaConversionesModal } from "@/components/TasaConversionesModal";
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
import { convertirACisternas, convertirATM, desdeCisternas, desdeTM } from "@/lib/conversion";
import { conMezcla } from "@/lib/mezclas";
import { esAtajoDeshacer } from "@/lib/historial";
import { navegarPestanas } from "@/lib/teclado";

import { EsqueletoSeguimiento } from "./ui/Esqueleto";
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
  etiquetaMesAnio,
  etiquetaRango,
  indiceDeMes,
  mesesDePeriodo,
  periodosFaltantes,
} from "@/lib/periodos";
import { AvisoSync, EstadoSync } from "@/components/ui/EstadoSync";
import { exportarRegistrosPDF } from "@/lib/pdfExport";
import type { CampoTextoMRP, EstadoCumplimiento, FiltrosMRP, MesKey, Periodo, RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Vistas principales de la aplicación, alternables con pestañas. */
type Vista = "seguimiento" | "real" | "analisis" | "abastecimiento";

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
    registros: registrosGuardados,
    listo,
    importarCombinando: importarCombinandoActual,
    agregar: agregarActual,
    actualizar: actualizarActual,
    actualizarCampo: actualizarCampoActual,
    actualizarProyeccion: actualizarProyeccionActual,
    actualizarReal: actualizarRealActual,
    actualizarProbabilidad: actualizarProbabilidadActual,
    actualizarComentario: actualizarComentarioActual,
    eliminar: eliminarActual,
    restaurar: restaurarActual,
    vaciar: vaciarActual,
    deshacer: deshacerActual,
    puedeDeshacer,
  } = useMrpStore();

  /** Cortes mensuales (fotos de Seguimiento de cada mes) y su historial de Abastecimiento. */
  const { cortes, guardar: guardarCorte } = useCortes();
  const { importar: importarHistorial } = useHistorialMp();
  /** «actual» = los registros vigentes (editables); un mes = el corte de ese mes (solo lectura). */
  const [corteElegido, setCorteElegido] = useState<MesKey | "actual">("actual");
  const corte = corteElegido === "actual" ? undefined : cortes[corteElegido];
  const soloLectura = corte !== undefined;

  /** Los campos de mezcla vacíos toman el valor de la regla (lib/mezclas.ts); lo escrito a mano manda. */
  const registros = useMemo(
    () => (corte ? corte.registros : registrosGuardados).map(conMezcla),
    [corte, registrosGuardados],
  );

  /** Registros vigentes con la mezcla aplicada: son los que ve Abastecimiento aunque Seguimiento muestre un corte. */
  const registrosActuales = useMemo(() => registrosGuardados.map(conMezcla), [registrosGuardados]);

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
  const [modoUnidad, setModoUnidad] = useState<"original" | "tm" | "cisternas">("original");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoCumplimiento | "">("");
  const [vista, setVista] = useState<Vista>("seguimiento");
  const [modalImportar, setModalImportar] = useState(false);
  const [modalCorte, setModalCorte] = useState(false);
  const [modalReporte, setModalReporte] = useState(false);
  const [modalTasas, setModalTasas] = useState(false);
  const [modalFormulario, setModalFormulario] = useState(false);
  const [registroEditando, setRegistroEditando] = useState<RegistroMRP | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [avisoConDeshacer, setAvisoConDeshacer] = useState(false);
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

  const enTM = modoUnidad !== "original";

  /** Lo que se ve y se exporta: los registros filtrados, en su UM o convertidos a TM. */
  const registrosMostrados = useMemo(
    () =>
      modoUnidad === "tm"
        ? convertirATM(registrosFiltrados)
        : modoUnidad === "cisternas"
          ? convertirACisternas(registrosFiltrados)
          : registrosFiltrados,
    [modoUnidad, registrosFiltrados],
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

  /** `conDeshacer` agrega el botón «Deshacer» al aviso (para eliminar, importar y otros cambios grandes). */
  const mostrarAviso = useCallback((mensaje: string, conDeshacer = false) => {
    setAviso(mensaje);
    setAvisoConDeshacer(conDeshacer);
  }, []);

  /** En un corte (solo lectura) ningún cambio llega a los datos: se avisa en vez de guardar. */
  const protegida = <F extends (...argumentos: never[]) => unknown>(accion: F): F =>
    ((...argumentos: Parameters<F>) => {
      if (soloLectura) {
        mostrarAviso("Este corte es solo lectura. Vuelve a «Datos actuales» para editar.");
        return undefined;
      }
      return accion(...argumentos);
    }) as F;
  const importarCombinando = protegida(importarCombinandoActual);
  const agregar = protegida(agregarActual);
  const actualizar = protegida(actualizarActual);
  const actualizarCampo = protegida(actualizarCampoActual);
  const actualizarProyeccion = protegida(actualizarProyeccionActual);
  const actualizarReal = protegida(actualizarRealActual);
  const actualizarProbabilidad = protegida(actualizarProbabilidadActual);
  const actualizarComentario = protegida(actualizarComentarioActual);
  const eliminar = protegida(eliminarActual);
  const restaurar = protegida(restaurarActual);
  const vaciar = protegida(vaciarActual);
  const deshacer = protegida(deshacerActual);

  useEffect(() => {
    if (!aviso) return;
    const temporizador = window.setTimeout(() => setAviso(null), avisoConDeshacer ? 9000 : 5000);
    return () => window.clearTimeout(temporizador);
  }, [aviso, avisoConDeshacer]);

  const alDeshacer = useCallback(() => {
    if (deshacer()) mostrarAviso("Se deshizo el último cambio.");
  }, [deshacer, mostrarAviso]);

  // Ctrl/Cmd + Z fuera de un campo de texto. En Abastecimiento lo atiende esa pestaña.
  useEffect(() => {
    if (vista === "abastecimiento") return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (!esAtajoDeshacer(evento)) return;
      evento.preventDefault();
      alDeshacer();
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [vista, alDeshacer]);

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

  /** Cambia entre los datos actuales y un corte mensual; el corte se ve con todo su año. */
  const elegirCorte = (valor: MesKey | "actual") => {
    setCorteElegido(valor);
    setHastaElegido("");
    if (valor === "actual") {
      setPeriodoElegido(null);
      return;
    }
    const periodo: Periodo = { desde: `${anioDeMes(valor)}-01`, cantidad: 12 };
    agregarPeriodos([periodo]);
    setPeriodoElegido(periodo);
    if (vista === "real") setVista("seguimiento");
  };

  /** Guarda el libro mensual: el corte de Seguimiento y el historial de Abastecimiento. No toca lo actual. */
  const alCargarCorte = (libro: LibroMensual) => {
    guardarCorte(libro.mes, libro.archivo, libro.registros);
    importarHistorial(libro.series, libro.mes, libro.archivo);
    elegirCorte(libro.mes);
    mostrarAviso(
      `Corte de ${etiquetaMesAnio(libro.mes)} cargado: ${libro.registros.length} registros y ${libro.series.length} materias primas.`,
    );
  };

  const alImportar = (nuevos: RegistroMRP[]) => {
    const { anexados, actualizados } = importarCombinando(nuevos);
    // Si se abre un periodo nuevo, el registro cambia en dos stores; «Deshacer» solo revierte los registros.

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
      true,
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
    if (!window.confirm(`¿Eliminar «${etiqueta}»?`)) return;
    eliminar(registro.id);
    mostrarAviso("Registro eliminado.", true);
  };

  /** En vista TM las cifras se escriben en toneladas: se guardan de vuelta en la UM original del registro. */
  const aUnidadOriginal = (id: string, valor?: number) => {
    if (valor === undefined || !enTM) return valor;
    const original = registros.find((r) => r.id === id);
    if (!original) return valor;
    return modoUnidad === "cisternas" ? desdeCisternas(original, valor) : desdeTM(original, valor);
  };
  const editarProyeccion = (id: string, mes: MesKey, valor?: number) =>
    actualizarProyeccion(id, mes, aUnidadOriginal(id, valor));
  const editarReal = (id: string, mes: MesKey, valor?: number) => actualizarReal(id, mes, aUnidadOriginal(id, valor));
  const editarCampo = (id: string, campo: CampoTextoMRP, valor: string) => {
    if (enTM && campo === "unidadMedida") {
      mostrarAviso("En esta vista no se cambia la unidad: vuelve a «UM original» para editarla.");
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
    <SoloLecturaContext.Provider value={soloLectura}>
    <div className="flex min-h-screen flex-col">
      {/* ------------------------------ Cabecera ------------------------------ */}
      <header className="sticky top-0 z-30 border-b border-chrome-line bg-chrome-grad text-chrome-ink shadow-pop">
        <div className="franja-via" aria-hidden="true" />
        <div className="mx-auto flex w-full max-w-[112rem] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.07] text-chrome-ink shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]">
              <MarcaMRP className="size-6" />
            </span>
            <h1 className="truncate text-[15px] leading-tight font-semibold tracking-[-0.005em]">
              Planificación de suministro
            </h1>
          </div>

        <nav
          role="tablist"
          aria-label="Vistas de la aplicación"
          onKeyDown={navegarPestanas}
          className="order-last flex w-full gap-1 md:order-none md:w-auto"
        >
          {(
            [
              { clave: "seguimiento", etiqueta: "Seguimiento", icono: Table2 },
              { clave: "real", etiqueta: "Cargar real", icono: ClipboardPenLine },
              { clave: "analisis", etiqueta: "Análisis", icono: LayoutDashboard },
              { clave: "abastecimiento", etiqueta: "Abastecimiento", icono: Boxes },
            ] as const
          ).map(({ clave, etiqueta, icono: Icono }) => {
            const activa = vista === clave;
            return (
              <button
                key={clave}
                type="button"
                role="tab"
                id={`pestana-${clave}`}
                aria-selected={activa}
                aria-controls="panel-vista"
                tabIndex={activa ? 0 : -1}
                onClick={() => setVista(clave)}
                disabled={clave === "real" && soloLectura}
                title={clave === "real" && soloLectura ? "No disponible en un corte (solo lectura)" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-[background-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-40",
                  activa
                    ? "bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
                    : "text-chrome-ink-2 hover:bg-white/[0.05] hover:text-chrome-ink",
                )}
              >
                <Icono className={cn("size-4", activa && "text-[var(--marca)]")} />
                {etiqueta}
              </button>
            );
          })}
        </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/costos"
              title="Costos PLUS: costos de asfaltos grado A, B y C"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-chrome-line px-3 text-sm font-medium text-chrome-ink transition-colors hover:bg-chrome-2"
            >
              <FlaskConical className="size-4 text-chrome-ink-2" />
              <span className="hidden xl:inline">Costos PLUS</span>
            </Link>
            <button
              type="button"
              onClick={abrirNuevo}
              disabled={soloLectura}
              title={soloLectura ? "Los cortes son de solo lectura" : undefined}
              className={cn(clasesBotonCabecera, "bg-white text-chrome shadow-sm hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50")}
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
                  deshabilitada: soloLectura,
                },
                {
                  etiqueta: "Importar corte mensual",
                  detalle: "Libro «Consumo MP Asfaltos» de un mes, aparte de lo actual",
                  icono: <History className="size-4" />,
                  alElegir: () => setModalCorte(true),
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
                  etiqueta: "Tasa de conversiones",
                  detalle: "Materia prima por cisterna (kg, TM, galones)",
                  icono: <Scale className="size-4" />,
                  alElegir: () => setModalTasas(true),
                },
                {
                  etiqueta: "Restaurar datos originales",
                  detalle: "Vuelve a los 85 registros del Excel",
                  icono: <RotateCcw className="size-4" />,
                  alElegir: alRestaurar,
                  deshabilitada: soloLectura,
                  separador: true,
                },
                {
                  etiqueta: "Vaciar tabla",
                  icono: <Trash2 className="size-4" />,
                  alElegir: alVaciar,
                  deshabilitada: soloLectura,
                  peligro: true,
                },
              ]}
            />
            <ThemeToggle />
          </div>
        </div>

      </header>

      <AvisoSync />

      <ImportarCorteModal
        abierto={modalCorte}
        onCerrar={() => setModalCorte(false)}
        cortesExistentes={Object.keys(cortes)}
        onCargar={alCargarCorte}
      />

      {/* ------------------------------ Contenido ----------------------------- */}
      <main
        id="panel-vista"
        role="tabpanel"
        aria-labelledby={`pestana-${vista}`}
        className="mx-auto flex w-full max-w-[112rem] flex-1 flex-col gap-4 px-4 py-5 sm:px-6"
      >
        {vista === "abastecimiento" ? (
          <AbastecimientoView registros={registrosActuales} />
        ) : (
          <>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2 className="font-display text-[1.95rem] leading-[1.1] font-medium tracking-[-0.015em] text-ink">
              {vista === "seguimiento"
                ? "Seguimiento de demanda y cumplimiento"
                : vista === "real"
                  ? "Carga de pronóstico y real"
                  : "Análisis del periodo"}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Asfaltos y emulsiones · Pronóstico por UM de {etiquetaRango(meses)} · {meses.length} {meses.length === 1 ? "mes" : "meses"} ·
              comparado con real + avance
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {Object.keys(cortes).length > 0 ? (
            <label className="flex items-center gap-2.5">
              <span className="rotulo hidden text-ink-2 sm:inline">Datos</span>
              <select
                aria-label="Datos a ver: actuales o un corte mensual"
                value={soloLectura ? corteElegido : "actual"}
                onChange={(evento) => elegirCorte(evento.target.value as MesKey | "actual")}
                className="h-9 cursor-pointer rounded-lg border border-line-strong bg-surface pr-8 pl-2.5 text-sm font-medium text-ink"
              >
                <option value="actual">Datos actuales</option>
                {Object.keys(cortes)
                  .sort()
                  .map((mes) => (
                    <option key={mes} value={mes}>
                      Corte de {etiquetaMesAnio(mes)}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
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
                  ["cisternas", "Cisternas", "Todo en cisternas de 8 000 galones, como el encabezado naranja del Excel"],
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
        {modoUnidad === "tm" ? (
          <p className="-mt-2 text-xs text-ink-3">
            Vista en toneladas (TM), con las fórmulas del Excel: GLN × 3,785 ÷ 1000 · KG ÷ 1000 · asfaltos modificados
            × 95 % · emulsión × 65 %. Las unidades sin conversión (p. ej. UND) se muestran aparte.
          </p>
        ) : null}
        {modoUnidad === "cisternas" ? (
          <p className="-mt-2 text-xs text-ink-3">
            Vista en cisternas de 8 000 galones: GLN ÷ 8000 · KG ÷ 8000 ÷ 3,785 · TN × 1000 ÷ 8000 ÷ 3,785. Las unidades
            sin conversión (p. ej. UND) se muestran aparte.
          </p>
        ) : null}

        {corte ? (
          <p
            role="status"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-2 text-sm text-ink"
          >
            <History className="size-4 shrink-0 text-warn" />
            <span>
              Estás viendo el <strong>corte de {etiquetaMesAnio(corte.mes)}</strong> ({corte.archivo}), cargado el{" "}
              {corte.importadoEn ? new Date(corte.importadoEn).toLocaleDateString("es-PE") : "—"}. Es solo lectura y no afecta a los datos actuales.
            </span>
            <button
              type="button"
              onClick={() => elegirCorte("actual")}
              className="ml-auto rounded-md border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-3"
            >
              Volver a datos actuales
            </button>
          </p>
        ) : null}

        {!listo ? (
          <EsqueletoSeguimiento />
        ) : (
          <>
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
            alActualizarCampo={(id, campo, valor) => {
              editarCampo(id, campo, valor);
              if (valor.trim()) registrarVarios({ [campo]: valor });
            }}
            opciones={opciones}
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
          </>
        )}
          </>
        )}
      </main>

      <footer className="border-t border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[112rem] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 text-xs text-ink-3 sm:px-6">
          <p className="flex items-center gap-1.5">
            <FileSpreadsheet className="size-3.5" />
            {listo ? (
              <>
                <EstadoSync /> ·{" "}
                <span className="font-medium text-ink-2">
                  {registros.length} registro{registros.length === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              "Cargando datos…"
            )}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={alDeshacer}
              disabled={!puedeDeshacer}
              title="Vuelve a la versión anterior de los registros (Ctrl + Z)"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <Undo2 className="size-3.5" aria-hidden />
              Deshacer
              <kbd className="rounded border border-line px-1 font-sans text-[10px] text-ink-3">Ctrl Z</kbd>
            </button>
            <p>Origen: Excel «Consumo MP Asfaltos», hoja Base de datos</p>
          </div>
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
          {avisoConDeshacer ? (
            <button
              type="button"
              onClick={() => {
                alDeshacer();
              }}
              className="shrink-0 rounded-md border border-chrome-line px-2 py-0.5 text-xs font-semibold text-chrome-ink transition-colors hover:bg-chrome-2"
            >
              Deshacer
            </button>
          ) : null}
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

      {modalTasas ? <TasaConversionesModal abierto onCerrar={() => setModalTasas(false)} /> : null}

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
    </SoloLecturaContext.Provider>
  );
}
