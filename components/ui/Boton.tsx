"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Variante = "primario" | "secundario" | "fantasma" | "peligro" | "exito";
type Tamano = "sm" | "md";

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  icono?: ReactNode;
}

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-accent text-accent-ink hover:bg-accent-hover disabled:bg-surface-3 disabled:text-ink-3",
  secundario:
    "border border-line-strong bg-surface text-ink hover:bg-surface-2 hover:border-ink-3 disabled:text-ink-3",
  fantasma: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  peligro:
    "border border-bad-line bg-bad-soft text-bad hover:border-bad disabled:text-ink-3",
  exito: "bg-ok text-white hover:brightness-110 disabled:bg-surface-3 disabled:text-ink-3",
};

const TAMANOS: Record<Tamano, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-xs",
  md: "h-9 gap-2 px-3.5 text-sm",
};

/** Botón estándar de la app (barra superior, modales y acciones). */
export function Boton({
  variante = "secundario",
  tamano = "md",
  icono,
  className,
  children,
  type = "button",
  ...resto
}: BotonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-70",
        VARIANTES[variante],
        TAMANOS[tamano],
        className,
      )}
      {...resto}
    >
      {icono}
      {children}
    </button>
  );
}
