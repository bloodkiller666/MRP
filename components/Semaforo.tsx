import { AlertTriangle, CheckCircle2, CircleDashed, Minus, XOctagon } from "lucide-react";
import type { ComponentType } from "react";

import { ETIQUETAS_ESTADO } from "@/lib/constants";
import { formatearPorcentaje } from "@/lib/mrp-utils";
import type { EstadoCumplimiento } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Estilos del semáforo. El estado se comunica con color **y** con un icono de
 * forma distinta (check, triángulo, octágono, círculo punteado), de modo que no
 * dependa solo del color.
 */
export const ESTILOS_ESTADO: Record<
  EstadoCumplimiento,
  { icono: ComponentType<{ className?: string }>; pastilla: string; barra: string; punto: string; texto: string }
> = {
  verde: {
    icono: CheckCircle2,
    pastilla: "border-ok-line bg-ok-soft text-ok",
    barra: "bg-ok",
    punto: "bg-ok",
    texto: "text-ok",
  },
  amarillo: {
    icono: AlertTriangle,
    pastilla: "border-warn-line bg-warn-soft text-warn",
    barra: "bg-warn",
    punto: "bg-warn",
    texto: "text-warn",
  },
  rojo: {
    icono: XOctagon,
    pastilla: "border-bad-line bg-bad-soft text-bad",
    barra: "bg-bad",
    punto: "bg-bad",
    texto: "text-bad",
  },
  "sin-real": {
    icono: CircleDashed,
    pastilla: "border-line bg-surface-2 text-ink-3",
    barra: "bg-line-strong",
    punto: "bg-line-strong",
    texto: "text-ink-3",
  },
  "sin-demanda": {
    icono: Minus,
    pastilla: "border-line bg-surface-2 text-ink-3",
    barra: "bg-line-strong",
    punto: "bg-line-strong",
    texto: "text-ink-3",
  },
};

interface PropsEstado {
  estado: EstadoCumplimiento;
  /** Cumplimiento (1 = 100 %). Si se omite, se muestra el nombre del estado. */
  ratio?: number | null;
  className?: string;
}

/** Pastilla de estado: icono + porcentaje (o nombre del estado si no hay ratio). */
export function EstadoPastilla({ estado, ratio, className }: PropsEstado) {
  const { icono: Icono, pastilla } = ESTILOS_ESTADO[estado];
  const texto = ratio === undefined || ratio === null ? ETIQUETAS_ESTADO[estado] : formatearPorcentaje(ratio);

  return (
    <span
      className={cn(
        "num inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-semibold whitespace-nowrap",
        pastilla,
        className,
      )}
      title={ETIQUETAS_ESTADO[estado]}
    >
      <Icono className="size-3.5 shrink-0" aria-hidden />
      <span>{texto}</span>
      <span className="sr-only"> · {ETIQUETAS_ESTADO[estado]}</span>
    </span>
  );
}

interface PropsBarra {
  estado: EstadoCumplimiento;
  ratio: number | null;
  className?: string;
}

/** Barra de progreso con marca al 100 %. El relleno se topa en 100 % aunque se sobrecumpla. */
export function BarraCumplimiento({ estado, ratio, className }: PropsBarra) {
  const ancho = ratio === null ? 0 : Math.min(ratio, 1) * 100;
  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", ESTILOS_ESTADO[estado].barra)}
        style={{ width: `${ancho}%` }}
      />
    </div>
  );
}
