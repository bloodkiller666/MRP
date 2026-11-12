"use client";

import { useEffect, useRef, useState } from "react";

import { formatearNumero } from "@/lib/mrp-utils";
import { cn, parsearNumero } from "@/lib/utils";

import { useSoloLectura } from "./ui/SoloLectura";

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
  /** Muestra el valor como una insignia (para códigos cortos: EMUL-01, SBS…). */
  insignia?: boolean;
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
 *   se marca en rojo (Enter) o se descarta al salir, para no perder el dato original.
 */
export function EditableCell({
  valor,
  tipo,
  alGuardar,
  opciones,
  alineacion = "izquierda",
  vacio,
  insignia,
  titulo = "Doble clic para editar",
  anchoTexto = "max-w-[18rem]",
  className,
}: CeldaEditableProps) {
  const soloLectura = useSoloLectura();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");
  const [invalido, setInvalido] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (!editando) return;
    const campo = inputRef.current;
    if (!campo) return;
    campo.focus();
    if (campo instanceof HTMLInputElement) campo.select();
  }, [editando]);

  const iniciarEdicion = () => {
    if (soloLectura) return;
    setBorrador(valor === undefined || valor === null ? "" : String(valor));
    setInvalido(false);
    setEditando(true);
  };

  const cancelar = () => {
    setEditando(false);
    setInvalido(false);
    setBorrador("");
  };

  const cambiarSiDifiere = (nuevo: number | undefined) => {
    if (nuevo !== valor) alGuardar(nuevo);
  };

  /**
   * `Enter` con un texto no numérico deja la celda abierta y la marca en rojo; al salir con el
   * ratón o `Tab` se conserva el valor original (el cambio se descarta, pero no a escondidas).
   */
  const guardar = (alSalir = false) => {
    if (tipo === "numero") {
      const texto = borrador.trim();
      if (texto === "") {
        // Celda vacía = sin dato para ese mes.
        cambiarSiDifiere(undefined);
      } else {
        const numero = parsearNumero(texto);
        if (numero === undefined && !alSalir) {
          setInvalido(true);
          return;
        }
        if (numero !== undefined) cambiarSiDifiere(numero);
      }
    } else {
      const texto = borrador.trim();
      if (texto !== (valor ?? "")) alGuardar(texto);
    }
    setEditando(false);
    setInvalido(false);
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
      "h-full w-full min-w-24 border-2 bg-surface px-2 py-1.5 text-[13px] text-ink outline-none " +
      (invalido ? "border-bad" : "border-accent");
    return (
      <td className={cn("border-b border-line p-0 align-middle", className)}>
        {tipo === "select" ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={borrador}
            onChange={(evento) => setBorrador(evento.target.value)}
            onBlur={() => guardar(true)}
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
            onChange={(evento) => {
              setBorrador(evento.target.value);
              setInvalido(false);
            }}
            onBlur={() => guardar(true)}
            onKeyDown={alTeclado}
            aria-invalid={invalido || undefined}
            title={invalido ? "Escribe solo un número, o pulsa Esc para conservar el valor." : undefined}
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
      ) : insignia ? (
        <span
          className={cn(
            "inline-block max-w-full truncate rounded-md bg-surface-3 px-1.5 py-0.5 align-middle text-xs leading-4 font-semibold text-ink-2",
            anchoTexto,
          )}
          title={String(valor)}
        >
          {valor}
        </span>
      ) : (
        <span className={cn("block truncate", anchoTexto)} title={String(valor)}>
          {valor}
        </span>
      )}
    </td>
  );
}
