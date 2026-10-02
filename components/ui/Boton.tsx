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
    "bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900 disabled:bg-slate-400 " +
    "dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:focus-visible:outline-slate-100 " +
    "dark:disabled:bg-slate-700 dark:disabled:text-slate-400",
  secundario:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-400 " +
    "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white",
  fantasma:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 " +
    "dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
  peligro:
    "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:outline-red-500 " +
    "dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70",
  exito:
    "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600 disabled:bg-emerald-300 " +
    "dark:hover:bg-emerald-500 dark:disabled:bg-emerald-900 dark:disabled:text-emerald-200",
};

const TAMANOS: Record<Tamano, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-xs",
  md: "h-9 gap-2 px-3.5 text-sm",
};

/** Botón estándar de la app (toolbar, modales y acciones de tabla). */
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
        "inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-60",
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
