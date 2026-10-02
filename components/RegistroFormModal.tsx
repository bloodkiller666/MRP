"use client";

import { AlertTriangle, CalendarRange, ListTree, Save, Tag } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CAMPOS_TEXTO, ETIQUETAS_CAMPO, MESES } from "@/lib/constants";
import type { CampoTextoMRP, MesKey, RegistroMRP } from "@/lib/types";
import { parsearNumero } from "@/lib/utils";

import { Boton } from "./ui/Boton";
import { Campo, Input } from "./ui/Campos";
import { Modal } from "./ui/Modal";
import { SelectorConNuevo } from "./ui/SelectorConNuevo";

type ClaveBorrador = CampoTextoMRP | `mes_${MesKey}`;

type Borrador = Record<ClaveBorrador, string>;

interface PropsFormulario {
  abierto: boolean;
  onCerrar: () => void;
  /** Recibe los datos sin `id`: el store asigna el identificador al crear. */
  onGuardar: (datos: Omit<RegistroMRP, "id">) => void;
  /** Si viene un registro, el modal funciona en modo edición. */
  registro?: RegistroMRP | null;
  /**
   * Opciones por campo: catálogo global combinado con los valores ya presentes
   * en la tabla. Alimentan los selectores con modo "Agregar nuevo valor".
   */
  sugerencias: Record<CampoTextoMRP, string[]>;
}

/** Campos que se agrupan en cada sección del formulario. */
const SECCION_METADATOS: CampoTextoMRP[] = ["propietario", "departamento", "cuenta", "proyecto"];
const SECCION_CLASIFICACION: CampoTextoMRP[] = [
  "detalleProducto",
  "grupoLinea",
  "refineria",
  "unidadMedida",
];

/** Campos obligatorios y su mensaje de error. */
const OBLIGATORIOS: Partial<Record<CampoTextoMRP, string>> = {
  detalleProducto: "El detalle del producto es obligatorio.",
  unidadMedida: "Indica la unidad de medida (GLN, KG, TM…).",
};

/** Borrador vacío (o precargado) del formulario. */
function borradorInicial(registro?: RegistroMRP | null): Borrador {
  const base = {} as Borrador;
  for (const campo of CAMPOS_TEXTO) base[campo] = registro?.[campo] ?? "";
  for (const mes of MESES) {
    const valor = registro?.proyecciones[mes.key];
    base[`mes_${mes.key}`] = valor === undefined ? "" : String(valor);
  }
  return base;
}

/** Encabezado de sección dentro del formulario. */
function Seccion({
  titulo,
  descripcion,
  icono,
  children,
}: {
  titulo: string;
  descripcion?: string;
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <header className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 text-slate-400 dark:text-slate-500">{icono}</span>
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">
            {titulo}
          </h3>
          {descripcion ? (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">{descripcion}</p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

/**
 * Modal de alta y edición de un registro.
 *
 * Estructura: metadatos → clasificación → cantidades mensuales. Cada campo de
 * texto es un selector que acepta valores del catálogo **o** un valor nuevo
 * escrito a mano; al guardar, el padre registra esos valores en el catálogo
 * global para que aparezcan en los filtros y en el siguiente registro.
 */
export function RegistroFormModal({
  abierto,
  onCerrar,
  onGuardar,
  registro,
  sugerencias,
}: PropsFormulario) {
  // El modal se monta desde cero en cada apertura, por lo que el estado inicial
  // del formulario ya refleja el registro a editar (o uno vacío).
  const [borrador, setBorrador] = useState<Borrador>(() => borradorInicial(registro));
  const [errores, setErrores] = useState<Partial<Record<ClaveBorrador, string>>>({});
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const actualizar = (clave: ClaveBorrador, valor: string) => {
    setBorrador((previo) => ({ ...previo, [clave]: valor }));
    // Al corregir un campo, su error desaparece de inmediato.
    setErrores((previos) => {
      if (!previos[clave]) return previos;
      const siguientes = { ...previos };
      delete siguientes[clave];
      return siguientes;
    });
  };

  /** Valida el borrador y devuelve el mapa de errores (vacío = todo correcto). */
  const validar = (): Partial<Record<ClaveBorrador, string>> => {
    const encontrados: Partial<Record<ClaveBorrador, string>> = {};

    for (const campo of CAMPOS_TEXTO) {
      const mensaje = OBLIGATORIOS[campo];
      if (mensaje && !borrador[campo].trim()) encontrados[campo] = mensaje;
    }

    for (const mes of MESES) {
      const clave: ClaveBorrador = `mes_${mes.key}`;
      const texto = borrador[clave].trim();
      if (texto !== "" && parsearNumero(texto) === undefined) {
        encontrados[clave] = "Valor no numérico";
      }
    }

    return encontrados;
  };

  const guardar = () => {
    const encontrados = validar();
    setIntentoGuardar(true);
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados);
      return;
    }

    const proyecciones: RegistroMRP["proyecciones"] = {};
    for (const mes of MESES) {
      const valor = parsearNumero(borrador[`mes_${mes.key}`]);
      if (valor !== undefined) proyecciones[mes.key] = valor;
    }

    onGuardar({
      propietario: borrador.propietario.trim(),
      departamento: borrador.departamento.trim(),
      cuenta: borrador.cuenta.trim(),
      proyecto: borrador.proyecto.trim(),
      detalleProducto: borrador.detalleProducto.trim(),
      grupoLinea: borrador.grupoLinea.trim(),
      refineria: borrador.refineria.trim(),
      unidadMedida: borrador.unidadMedida.trim(),
      proyecciones,
    });

    onCerrar();
  };

  const esEdicion = Boolean(registro);
  const cantidadErrores = Object.keys(errores).length;
  const resumenMensual = MESES.reduce(
    (acc, mes) => acc + (parsearNumero(borrador[`mes_${mes.key}`]) ?? 0),
    0,
  );

  /** Render de un campo de texto con selector + valor nuevo. */
  const campoTexto = (campo: CampoTextoMRP) => (
    <Campo
      key={campo}
      etiqueta={ETIQUETAS_CAMPO[campo]}
      htmlFor={`campo-${campo}`}
      requerido={Boolean(OBLIGATORIOS[campo])}
      error={errores[campo]}
    >
      <SelectorConNuevo
        id={`campo-${campo}`}
        valor={borrador[campo]}
        opciones={sugerencias[campo] ?? []}
        onChange={(valor) => actualizar(campo, valor)}
        placeholder={campo === "unidadMedida" ? "GLN" : "Escribe el nuevo valor"}
        invalido={Boolean(errores[campo])}
      />
    </Campo>
  );

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? "Editar registro" : "Nuevo registro"}
      descripcion="Completa la ficha del insumo y su proyección mensual. Deja un mes vacío si no hay requerimiento."
      tamano="lg"
      pie={
        <>
          <span className="mr-auto text-[11px] text-slate-400 dark:text-slate-500">
            {esEdicion ? "Guardando se actualiza la fila existente." : "Se anexa al final de la tabla."}
          </span>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante={esEdicion ? "primario" : "exito"}
            onClick={guardar}
            icono={<Save className="size-4" />}
          >
            {esEdicion ? "Guardar cambios" : "Guardar y Anexar"}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {intentoGuardar && cantidadErrores > 0 ? (
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Hay {cantidadErrores} campo{cantidadErrores === 1 ? "" : "s"} por corregir antes de
              guardar.
            </span>
          </p>
        ) : null}

        <Seccion
          titulo="Metadatos del registro"
          descripcion="Quién solicita el insumo y a qué obra o cuenta corresponde."
          icono={<Tag className="size-3.5" />}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SECCION_METADATOS.map(campoTexto)}
          </div>
        </Seccion>

        <Seccion
          titulo="Clasificación del producto"
          descripcion="Detalle, grupo línea, refinería y unidad de medida."
          icono={<ListTree className="size-3.5" />}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SECCION_CLASIFICACION.map(campoTexto)}
          </div>
        </Seccion>

        <Seccion
          titulo="Cantidades mensuales"
          descripcion="Proyección de consumo por mes. Total del borrador:"
          icono={<CalendarRange className="size-3.5" />}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {MESES.map((mes) => (
              <Campo
                key={mes.key}
                etiqueta={mes.nombre}
                htmlFor={`mes-${mes.key}`}
                error={errores[`mes_${mes.key}`]}
              >
                <Input
                  id={`mes-${mes.key}`}
                  inputMode="decimal"
                  value={borrador[`mes_${mes.key}`]}
                  onChange={(evento) => actualizar(`mes_${mes.key}`, evento.target.value)}
                  placeholder="0"
                  aria-invalid={Boolean(errores[`mes_${mes.key}`])}
                  className="text-right tabular-nums"
                />
              </Campo>
            ))}
          </div>
          <p className="mt-3 text-right text-xs text-slate-500 dark:text-slate-400">
            Suma del borrador:{" "}
            <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
              {resumenMensual.toLocaleString("es-PE", { maximumFractionDigits: 2 })}
            </span>
          </p>
        </Seccion>
      </div>
    </Modal>
  );
}
