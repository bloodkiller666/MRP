"use client";

import { AlertTriangle, FileSpreadsheet, Plus, RotateCcw, Undo2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAbastecimiento } from "@/hooks/use-abastecimiento";
import { useTasas } from "@/hooks/use-tasas";
import { calcularPlan, type CompraSugerida, type MateriaPrima } from "@/lib/abastecimiento";
import { exportarAbastecimientoExcel, type PlanConMateria } from "@/lib/abastecimiento-excel";
import { exportarComprasPdf } from "@/lib/abastecimiento-pdf";
import { consumoPronosticado, extraerDemanda } from "@/lib/abastecimiento-demanda";
import { parsearMb51 } from "@/lib/mb51";
import { esAtajoDeshacer } from "@/lib/historial";
import { navegarPestanas } from "@/lib/teclado";
import { etiquetaMesAnio } from "@/lib/periodos";
import { calcularTasa } from "@/lib/tasas";
import type { MesKey, RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Boton } from "../ui/Boton";
import { formatearFechaIso, formatearTn } from "./formato";
import { FormMateriaModal, type ResultadoFormMateria } from "./FormMateriaModal";
import { GrillaMateria } from "./GrillaMateria";
import { ReporteCompras } from "./ReporteCompras";

interface PropsAbastecimiento {
  /** Todos los registros de la demanda, con la mezcla (emulsión, polímero, aditivo) ya aplicada. */
  registros: RegistroMRP[];
}

interface Mensaje {
  tipo: "ok" | "error";
  texto: string;
}

/**
 * Abastecimiento de materia prima: el MRP de inventario de las hojas «RESUMEN …» del Excel.
 *
 * - Consumo real: MB51 de SAP (clases 261 − 262).
 * - Consumo futuro: demanda de Seguimiento × Tasa de conversiones.
 * - Si el stock proyectado queda negativo (o bajo el objetivo), se sugiere comprar en múltiplos del
 *   lote mínimo y se genera el reporte de compras con la fecha límite según el tiempo de entrega.
 */
export function AbastecimientoView({ registros }: PropsAbastecimiento) {
  const { estado, acciones, puedeDeshacer } = useAbastecimiento();
  const { tasas } = useTasas();
  // Mes de hoy: la vista solo se monta al abrir la pestaña, así que no choca con la hidratación.
  const [hoy] = useState(() => new Date());
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [importando, setImportando] = useState(false);
  const [seleccion, setSeleccion] = useState(estado.materias[0]?.id ?? "");

  /** Cuadro abierto: alta (con datos de SAP opcionales) o edición de una materia prima. */
  const [modalMateria, setModalMateria] = useState<
    { modo: "crear"; precarga?: { codigo: string; nombre: string } } | { modo: "editar"; id: string } | null
  >(null);

  const alDeshacer = () => {
    if (acciones.deshacer()) setMensaje({ tipo: "ok", texto: "Se deshizo el último cambio." });
  };

  // Ctrl/Cmd + Z fuera de un campo de texto.
  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (!esAtajoDeshacer(evento)) return;
      evento.preventDefault();
      if (acciones.deshacer()) setMensaje({ tipo: "ok", texto: "Se deshizo el último cambio." });
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [acciones]);

  const demanda = useMemo(() => extraerDemanda(registros), [registros]);

  /** Materiales del MB51 que no suman a ninguna materia prima: se pueden dar de alta con un clic. */
  const sinMateria = useMemo(() => {
    const usados = new Set(estado.materias.flatMap((m) => m.codigosSap));
    return Object.entries(estado.consumosSap)
      .filter(([codigo]) => !usados.has(codigo))
      .map(([codigo, c]) => ({ codigo, nombre: c.nombre }));
  }, [estado.materias, estado.consumosSap]);

  const planes: (PlanConMateria & { fuente: string })[] = useMemo(() => {
    const mesesConSap = new Set<MesKey>();
    for (const consumo of Object.values(estado.consumosSap)) for (const mes of Object.keys(consumo.meses)) mesesConSap.add(mes);

    return estado.materias.map((mp) => {
      const consumoSap: Record<MesKey, number> = {};
      for (const codigo of mp.codigosSap) {
        for (const [mes, tn] of Object.entries(estado.consumosSap[codigo]?.meses ?? {})) {
          consumoSap[mes] = (consumoSap[mes] ?? 0) + tn;
        }
      }
      const pronostico = consumoPronosticado(mp, demanda, tasas);
      return {
        mp,
        plan: calcularPlan({ mp, consumoSap, mesesConSap, consumoPronosticado: pronostico, hoy }),
        fuente: describirFuente(mp, tasas),
      };
    });
  }, [estado, demanda, tasas, hoy]);

  const compras = useMemo(() => planes.flatMap(({ plan }) => plan.compras), [planes]);
  const enQuiebre = planes.filter(({ plan }) => plan.mesesEnQuiebre > 0);
  const lotesPorConfirmar = planes.filter(({ mp, plan }) => !mp.loteConfirmado && plan.compras.length > 0);
  const materiaElegida = planes.find(({ mp }) => mp.id === seleccion) ?? planes[0];

  const alImportar = async (archivo: File) => {
    setImportando(true);
    setMensaje(null);
    try {
      const resultado = await parsearMb51(archivo);
      acciones.importarMb51(resultado);
      const conocidos = new Set(estado.materias.flatMap((m) => m.codigosSap));
      const nuevosSinMateria = Object.keys(resultado.consumos).filter((codigo) => !conocidos.has(codigo));
      setMensaje({
        tipo: "ok",
        texto:
          `MB51 cargado: ${resultado.movimientos.toLocaleString("es-PE")} movimientos de ${Object.keys(resultado.consumos).length} materiales ` +
          `(${formatearFechaIso(resultado.desde)} al ${formatearFechaIso(resultado.hasta)}).` +
          (nuevosSinMateria.length > 0
            ? ` ${nuevosSinMateria.length} material${nuevosSinMateria.length === 1 ? "" : "es"} no está${nuevosSinMateria.length === 1 ? "" : "n"} asociado${nuevosSinMateria.length === 1 ? "" : "s"} a una materia prima (ver más abajo para agregarlos).`
            : ""),
      });
    } catch (error) {
      setMensaje({ tipo: "error", texto: error instanceof Error ? error.message : "No se pudo leer el archivo." });
    } finally {
      setImportando(false);
    }
  };

  const alConfirmar = (compra: CompraSugerida) => {
    acciones.confirmarCompra(compra.mpId, compra.proveedorId, compra.mesLlegada, compra.cantidadTn);
    setMensaje({
      tipo: "ok",
      texto: `Se anotó el ingreso de ${formatearTn(compra.cantidadTn)} TN de ${compra.mpNombre} (${compra.proveedor}) en ${etiquetaMesAnio(compra.mesLlegada)}.`,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="font-display text-[1.95rem] leading-[1.1] font-medium tracking-[-0.015em] text-ink">
            Abastecimiento de materia prima
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-2">
            Stock proyectado de cada materia prima. El consumo real viene de SAP (MB51); el futuro, de la demanda de
            Seguimiento por la Tasa de conversiones.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={entradaArchivo}
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            tabIndex={-1}
            aria-label="Archivo MB51 de SAP"
            onChange={(evento) => {
              const archivo = evento.target.files?.[0];
              evento.target.value = "";
              if (archivo) void alImportar(archivo);
            }}
          />
          <Boton
            variante="primario"
            icono={<Upload className="size-4" />}
            disabled={importando}
            onClick={() => entradaArchivo.current?.click()}
            title="Carga el reporte MB51 de SAP con los movimientos 261 y 262"
          >
            {importando ? "Leyendo MB51…" : "Importar MB51 (SAP)"}
          </Boton>
          <Boton
            variante="secundario"
            icono={<Plus className="size-4" />}
            onClick={() => setModalMateria({ modo: "crear" })}
            title="Da de alta una materia prima nueva con su proveedor"
          >
            Nueva materia prima
          </Boton>
          <Boton
            variante="fantasma"
            icono={<Undo2 className="size-4" />}
            disabled={!puedeDeshacer}
            onClick={alDeshacer}
            title="Vuelve a la versión anterior (Ctrl + Z)"
          >
            Deshacer
          </Boton>
          <Boton
            variante="fantasma"
            icono={<RotateCcw className="size-4" />}
            onClick={() => {
              if (window.confirm("Esto vuelve a los parámetros, ingresos y consumos del Excel. ¿Continuar?")) {
                acciones.restaurar();
                setMensaje({ tipo: "ok", texto: "Datos originales del Excel restaurados." });
              }
            }}
          >
            Restaurar
          </Boton>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-3">
        <FileSpreadsheet className="size-3.5" aria-hidden />
        Consumo real: <span className="font-medium text-ink-2">{estado.mb51.archivo}</span> ·{" "}
        {estado.mb51.movimientos.toLocaleString("es-PE")} movimientos · {formatearFechaIso(estado.mb51.desde)} al{" "}
        {formatearFechaIso(estado.mb51.hasta)}
      </p>

      {mensaje ? (
        <p
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border px-3.5 py-2.5 text-sm",
            mensaje.tipo === "error" ? "border-bad-line bg-bad-soft text-bad" : "border-ok-line bg-ok-soft text-ok",
          )}
        >
          {mensaje.texto}
        </p>
      ) : null}

      {sinMateria.length > 0 ? (
        <details className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm">
          <summary className="cursor-pointer font-medium text-ink-2">
            {sinMateria.length} material{sinMateria.length === 1 ? "" : "es"} de SAP sin materia prima asociada
          </summary>
          <p className="mt-2 text-xs text-ink-3">
            Consumen según el MB51 pero no entran al MRP. Elija uno para darlo de alta con su código y nombre ya cargados.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {sinMateria.map(({ codigo, nombre }) => (
              <li key={codigo}>
                <button
                  type="button"
                  onClick={() => setModalMateria({ modo: "crear", precarga: { codigo, nombre } })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-accent hover:text-ink"
                >
                  <Plus className="size-3" aria-hidden />
                  <span className="num">{codigo}</span> {nombre}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {enQuiebre.length > 0 ? (
        <div role="alert" className="flex gap-3 rounded-lg border border-bad-line bg-bad-soft px-3.5 py-3 text-sm text-bad">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">
              {enQuiebre.length} materia{enQuiebre.length === 1 ? "" : "s"} prima{enQuiebre.length === 1 ? "" : "s"} se
              quedaría{enQuiebre.length === 1 ? "" : "n"} sin stock si no se compra:
            </span>{" "}
            {enQuiebre.map(({ mp, plan }) => `${mp.nombre} (desde ${etiquetaMesAnio(plan.primerQuiebre ?? "")})`).join(" · ")}.
          </p>
        </div>
      ) : null}

      {lotesPorConfirmar.length > 0 ? (
        <p className="text-xs text-warn">
          {lotesPorConfirmar.length} materia{lotesPorConfirmar.length === 1 ? "" : "s"} prima
          {lotesPorConfirmar.length === 1 ? "" : "s"} con compra sugerida usa{lotesPorConfirmar.length === 1 ? "" : "n"} un
          lote mínimo provisional ({lotesPorConfirmar.map(({ mp }) => mp.nombre).join(", ")}): se usó el tamaño habitual de
          sus ingresos. Cargue el lote real en los parámetros de cada materia prima.
        </p>
      ) : null}

      <ReporteCompras
        compras={compras}
        hoy={hoy}
        alConfirmar={alConfirmar}
        alVerMateria={(id) => {
          setSeleccion(id);
          document.getElementById("mrp-materia")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        alDescargar={() => void exportarAbastecimientoExcel(planes, hoy)}
        alDescargarPdf={(visibles, horizonteMeses) => void exportarComprasPdf({ compras: visibles, hoy, horizonteMeses })}
      />

      <section id="mrp-materia" aria-label="MRP por materia prima" className="flex scroll-mt-20 flex-col gap-3">
        <div role="tablist" aria-label="Materia prima" onKeyDown={navegarPestanas} className="flex flex-wrap gap-1.5">
          {planes.map(({ mp, plan }) => {
            const activa = mp.id === materiaElegida?.mp.id;
            const estadoMp = plan.mesesEnQuiebre > 0 ? "quiebre" : plan.compras.length > 0 ? "compra" : "ok";
            return (
              <button
                key={mp.id}
                type="button"
                role="tab"
                id={`pestana-mp-${mp.id}`}
                aria-selected={activa}
                aria-controls="panel-mp"
                tabIndex={activa ? 0 : -1}
                onClick={() => setSeleccion(mp.id)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-[background-color,border-color,color] duration-150",
                  activa
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    estadoMp === "quiebre" ? "bg-bad" : estadoMp === "compra" ? "bg-warn" : "bg-ok",
                  )}
                  aria-hidden
                />
                {mp.nombre.replace(/ \(.*\)$/, "")}
                <span className="sr-only">
                  {estadoMp === "quiebre" ? ", con quiebre de stock" : estadoMp === "compra" ? ", con compra sugerida" : ", sin alertas"}
                </span>
              </button>
            );
          })}
        </div>

        {materiaElegida ? (
          <div id="panel-mp" role="tabpanel" aria-labelledby={`pestana-mp-${materiaElegida.mp.id}`}>
            <GrillaMateria
              mp={materiaElegida.mp}
              plan={materiaElegida.plan}
              acciones={acciones}
              fuenteDemanda={materiaElegida.fuente}
              alEditarMateria={() => setModalMateria({ modo: "editar", id: materiaElegida.mp.id })}
              alEliminarMateria={() => {
                const { mp } = materiaElegida;
                if (!window.confirm(`¿Eliminar «${mp.nombre}» y todo lo cargado en ella (ingresos, consumos manuales)? Puede deshacerlo con Ctrl + Z.`)) return;
                acciones.eliminarMateria(mp.id);
                setMensaje({ tipo: "ok", texto: `Se eliminó «${mp.nombre}». Si fue un error, use «Deshacer».` });
              }}
            />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-2">
            No hay materias primas. Agregue una con «Nueva materia prima» o use «Restaurar» para volver a las del Excel.
          </p>
        )}
      </section>

      {modalMateria ? (
        <FormMateriaModal
          key={modalMateria.modo === "editar" ? modalMateria.id : (modalMateria.precarga?.codigo ?? "nueva")}
          materia={modalMateria.modo === "editar" ? estado.materias.find((m) => m.id === modalMateria.id) : undefined}
          precarga={modalMateria.modo === "crear" ? modalMateria.precarga : undefined}
          nombresExistentes={estado.materias
            .filter((m) => modalMateria.modo !== "editar" || m.id !== modalMateria.id)
            .map((m) => m.nombre)}
          codigosEnUso={
            new Map(
              estado.materias
                .filter((m) => modalMateria.modo !== "editar" || m.id !== modalMateria.id)
                .flatMap((m) => m.codigosSap.map((c) => [c, m.nombre] as const)),
            )
          }
          tasasDisponibles={tasas.map((t) => t.mp)}
          onCerrar={() => setModalMateria(null)}
          onGuardar={(resultado: ResultadoFormMateria) => {
            if (resultado.modo === "crear") {
              const id = acciones.agregarMateria(resultado.datos);
              setSeleccion(id);
              setMensaje({ tipo: "ok", texto: `Se creó «${resultado.datos.nombre}». Cargue su stock inicial e ingresos en la grilla.` });
            } else if (modalMateria.modo === "editar") {
              acciones.actualizarDatosMateria(modalMateria.id, resultado.cambios);
              setMensaje({ tipo: "ok", texto: `Se actualizaron los datos de «${resultado.cambios.nombre}».` });
            }
            setModalMateria(null);
          }}
        />
      ) : null}
    </div>
  );
}

function describirFuente(mp: MateriaPrima, tasas: ReturnType<typeof useTasas>["tasas"]): string {
  if (!mp.regla || !mp.tasaMp) return "Consumo futuro: promedio de los últimos 3 meses (sin regla en la demanda)";
  const tasa = tasas.find((t) => t.mp === mp.tasaMp);
  if (!tasa) return "Consumo futuro: promedio de los últimos 3 meses (falta la tasa)";
  const kg = calcularTasa(tasa).kgPorCisterna;
  const campo = mp.regla.campo === "emulsion" ? "emulsión" : mp.regla.campo === "polimero" ? "polímero" : "aditivo";
  return `Consumo futuro: cisternas con ${campo} ${mp.regla.valor} × ${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(kg)} kg por cisterna`;
}
