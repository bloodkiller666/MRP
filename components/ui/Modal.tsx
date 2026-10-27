"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ModalProps {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  /** Ancho máximo del panel. */
  tamano?: "sm" | "md" | "lg" | "xl";
  /** Contenido opcional anclado al pie (acciones). */
  pie?: ReactNode;
  children: ReactNode;
}

const TAMANOS: Record<NonNullable<ModalProps["tamano"]>, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-4xl",
  xl: "sm:max-w-6xl",
};

/**
 * Modal base: en móvil ocupa toda la pantalla; en escritorio es un panel
 * centrado. Cierra con Escape o clic fuera y bloquea el scroll de fondo.
 */
export function Modal({
  abierto,
  titulo,
  descripcion,
  onCerrar,
  tamano = "md",
  pie,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!abierto) return;

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar();
    };
    const overflowPrevio = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alPresionar);

    return () => {
      document.body.style.overflow = overflowPrevio;
      window.removeEventListener("keydown", alPresionar);
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-chrome/70 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          "flex max-h-full w-full flex-col overflow-hidden border-line bg-surface shadow-pop sm:rounded-2xl sm:border",
          TAMANOS[tamano],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line bg-surface-2 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{titulo}</h2>
            {descripcion ? <p className="mt-0.5 text-sm text-ink-2">{descripcion}</p> : null}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-1.5 rounded p-1.5 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {pie ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
            {pie}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
