"use client";

import { Undo2 } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { clasesInput, clasesInputInvalido, clasesSelect } from "./Campos";

/** Valor centinela de la opción que activa el ingreso manual. */
const VALOR_NUEVO = "__MRP_AGREGAR_NUEVO__";

const ETIQUETA_NUEVO = "＋ Agregar nuevo valor…";

interface PropsSelectorConNuevo {
  id?: string;
  /** Valor actual del campo. */
  valor: string;
  /** Opciones ya conocidas (catálogo global + valores de la tabla). */
  opciones: string[];
  onChange: (valor: string) => void;
  placeholder?: string;
  /** Texto de la opción vacía del `select`. */
  opcionVacia?: string;
  /** Marca el control en rojo cuando la validación falla. */
  invalido?: boolean;
  className?: string;
}

/**
 * Selector que permite **elegir un valor existente** del catálogo o **escribir
 * uno nuevo** mediante la opción "Agregar nuevo valor…", que cambia el control
 * por una caja de texto libre.
 *
 * Si el valor actual no está en la lista (por ejemplo, un dato importado de un
 * Excel con una refinería nueva), se añade automáticamente a las opciones para
 * que el `select` lo muestre de forma consistente.
 */
export function SelectorConNuevo({
  id,
  valor,
  opciones,
  onChange,
  placeholder,
  opcionVacia = "— Selecciona una opción —",
  invalido,
  className,
}: PropsSelectorConNuevo) {
  const [modoNuevo, setModoNuevo] = useState(false);

  const listaOpciones = useMemo(() => {
    const conjunto = new Set<string>();
    for (const opcion of opciones) {
      const limpia = opcion.trim();
      if (limpia) conjunto.add(limpia);
    }
    const actual = valor.trim();
    if (actual) conjunto.add(actual);
    return [...conjunto].sort((a, b) => a.localeCompare(b, "es"));
  }, [opciones, valor]);

  if (modoNuevo) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <input
          id={id}
          autoFocus
          value={valor}
          placeholder={placeholder ?? "Escribe el nuevo valor"}
          onChange={(evento) => onChange(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") {
              evento.preventDefault();
              setModoNuevo(false);
            } else if (evento.key === "Escape") {
              evento.preventDefault();
              onChange("");
              setModoNuevo(false);
            }
          }}
          className={cn(
            clasesInput,
            invalido && clasesInputInvalido,
            "border-accent",
          )}
        />
        <button
          type="button"
          title="Volver a la lista"
          aria-label="Volver a la lista de opciones"
          onClick={() => {
            onChange("");
            setModoNuevo(false);
          }}
          className="shrink-0 rounded p-1.5 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <Undo2 className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      value={valor}
      onChange={(evento) => {
        if (evento.target.value === VALOR_NUEVO) {
          onChange("");
          setModoNuevo(true);
          return;
        }
        onChange(evento.target.value);
      }}
      className={cn(
        clasesSelect,
        invalido && clasesInputInvalido,
        !valor && "text-ink-3",
        className,
      )}
    >
      <option value="">{opcionVacia}</option>
      {listaOpciones.map((opcion) => (
        <option key={opcion} value={opcion} className="text-ink">
          {opcion}
        </option>
      ))}
      <option value={VALOR_NUEVO} className="text-ink">
        {ETIQUETA_NUEVO}
      </option>
    </select>
  );
}
