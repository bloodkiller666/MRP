"use client";

import { Moon, Sun } from "lucide-react";

import { useTema } from "@/hooks/use-tema";
import { cn } from "@/lib/utils";

interface PropsTema {
  className?: string;
}

/**
 * Interruptor de modo claro / oscuro para la barra superior.
 *
 * La preferencia se persiste en `localStorage` desde `lib/tema-store.ts` y se
 * refleja como clase `dark` en `<html>`.
 */
export function ThemeToggle({ className }: PropsTema) {
  const { esOscuro, alternar } = useTema();

  const etiqueta = esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={esOscuro}
      aria-label={etiqueta}
      title={etiqueta}
      onClick={alternar}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-600 transition-colors",
        "hover:bg-slate-100 hover:text-slate-900",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400",
        "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
        className,
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          esOscuro ? "bg-slate-700" : "bg-slate-200",
        )}
      >
        <span
          className={cn(
            "absolute size-4 rounded-full bg-white shadow transition-transform",
            esOscuro ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </span>
      {esOscuro ? <Moon className="size-4" /> : <Sun className="size-4" />}
      <span className="hidden sm:inline">{esOscuro ? "Oscuro" : "Claro"}</span>
    </button>
  );
}
