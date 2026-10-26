"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const clasesInput =
  "h-9 w-full rounded-[5px] border border-line-strong bg-surface px-2.5 text-sm text-ink " +
  "placeholder:text-ink-3 hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-2 " +
  "focus:ring-accent/25 disabled:bg-surface-2";

export const clasesSelect = cn(clasesInput, "cursor-pointer truncate pr-7");

/** Borde rojo para controles inválidos (validación de formularios). */
export const clasesInputInvalido = "border-bad focus:border-bad focus:ring-bad/20";

interface CampoProps {
  etiqueta: string;
  htmlFor?: string;
  ayuda?: string;
  /** Muestra un asterisco junto a la etiqueta. */
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
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="rotulo text-ink-2">
        {etiqueta}
        {requerido ? (
          <span className="ml-0.5 text-bad" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <span className="text-xs text-bad">{error}</span>
      ) : ayuda ? (
        <span className="text-xs text-ink-3">{ayuda}</span>
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
