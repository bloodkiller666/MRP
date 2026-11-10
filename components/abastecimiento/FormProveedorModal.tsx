"use client";

import { useState } from "react";

import type { Proveedor } from "@/lib/abastecimiento";
import { normalizarTexto, parsearNumero } from "@/lib/utils";

import { Boton } from "../ui/Boton";
import { Campo, Input } from "../ui/Campos";
import { Modal } from "../ui/Modal";

interface PropsFormProveedor {
  /** Si viene, se edita ese proveedor; si no, se agrega uno nuevo. */
  proveedor?: Proveedor;
  materiaNombre: string;
  /** Nombres de los demás proveedores de la materia prima. */
  nombresExistentes: string[];
  onGuardar: (datos: { nombre: string; leadTimeDias: number }) => void;
  onCerrar: () => void;
}

/** Alta y edición de un proveedor de una materia prima. Se monta solo al abrirse. */
export function FormProveedorModal({ proveedor, materiaNombre, nombresExistentes, onGuardar, onCerrar }: PropsFormProveedor) {
  const [nombre, setNombre] = useState(proveedor?.nombre ?? "");
  const [leadTime, setLeadTime] = useState(proveedor ? String(proveedor.leadTimeDias) : "30");
  const [intento, setIntento] = useState(false);

  const limpio = nombre.trim();
  const dias = leadTime.trim() === "" ? NaN : (parsearNumero(leadTime) ?? NaN);
  const errorNombre = !limpio
    ? "Escriba el nombre del proveedor."
    : nombresExistentes.some((n) => normalizarTexto(n).toLowerCase() === normalizarTexto(limpio).toLowerCase())
      ? "Esa materia prima ya tiene un proveedor con ese nombre."
      : undefined;
  const errorDias = Number.isNaN(dias) || dias < 0 ? "Use 0 o más días." : undefined;

  const guardar = () => {
    setIntento(true);
    if (errorNombre || errorDias) return;
    onGuardar({ nombre: limpio, leadTimeDias: Math.round(dias) });
  };

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      tamano="sm"
      titulo={proveedor ? "Editar proveedor" : "Agregar proveedor"}
      descripcion={materiaNombre}
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={guardar}>
            {proveedor ? "Guardar cambios" : "Agregar proveedor"}
          </Boton>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          guardar();
        }}
        noValidate
      >
        <Campo etiqueta="Proveedor" htmlFor="prov-nombre" requerido error={intento ? errorNombre : undefined}>
          <Input id="prov-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. INGEVITY (Importado)" />
        </Campo>
        <Campo
          etiqueta="Tiempo de entrega (días)"
          htmlFor="prov-dias"
          requerido
          ayuda="Desde que se coloca la orden hasta que llega a planta."
          error={intento ? errorDias : undefined}
        >
          <Input id="prov-dias" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} inputMode="numeric" />
        </Campo>
        <button type="submit" className="sr-only" tabIndex={-1}>
          Guardar
        </button>
      </form>
    </Modal>
  );
}
