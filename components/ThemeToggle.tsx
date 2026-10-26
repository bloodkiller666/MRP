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
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[5px] text-chrome-ink-2 transition-colors",
        "hover:bg-chrome-2 hover:text-chrome-ink",
        className,
      )}
    >
      {esOscuro ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
    </button>
  );
}
