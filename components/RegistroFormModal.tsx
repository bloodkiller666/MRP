"use client";

import { AlertTriangle, CalendarRange, Package, Save, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CAMPOS_TEXTO, ETIQUETAS_CAMPO, MESES } from "@/lib/constants";
import { formatearNumero } from "@/lib/mrp-utils";
import type { CampoTextoMRP, CantidadesMes, MesKey, RegistroMRP } from "@/lib/types";
import { parsearNumero } from "@/lib/utils";

import { Boton } from "./ui/Boton";
import { Campo, Input } from "./ui/Campos";
import { Modal } from "./ui/Modal";
import { SelectorConNuevo } from "./ui/SelectorConNuevo";

type ClaveBorrador = CampoTextoMRP | `pron_${MesKey}` | `real_${MesKey}`;

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
const SECCION_RESPONSABLE: CampoTextoMRP[] = ["propietario", "cuenta", "departamento", "proyecto"];
const SECCION_PRODUCTO: CampoTextoMRP[] = [
  "detalleProducto",
  "tipoAplicacion",
  "unidadMedida",
  "grupoLinea",
  "refineria",
];

/** Campos obligatorios y su mensaje de error. */
const OBLIGATORIOS: Partial<Record<CampoTextoMRP, string>> = {
  cuenta: "Indica el cliente.",
  detalleProducto: "El detalle del producto es obligatorio.",
  unidadMedida: "Indica la unidad de medida (GLN, KG…).",
};

/** Convierte las cantidades de un mes en texto editable. */
function texto(valor: number | undefined): string {
  return valor === undefined ? "" : String(valor);
}

/** Borrador vacío (o precargado) del formulario. */
function borradorInicial(registro?: RegistroMRP | null): Borrador {
  const base = {} as Borrador;
  for (const campo of CAMPOS_TEXTO) base[campo] = registro?.[campo] ?? "";
  for (const mes of MESES) {
    base[`pron_${mes.key}`] = texto(registro?.proyecciones[mes.key]);
    base[`real_${mes.key}`] = texto(registro?.reales[mes.key]);
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
    <section className="rounded-md border border-line bg-surface-2/60 p-3.5">
      <header className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 text-accent">{icono}</span>
        <div>
          <h3 className="rotulo text-ink">{titulo}</h3>
          {descripcion ? <p className="text-xs text-ink-3">{descripcion}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

/**
 * Modal de alta y edición de un registro.
 *
 * Estructura: responsable y cliente → producto → cantidades mensuales (pronóstico
 * y real). Cada campo de texto es un selector que acepta valores del catálogo **o**
 * uno nuevo escrito a mano; al guardar, el padre lo registra en el catálogo global.
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
      for (const clave of [`pron_${mes.key}`, `real_${mes.key}`] as const) {
        const valor = borrador[clave].trim();
        if (valor !== "" && parsearNumero(valor) === undefined) encontrados[clave] = "Valor no numérico";
      }
    }

    return encontrados;
  };

  const leerMeses = (prefijo: "pron" | "real"): CantidadesMes => {
    const cantidades: CantidadesMes = {};
    for (const mes of MESES) {
      const valor = parsearNumero(borrador[`${prefijo}_${mes.key}`]);
      if (valor !== undefined) cantidades[mes.key] = valor;
    }
    return cantidades;
  };

  const guardar = () => {
    const encontrados = validar();
    setIntentoGuardar(true);
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados);
      return;
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
      tipoAplicacion: borrador.tipoAplicacion.trim(),
      proyecciones: leerMeses("pron"),
      reales: leerMeses("real"),
    });

    onCerrar();
  };

  const esEdicion = Boolean(registro);
  const cantidadErrores = Object.keys(errores).length;
  const suma = (prefijo: "pron" | "real") =>
    MESES.reduce((acc, mes) => acc + (parsearNumero(borrador[`${prefijo}_${mes.key}`]) ?? 0), 0);

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

  /** Fila de cantidades (pronóstico o real) con una caja por mes. */
  const filaMeses = (prefijo: "pron" | "real", titulo: string, ayuda: string) => (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="rotulo text-ink">{titulo}</p>
        <p className="text-xs text-ink-3">{ayuda}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {MESES.map((mes) => {
          const clave = `${prefijo}_${mes.key}` as const;
          return (
            <Campo key={clave} etiqueta={mes.nombre} htmlFor={clave} error={errores[clave]}>
              <Input
                id={clave}
                inputMode="decimal"
                value={borrador[clave]}
                onChange={(evento) => actualizar(clave, evento.target.value)}
                placeholder="0"
                aria-invalid={Boolean(errores[clave])}
                className="num text-right"
              />
            </Campo>
          );
        })}
      </div>
    </div>
  );

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? "Editar registro" : "Nuevo registro"}
      descripcion="Vendedor, cliente y producto, con el pronóstico mensual y lo despachado."
      tamano="lg"
      pie={
        <>
          <span className="mr-auto hidden text-xs text-ink-3 sm:inline">
            {esEdicion ? "Guardar actualiza la fila existente." : "Se anexa al final de la tabla."}
          </span>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={guardar} icono={<Save className="size-4" />}>
            {esEdicion ? "Guardar cambios" : "Guardar y anexar"}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {intentoGuardar && cantidadErrores > 0 ? (
          <p className="flex items-start gap-2 rounded-md border border-bad-line bg-bad-soft px-3 py-2 text-sm text-bad">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Hay {cantidadErrores} campo{cantidadErrores === 1 ? "" : "s"} por corregir antes de guardar.
            </span>
          </p>
        ) : null}

        <Seccion
          titulo="Responsable y cliente"
          descripcion="Quién vende y a quién se le abastece."
          icono={<UserRound className="size-4" />}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{SECCION_RESPONSABLE.map(campoTexto)}</div>
        </Seccion>

        <Seccion
          titulo="Producto"
          descripcion="Qué se vende, para qué aplicación y en qué unidad."
          icono={<Package className="size-4" />}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SECCION_PRODUCTO.map(campoTexto)}
          </div>
        </Seccion>

        <Seccion
          titulo="Cantidades mensuales"
          descripcion="En la unidad de medida elegida. Deja vacío lo que aún no tenga dato."
          icono={<CalendarRange className="size-4" />}
        >
          <div className="flex flex-col gap-4">
            {filaMeses("pron", "Pronóstico de demanda", `Suma: ${formatearNumero(suma("pron"))}`)}
            {filaMeses("real", "Real + avance", `Suma: ${formatearNumero(suma("real"))}`)}
          </div>
        </Seccion>
      </div>
    </Modal>
  );
}
