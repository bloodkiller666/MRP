"use client";

import { Pencil } from "lucide-react";
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
  className?: string;
}

/**
 * Celda estilo hoja de cálculo.
 *
 * - **Doble clic** (o `Enter` con la celda enfocada) entra en modo edición.
 * - `Enter` / `Tab` / blur guardan, `Escape` cancela.
 * - En celdas numéricas, escribir vacío limpia el valor y un texto no numérico
 *   se descarta para no perder el dato original.
 */
export function EditableCell({
  valor,
  tipo,
  alGuardar,
  opciones,
  alineacion = "izquierda",
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

  const guardar = () => {
    if (tipo === "numero") {
      const texto = borrador.trim();
      if (texto === "") {
        // Celda vacía = sin proyección para ese mes.
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

  const cambiarSiDifiere = (nuevo: number | undefined) => {
    if (nuevo !== valor) alGuardar(nuevo);
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
    return (
      <td
        className={cn(
          "border-b border-slate-100 p-0 align-middle dark:border-slate-800",
          className,
        )}
      >
        {tipo === "select" ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={borrador}
            onChange={(evento) => setBorrador(evento.target.value)}
            onBlur={guardar}
            onKeyDown={alTeclado}
            className="h-full w-full border-2 border-slate-900 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none dark:border-slate-400 dark:bg-slate-900 dark:text-slate-100"
          >
            {opciones?.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion}
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
            className={cn(
              "h-full w-full border-2 border-slate-900 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none",
              "dark:border-slate-400 dark:bg-slate-900 dark:text-slate-100",
              derecha && "text-right",
            )}
          />
        )}
      </td>
    );
  }

  const vacio = valor === undefined || valor === null || valor === "";

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
      title="Doble clic para editar"
      className={cn(
        "group/celda cursor-cell border-b border-slate-100 px-2 py-1.5 text-sm text-slate-800 outline-none dark:border-slate-800 dark:text-slate-200",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400",
        derecha && "text-right tabular-nums",
        vacio && derecha && "text-slate-300 dark:text-slate-600",
        className,
      )}
    >
      <span className={cn("inline-flex items-center gap-1", derecha && "justify-end", "w-full")}>
        {vacio ? (
          derecha ? (
            "–"
          ) : (
            <span className="text-slate-300 dark:text-slate-600">—</span>
          )
        ) : tipo === "numero" ? (
          formatearNumero(valor as number)
        ) : (
          <span className="max-w-[16rem] truncate" title={String(valor)}>
            {valor}
          </span>
        )}
        <Pencil className="size-3 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover/celda:opacity-100 dark:text-slate-500" />
      </span>
    </td>
  );
}
