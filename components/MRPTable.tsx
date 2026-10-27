"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, EyeOff, Inbox, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { CAMPOS_TEXTO, ETIQUETAS_CAMPO, TIPOS_APLICACION, UNIDADES_MEDIDA } from "@/lib/constants";
import {
  cumplimientoRegistro,
  formatearNumero,
  resumenPorUnidad,
  resumirPeriodo,
  type ResumenPeriodo,
} from "@/lib/mrp-utils";
import { abarcaVariosAnios, anioDeMes, etiquetaMes, nombreMes } from "@/lib/periodos";
import type { CampoTextoMRP, ColumnaTabla, EstadoCumplimiento, MesKey, RegistroMRP } from "@/lib/types";
import { cn } from "@/lib/utils";

import { EditableCell } from "./EditableCell";
import { BarraCumplimiento, EstadoPastilla } from "./Semaforo";

interface MRPTableProps {
  /** Registros ya filtrados (lo que se ve y se exporta). */
  registros: RegistroMRP[];
  /** Total de registros sin filtrar, para el contador del pie. */
  totalSinFiltrar: number;
  /** Columnas de texto ocultas. Solo afecta a la vista, nunca a los totales. */
  ocultas: ColumnaTabla[];
  /** Meses que se muestran (del inicio del periodo hasta el mes elegido). */
  meses: MesKey[];
  alActualizarCampo: (id: string, campo: CampoTextoMRP, valor: string) => void;
  alActualizarProyeccion: (id: string, mes: MesKey, valor?: number) => void;
  alActualizarReal: (id: string, mes: MesKey, valor?: number) => void;
  alEliminar: (registro: RegistroMRP) => void;
  alEditarFila: (registro: RegistroMRP) => void;
}

type ClaveOrden = "propietario" | "cuenta" | "detalleProducto" | "demanda" | "real" | "cumplimiento";
interface Orden {
  clave: ClaveOrden;
  direccion: "asc" | "desc";
}

/** Posición fija a la derecha de las tres columnas de cierre (junto a «Acciones», 4 rem). */
const POS_CUMPL = "sticky right-16";
const POS_REAL = "sticky right-[14.5rem]";
const POS_DEMANDA = "sticky right-[22.5rem]";
const CELDA_CIERRE = "z-[5] border-b border-line bg-surface-2 px-3 py-2 text-[13px]";
const ALTO_PIE = 2.5;
const PIE_CIERRE = "z-20 h-10 border-t border-line-strong bg-chrome px-3 py-0 text-chrome-ink";

/** Ancho máximo del texto de cada columna (se trunca con «…»; el título muestra el valor completo). */
const ANCHO_TEXTO: Partial<Record<CampoTextoMRP, string>> = {
  propietario: "max-w-[9.5rem]",
  cuenta: "max-w-[15rem]",
  detalleProducto: "max-w-[11rem]",
  tipoAplicacion: "max-w-[9rem]",
  departamento: "max-w-[8rem]",
  proyecto: "max-w-[16rem]",
  grupoLinea: "max-w-[10rem]",
  refineria: "max-w-[8rem]",
};

const clasesTh =
  "sticky z-10 border-b border-line-strong bg-surface-2 px-3 text-left align-bottom whitespace-nowrap";

/** Cabecera ordenable: muestra la flecha de la columna activa. */
function CabeceraOrdenable({
  etiqueta,
  clave,
  orden,
  alOrdenar,
  derecha,
  className,
}: {
  etiqueta: string;
  clave: ClaveOrden;
  orden: Orden | null;
  alOrdenar: (clave: ClaveOrden) => void;
  derecha?: boolean;
  className?: string;
}) {
  const activa = orden?.clave === clave;
  const Icono = !activa ? ArrowUpDown : orden.direccion === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      rowSpan={2}
      aria-sort={activa ? (orden.direccion === "asc" ? "ascending" : "descending") : "none"}
      className={cn(clasesTh, "top-0 pb-2", derecha && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => alOrdenar(clave)}
        className={cn(
          "rotulo inline-flex items-center gap-1 text-ink-2 transition-colors hover:text-ink",
          activa && "text-ink",
        )}
      >
        {etiqueta}
        <Icono className={cn("size-3", activa ? "text-accent" : "text-ink-3")} />
      </button>
    </th>
  );
}

/**
 * Tabla de seguimiento.
 *
 * Pronóstico por mes (de octubre hasta el mes elegido) junto al despacho real,
 * más el cierre del periodo: total demanda, real + avance y cumplimiento con
 * semáforo. En pantallas pequeñas se presenta como tarjetas.
 *
 * Las columnas de texto pueden ocultarse; los totales y el cumplimiento se
 * calculan siempre sobre todos los datos.
 */
export function MRPTable({
  registros,
  totalSinFiltrar,
  ocultas,
  meses,
  alActualizarCampo,
  alActualizarProyeccion,
  alActualizarReal,
  alEliminar,
  alEditarFila,
}: MRPTableProps) {
  const [orden, setOrden] = useState<Orden | null>(null);
  /** En móvil las tarjetas se muestran de 20 en 20. */
  const [limiteMovil, setLimiteMovil] = useState(20);

  const variosAnios = abarcaVariosAnios(meses);
  const mesesVisibles = useMemo(
    () =>
      meses.map((key) => ({
        key,
        label: variosAnios ? `${etiquetaMes(key)} ${anioDeMes(key)}` : etiquetaMes(key),
        nombre: variosAnios ? `${etiquetaMes(key)} ${anioDeMes(key)}` : nombreMes(key),
      })),
    [meses, variosAnios],
  );
  const camposVisibles = CAMPOS_TEXTO.filter((campo) => !ocultas.includes(campo));
  const resumen = useMemo(() => resumirPeriodo(registros, meses), [registros, meses]);
  // Nunca se suman unidades distintas: con varias UM el pie trae un total por cada una.
  const porUnidad = useMemo(() => resumenPorUnidad(registros, meses), [registros, meses]);
  const hayVariasUM = porUnidad.length > 1;

  const filas = useMemo(() => {
    const conCumplimiento = registros.map((registro) => ({
      registro,
      c: cumplimientoRegistro(registro, meses),
    }));
    if (!orden) return conCumplimiento;

    const signo = orden.direccion === "asc" ? 1 : -1;
    return [...conCumplimiento].sort((a, b) => {
      switch (orden.clave) {
        case "demanda":
          return (a.c.demanda - b.c.demanda) * signo;
        case "real":
          return (a.c.real - b.c.real) * signo;
        case "cumplimiento":
          // Los registros sin ratio (sin real / sin pronóstico) quedan siempre al final.
          if (a.c.ratio === null || b.c.ratio === null) {
            return a.c.ratio === b.c.ratio ? 0 : a.c.ratio === null ? 1 : -1;
          }
          return (a.c.ratio - b.c.ratio) * signo;
        default:
          return a.registro[orden.clave].localeCompare(b.registro[orden.clave], "es") * signo;
      }
    });
  }, [registros, meses, orden]);

  const alOrdenar = (clave: ClaveOrden) =>
    setOrden((previo) => {
      if (previo?.clave !== clave) return { clave, direccion: clave === "cumplimiento" ? "asc" : "desc" };
      if (previo.direccion === "desc" && clave !== "cumplimiento") return { clave, direccion: "asc" };
      if (previo.direccion === "asc" && clave === "cumplimiento") return { clave, direccion: "desc" };
      return null;
    });

  // Texto de la fila: se reparte en la cabecera ordenable o en una cabecera simple.
  const ordenables: Partial<Record<CampoTextoMRP, ClaveOrden>> = {
    propietario: "propietario",
    cuenta: "cuenta",
    detalleProducto: "detalleProducto",
  };

  const columnasTotales = camposVisibles.length + mesesVisibles.length * 2 + 4;

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      {/* ------------------------------ Escritorio ------------------------------ */}
      <div className="hidden max-h-[min(70vh,48rem)] min-h-64 overflow-auto md:block">
        <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              {camposVisibles.map((campo) => {
                const clave = ordenables[campo];
                return clave ? (
                  <CabeceraOrdenable
                    key={campo}
                    etiqueta={ETIQUETAS_CAMPO[campo]}
                    clave={clave}
                    orden={orden}
                    alOrdenar={alOrdenar}
                  />
                ) : (
                  <th key={campo} scope="col" rowSpan={2} className={cn(clasesTh, "top-0 pb-2")}>
                    <span className="rotulo text-ink-2">{ETIQUETAS_CAMPO[campo]}</span>
                  </th>
                );
              })}

              {mesesVisibles.map((mes) => (
                <th
                  key={mes.key}
                  scope="colgroup"
                  colSpan={2}
                  className={cn(
                    clasesTh,
                    "top-0 h-8 border-l border-line-strong py-0 text-center text-ink",
                  )}
                >
                  <span className="rotulo">
                    {mes.nombre}
                  </span>
                </th>
              ))}

              <th
                scope="colgroup"
                colSpan={3}
                className={cn(clasesTh, "top-0 right-16 z-20! h-8 border-l border-line-strong bg-accent-soft py-0 text-center")}
              >
                <span className="rotulo text-accent">
                  Cierre del periodo
                </span>
              </th>
              <th scope="col" rowSpan={2} className={cn(clasesTh, "top-0 right-0 z-20! w-16 pb-2 text-center")}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
            <tr>
              {mesesVisibles.map((mes) => (
                <ThMes key={mes.key} />
              ))}
              <CabeceraSimple
                etiqueta="Total demanda"
                clave="demanda"
                orden={orden}
                alOrdenar={alOrdenar}
                posicion={`${POS_DEMANDA} w-32 min-w-32 border-l border-line-strong`}
              />
              <CabeceraSimple
                etiqueta="Real + avance"
                clave="real"
                orden={orden}
                alOrdenar={alOrdenar}
                posicion={`${POS_REAL} w-32 min-w-32`}
              />
              <CabeceraSimple
                etiqueta="Cumplimiento"
                clave="cumplimiento"
                orden={orden}
                alOrdenar={alOrdenar}
                izquierda
                posicion={`${POS_CUMPL} w-[10.5rem] min-w-[10.5rem]`}
              />
            </tr>
          </thead>

          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={columnasTotales} className="px-4 py-16 text-center">
                  <Inbox className="mx-auto mb-3 size-8 text-line-strong" />
                  <p className="text-sm font-medium text-ink">No hay registros que coincidan</p>
                  <p className="mt-1 text-xs text-ink-3">
                    Ajusta los filtros, importa un Excel o agrega un registro manualmente.
                  </p>
                </td>
              </tr>
            ) : (
              filas.map(({ registro, c }) => (
                <tr key={registro.id} className="group">
                  {camposVisibles.map((campo, indice) => {
                    const claseBorde =
                      indice === 0 ? cn("border-l-[3px]", bordeEstado(c.estado)) : undefined;

                    if (campo === "unidadMedida" || campo === "tipoAplicacion") {
                      return (
                        <EditableCell
                          key={campo}
                          valor={registro[campo]}
                          tipo="select"
                          opciones={
                            campo === "unidadMedida"
                              ? unirOpciones(UNIDADES_MEDIDA, registro.unidadMedida)
                              : ["", ...unirOpciones(TIPOS_APLICACION, registro.tipoAplicacion)]
                          }
                          vacio={campo === "tipoAplicacion" ? "Sin definir" : undefined}
                          anchoTexto={ANCHO_TEXTO[campo]}
                          className={cn(claseBorde, campo === "unidadMedida" && "text-ink-2")}
                          alGuardar={(valor) => alActualizarCampo(registro.id, campo, String(valor ?? ""))}
                        />
                      );
                    }

                    return (
                      <EditableCell
                        key={campo}
                        valor={registro[campo]}
                        tipo="texto"
                        anchoTexto={ANCHO_TEXTO[campo]}
                        className={cn(claseBorde, campo === "cuenta" && "font-medium")}
                        alGuardar={(valor) => alActualizarCampo(registro.id, campo, String(valor ?? ""))}
                      />
                    );
                  })}

                  {mesesVisibles.map((mes) => (
                    <FragmentoMes
                      key={mes.key}
                      pron={registro.proyecciones[mes.key]}
                      real={registro.reales[mes.key]}
                      alGuardarPron={(valor) => alActualizarProyeccion(registro.id, mes.key, valor)}
                      alGuardarReal={(valor) => alActualizarReal(registro.id, mes.key, valor)}
                    />
                  ))}

                  <td className={cn(CELDA_CIERRE, POS_DEMANDA, "num border-l text-right font-semibold")}>
                    {formatearNumero(c.demanda)}
                  </td>
                  <td className={cn(CELDA_CIERRE, POS_REAL, "num text-right font-semibold")}>
                    {c.estado === "sin-real" ? (
                      <span className="font-normal text-ink-3">–</span>
                    ) : (
                      formatearNumero(c.real)
                    )}
                  </td>
                  <td className={cn(CELDA_CIERRE, POS_CUMPL)}>
                    <div className="flex items-center gap-2.5">
                      {c.ratio !== null ? (
                        <BarraCumplimiento estado={c.estado} ratio={c.ratio} className="w-16" />
                      ) : null}
                      <EstadoPastilla
                        estado={c.estado}
                        ratio={c.ratio}
                        className={cn(c.ratio !== null && "min-w-[4.25rem] justify-center")}
                      />
                    </div>
                  </td>

                  <td className="sticky right-0 z-[5] border-b border-line bg-surface px-2 py-1.5">
                    <div className="flex items-center justify-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => alEditarFila(registro)}
                        title="Editar registro completo"
                        aria-label="Editar registro completo"
                        className="rounded p-1.5 text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => alEliminar(registro)}
                        title="Eliminar registro"
                        aria-label="Eliminar registro"
                        className="rounded p-1.5 text-ink-2 transition-colors hover:bg-bad-soft hover:text-bad"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          <tfoot>
            {(hayVariasUM ? porUnidad : [{ unidad: "", registros: registros.length, resumen }]).map(
              ({ unidad, resumen: r, registros: cantidad }, indice, lista) => (
                <FilaPie
                  key={unidad || "total"}
                  etiqueta={hayVariasUM ? `Total ${unidad}` : "Total del periodo"}
                  detalle={
                    hayVariasUM ? `${cantidad} registros` : `${registros.length} de ${totalSinFiltrar} registros`
                  }
                  resumen={r}
                  meses={meses}
                  columnasTexto={Math.max(camposVisibles.length, 1)}
                  // Cada fila de totales se ancla sobre la anterior al hacer scroll vertical.
                  inferior={`${(lista.length - 1 - indice) * ALTO_PIE}rem`}
                />
              ),
            )}
          </tfoot>
        </table>
      </div>

      {/* -------------------------------- Móvil --------------------------------- */}
      <ul className="divide-y divide-line md:hidden">
        {filas.length === 0 ? (
          <li className="px-4 py-14 text-center">
            <Inbox className="mx-auto mb-3 size-8 text-line-strong" />
            <p className="text-sm font-medium text-ink">No hay registros que coincidan</p>
            <p className="mt-1 text-xs text-ink-3">Ajusta los filtros o agrega un registro.</p>
          </li>
        ) : (
          filas.slice(0, limiteMovil).map(({ registro, c }) => (
            <li key={registro.id} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="rotulo truncate text-ink-3">{registro.propietario || "Sin propietario"}</p>
                  <p className="mt-0.5 text-sm leading-snug font-semibold text-ink">
                    {registro.cuenta || "Sin cliente"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-2">
                    {registro.detalleProducto}
                    {registro.tipoAplicacion ? ` · ${registro.tipoAplicacion}` : ""}
                    {registro.unidadMedida ? ` · ${registro.unidadMedida}` : ""}
                  </p>
                </div>
                <EstadoPastilla estado={c.estado} ratio={c.ratio} />
              </div>

              <dl
                className="mt-3 grid gap-x-3 gap-y-1 overflow-x-auto text-xs"
                style={{ gridTemplateColumns: `auto repeat(${mesesVisibles.length}, minmax(3.25rem, 1fr))` }}
              >
                <dt />
                {mesesVisibles.map((mes) => (
                  <dd key={mes.key} className="rotulo text-right text-ink-3">
                    {mes.label}
                  </dd>
                ))}

                <dt className="text-ink-3">Pronóstico</dt>
                {mesesVisibles.map((mes) => (
                  <dd key={mes.key} className="num text-right text-ink">
                    {formatearNumero(registro.proyecciones[mes.key])}
                  </dd>
                ))}

                <dt className="text-ink-3">Real</dt>
                {mesesVisibles.map((mes) => (
                  <dd key={mes.key} className="num text-right text-ink">
                    {formatearNumero(registro.reales[mes.key])}
                  </dd>
                ))}
              </dl>

              <div className="mt-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-ink-3">
                      Demanda <span className="num font-semibold text-ink">{formatearNumero(c.demanda)}</span>
                    </span>
                    <span className="text-ink-3">
                      Real{" "}
                      <span className="num font-semibold text-ink">
                        {c.estado === "sin-real" ? "–" : formatearNumero(c.real)}
                      </span>
                    </span>
                  </div>
                  <BarraCumplimiento estado={c.estado} ratio={c.ratio} />
                </div>
                <button
                  type="button"
                  onClick={() => alEditarFila(registro)}
                  aria-label="Editar registro"
                  className="rounded border border-line-strong p-2 text-ink-2"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => alEliminar(registro)}
                  aria-label="Eliminar registro"
                  className="rounded border border-line-strong p-2 text-ink-2"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))
        )}
        {filas.length > limiteMovil ? (
          <li className="px-4 py-3 text-center">
            <button
              type="button"
              onClick={() => setLimiteMovil((previo) => previo + 20)}
              className="h-9 rounded-lg border border-line-strong px-4 text-sm font-medium text-ink"
            >
              Mostrar más ({filas.length - limiteMovil} restantes)
            </button>
          </li>
        ) : null}
      </ul>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface-2 px-3 py-2 text-[11px] text-ink-3">
        <span className="hidden md:inline">
          Doble clic en una celda para editarla · <kbd className="font-sans font-semibold">Enter</kbd> guarda ·{" "}
          <kbd className="font-sans font-semibold">Esc</kbd> cancela
        </span>
        <span>Cumplimiento = (real + avance) ÷ demanda del periodo</span>
        {hayVariasUM ? (
          <span className="text-ink-2">
            Totales separados por unidad de medida ({porUnidad.map((u) => u.unidad).join(" y ")}): no se suman entre
            sí.
          </span>
        ) : null}
        {ocultas.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-ink-2">
            <EyeOff className="size-3" />
            {ocultas.length} columna{ocultas.length === 1 ? "" : "s"} oculta
            {ocultas.length === 1 ? "" : "s"} (no afecta a los totales)
          </span>
        ) : null}
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Piezas de la tabla                                                         */
/* -------------------------------------------------------------------------- */

/** Color del borde izquierdo de la fila según el estado del semáforo. */
function bordeEstado(estado: EstadoCumplimiento): string {
  const mapa: Record<EstadoCumplimiento, string> = {
    verde: "border-l-ok",
    amarillo: "border-l-warn",
    rojo: "border-l-bad",
    "sin-real": "border-l-transparent",
    "sin-demanda": "border-l-transparent",
  };
  return mapa[estado];
}

/** Subcabeceras «Pron.» y «Real» de un mes (segunda fila de la cabecera). */
function ThMes() {
  return (
    <>
      <th scope="col" className={cn(clasesTh, "top-8 border-l border-line-strong pb-2 text-right")}>
        <span className="rotulo text-ink-2">Pron.</span>
      </th>
      <th scope="col" className={cn(clasesTh, "top-8 pb-2 text-right")}>
        <span className="rotulo text-accent">Real</span>
      </th>
    </>
  );
}

/** Subcabecera ordenable de la zona «Cierre del periodo». */
function CabeceraSimple({
  etiqueta,
  clave,
  orden,
  alOrdenar,
  posicion,
  izquierda,
}: {
  etiqueta: string;
  clave: ClaveOrden;
  orden: Orden | null;
  alOrdenar: (clave: ClaveOrden) => void;
  /** Clases de desplazamiento y ancho (la zona de cierre queda fija a la derecha). */
  posicion: string;
  izquierda?: boolean;
}) {
  const activa = orden?.clave === clave;
  const Icono = !activa ? ArrowUpDown : orden.direccion === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={activa ? (orden.direccion === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        clasesTh,
        "top-8 z-20! bg-accent-soft pb-2",
        izquierda ? "text-left" : "text-right",
        posicion,
      )}
    >
      <button
        type="button"
        onClick={() => alOrdenar(clave)}
        className={cn(
          "rotulo inline-flex items-center gap-1 text-ink-2 transition-colors hover:text-ink",
          activa && "text-ink",
        )}
      >
        {etiqueta}
        <Icono className={cn("size-3", activa ? "text-accent" : "text-ink-3")} />
      </button>
    </th>
  );
}

/** Dos celdas editables (pronóstico y real) de un mes. */
function FragmentoMes({
  pron,
  real,
  alGuardarPron,
  alGuardarReal,
}: {
  pron: number | undefined;
  real: number | undefined;
  alGuardarPron: (valor?: number) => void;
  alGuardarReal: (valor?: number) => void;
}) {
  return (
    <>
      <EditableCell
        valor={pron}
        tipo="numero"
        alineacion="derecha"
        className="border-l border-line-strong"
        alGuardar={(valor) => alGuardarPron(typeof valor === "number" ? valor : undefined)}
      />
      <EditableCell
        valor={real}
        tipo="numero"
        alineacion="derecha"
        titulo="Doble clic para cargar el despacho real / avance"
        className="bg-accent-soft/35 text-accent"
        alGuardar={(valor) => alGuardarReal(typeof valor === "number" ? valor : undefined)}
      />
    </>
  );
}

/** Una fila de totales del pie (una por unidad de medida, o una sola si hay una UM). */
function FilaPie({
  etiqueta,
  detalle,
  resumen,
  meses,
  columnasTexto,
  inferior,
}: {
  etiqueta: string;
  detalle: string;
  resumen: ResumenPeriodo;
  meses: MesKey[];
  columnasTexto: number;
  inferior: string;
}) {
  const sticky = { bottom: inferior };
  return (
    <tr>
      <td
        colSpan={columnasTexto}
        style={sticky}
        className="sticky z-10 h-10 border-t border-line-strong bg-chrome px-3 py-0 text-chrome-ink"
      >
        <span className="rotulo">{etiqueta}</span>
        <span className="ml-2 text-xs font-normal text-chrome-ink-2">{detalle}</span>
      </td>
      {meses.map((mes) => (
        <TotalesMes
          key={mes}
          demanda={resumen.porMes[mes].demanda}
          real={resumen.porMes[mes].real}
          conReal={resumen.porMes[mes].conReal}
          inferior={inferior}
        />
      ))}
      <td style={sticky} className={cn(PIE_CIERRE, POS_DEMANDA, "num border-l text-right font-semibold")}>
        {formatearNumero(resumen.demanda)}
      </td>
      <td style={sticky} className={cn(PIE_CIERRE, POS_REAL, "num text-right font-semibold")}>
        {resumen.ratio === null ? "–" : formatearNumero(resumen.real)}
      </td>
      <td style={sticky} className={cn(PIE_CIERRE, POS_CUMPL)}>
        <EstadoPastilla estado={resumen.estado} ratio={resumen.ratio} className="bg-surface" />
      </td>
      <td style={sticky} className="sticky right-0 z-20 h-10 border-t border-line-strong bg-chrome" />
    </tr>
  );
}

/** Totales de un mes en el pie de la tabla. */
function TotalesMes({
  demanda,
  real,
  conReal,
  inferior,
}: {
  demanda: number;
  real: number;
  conReal: boolean;
  inferior: string;
}) {
  const base = "num sticky z-10 h-10 border-t border-line-strong bg-chrome px-3 py-0 text-right font-semibold";
  return (
    <>
      <td style={{ bottom: inferior }} className={cn(base, "border-l text-chrome-ink")}>
        {formatearNumero(demanda)}
      </td>
      <td style={{ bottom: inferior }} className={cn(base, "text-chrome-ink-2")}>
        {conReal ? formatearNumero(real) : "–"}
      </td>
    </>
  );
}

/** Une el catálogo con el valor actual, sin duplicados. */
function unirOpciones(catalogo: string[], actual: string): string[] {
  return [...new Set([...catalogo, actual].filter(Boolean))];
}
