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
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

/**
 * Modal base: backdrop oscuro, cierre con Escape o clic fuera,
 * bloqueo del scroll de fondo y cabecera fija con acciones al pie.
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-8 dark:bg-black/70"
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
          "my-auto w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl",
          "dark:border-slate-800 dark:bg-slate-900",
          TAMANOS[tamano],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{titulo}</h2>
            {descripcion ? (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>

        {pie ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            {pie}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
