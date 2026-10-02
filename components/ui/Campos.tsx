"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const clasesInput =
  "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 " +
  "placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 " +
  "disabled:bg-slate-100 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 " +
  "dark:focus:border-slate-500 dark:focus:ring-slate-700";

export const clasesSelect = cn(clasesInput, "cursor-pointer pr-8");

/** Borde rojo para controles inválidos (validación de formularios). */
export const clasesInputInvalido =
  "border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-700 dark:focus:border-red-600 dark:focus:ring-red-950";

interface CampoProps {
  etiqueta: string;
  htmlFor?: string;
  ayuda?: string;
  /** Muestra un asterisco rojo junto a la etiqueta. */
  requerido?: boolean;
  /** Mensaje de error; cuando existe reemplaza a la ayuda. */
  error?: string;
  className?: string;
  children: ReactNode;
}

/** Etiqueta + control con espaciado consistente en formularios. */
export function Campo({
  etiqueta,
  htmlFor,
  ayuda,
  requerido,
  error,
  className,
  children,
}: CampoProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
      >
        {etiqueta}
        {requerido ? (
          <span className="ml-0.5 text-red-500 dark:text-red-400" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : ayuda ? (
        <span className="text-xs text-slate-400 dark:text-slate-500">{ayuda}</span>
      ) : null}
    </div>
  );
}

/** Input de texto estándar. */
export function Input({ className, ...resto }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(clasesInput, className)} {...resto} />;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Opciones a renderizar; la primera siempre es "Todas/Todos". */
  opciones: string[];
  opcionVacia?: string;
}

/** Select de filtro con opción vacía ("Todas"). */
export function Select({ opciones, opcionVacia = "Todas", className, ...resto }: SelectProps) {
  return (
    <select className={cn(clasesSelect, className)} {...resto}>
      <option value="">{opcionVacia}</option>
      {opciones.map((opcion) => (
        <option key={opcion} value={opcion}>
          {opcion}
        </option>
      ))}
    </select>
  );
}
