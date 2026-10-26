"use client";

import { useEffect, useRef, useState } from "react";

import { formatearNumero } from "@/lib/mrp-utils";
import { cn, parsearNumero } from "@/lib/utils";

interface CeldaEditableProps {
  /** Valor actual; `undefined` se muestra como celda vacía. */
  valor: string | number | undefined;
  tipo: "texto" | "numero" | "select";
  /** Se llama solo si el valor cambió realmente. */
  alGuardar: (valor: string | number | undefined) => void;
  /** Opciones para `tipo="select"`. */
  opciones?: string[];
  /** Alineación del contenido (los números van a la derecha). */
  alineacion?: "izquierda" | "derecha";
  /** Texto cuando la celda está vacía (por defecto «–» / «—»). */
  vacio?: string;
  /** Texto de ayuda al pasar el cursor. */
  titulo?: string;
  /** Clase de ancho máximo del texto (se trunca con «…»). */
  anchoTexto?: string;
  className?: string;
}

/**
 * Celda estilo hoja de cálculo.
 *
 * - **Doble clic** (o `Enter` con la celda enfocada) entra en modo edición.
 * - `Enter` / blur guardan, `Escape` cancela.
 * - En celdas numéricas, escribir vacío limpia el valor y un texto no numérico
 *   se descarta para no perder el dato original.
 */
export function EditableCell({
  valor,
  tipo,
  alGuardar,
  opciones,
  alineacion = "izquierda",
  vacio,
  titulo = "Doble clic para editar",
  anchoTexto = "max-w-[18rem]",
  className,
}: CeldaEditableProps) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (!editando) return;
    const campo = inputRef.current;
    if (!campo) return;
    campo.focus();
    if (campo instanceof HTMLInputElement) campo.select();
  }, [editando]);

  const iniciarEdicion = () => {
    setBorrador(valor === undefined || valor === null ? "" : String(valor));
    setEditando(true);
  };

  const cancelar = () => {
    setEditando(false);
    setBorrador("");
  };

  const cambiarSiDifiere = (nuevo: number | undefined) => {
    if (nuevo !== valor) alGuardar(nuevo);
  };

  const guardar = () => {
    if (tipo === "numero") {
      const texto = borrador.trim();
      if (texto === "") {
        // Celda vacía = sin dato para ese mes.
        cambiarSiDifiere(undefined);
      } else {
        const numero = parsearNumero(texto);
        // Si no es un número válido, se descarta el cambio.
        if (numero !== undefined) cambiarSiDifiere(numero);
      }
    } else {
      const texto = borrador.trim();
      if (texto !== (valor ?? "")) alGuardar(texto);
    }
    setEditando(false);
  };

  const alTeclado = (evento: React.KeyboardEvent) => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      guardar();
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      cancelar();
    }
  };

  const derecha = alineacion === "derecha";

  if (editando) {
    const clasesControl =
      "h-full w-full min-w-24 border-2 border-accent bg-surface px-2 py-1.5 text-[13px] text-ink outline-none";
    return (
      <td className={cn("border-b border-line p-0 align-middle", className)}>
        {tipo === "select" ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={borrador}
            onChange={(evento) => setBorrador(evento.target.value)}
            onBlur={guardar}
            onKeyDown={alTeclado}
            className={clasesControl}
          >
            {opciones?.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion || "— Sin definir —"}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={borrador}
            inputMode={tipo === "numero" ? "decimal" : undefined}
            onChange={(evento) => setBorrador(evento.target.value)}
            onBlur={guardar}
            onKeyDown={alTeclado}
            className={cn(clasesControl, derecha && "num text-right")}
          />
        )}
      </td>
    );
  }

  const sinValor = valor === undefined || valor === null || valor === "";

  return (
    <td
      tabIndex={0}
      onDoubleClick={iniciarEdicion}
      onKeyDown={(evento) => {
        if (evento.key === "Enter" || evento.key === "F2") {
          evento.preventDefault();
          iniciarEdicion();
        }
      }}
      title={titulo}
      className={cn(
        "cursor-cell border-b border-line px-3 py-2 text-[13px] text-ink outline-none transition-colors",
        "hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
        derecha && "num text-right",
        className,
      )}
    >
      {sinValor ? (
        <span className="text-ink-3">{vacio ?? (derecha ? "–" : "—")}</span>
      ) : tipo === "numero" ? (
        formatearNumero(valor as number)
      ) : (
        <span className={cn("block truncate", anchoTexto)} title={String(valor)}>
          {valor}
        </span>
      )}
    </td>
  );
}
