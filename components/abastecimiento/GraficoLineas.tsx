"use client";

import { useId } from "react";

export interface SerieGrafico {
  nombre: string;
  /** Un valor por etiqueta; `undefined` corta la línea. */
  valores: (number | undefined)[];
  color: string;
  discontinua?: boolean;
  /** Dibuja un punto en cada valor. */
  puntos?: boolean;
}

interface Props {
  titulo: string;
  etiquetas: string[];
  series: SerieGrafico[];
  /** Posición (índice) de la etiqueta del mes actual, para marcarla. */
  marcaActual?: number;
  unidad?: string;
}

const ANCHO = 720;
const ALTO = 240;
const M = { izq: 46, der: 26, arr: 14, abj: 28 };

const compacto = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });

/** Escala «bonita» para el eje Y: de 0 (o del mínimo negativo) al máximo, en 4 tramos. */
function escala(min: number, max: number): { min: number; max: number; marcas: number[] } {
  const bajo = Math.min(0, min);
  const alto = Math.max(max, bajo + 1e-6);
  const paso0 = (alto - bajo) / 4;
  const mag = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((p) => p >= paso0) ?? paso0;
  const inicio = Math.floor(bajo / paso) * paso;
  const marcas: number[] = [];
  for (let v = inicio; v < alto + paso - 1e-9; v += paso) marcas.push(Math.round(v * 1e6) / 1e6);
  return { min: marcas[0], max: marcas[marcas.length - 1], marcas };
}

/** Gráfico de líneas simple en SVG (sin librerías), con leyenda y valores al pasar el cursor. */
export function GraficoLineas({ titulo, etiquetas, series, marcaActual, unidad = "TN" }: Props) {
  const id = useId();
  const todos = series.flatMap((s) => s.valores).filter((v): v is number => v !== undefined);
  const { min, max, marcas } = escala(Math.min(0, ...todos), Math.max(0, ...todos));
  const x = (i: number) => M.izq + (etiquetas.length <= 1 ? 0 : (i * (ANCHO - M.izq - M.der)) / (etiquetas.length - 1));
  const y = (v: number) => M.arr + ((max - v) / (max - min || 1)) * (ALTO - M.arr - M.abj);

  const trazos = series.map((s) => {
    const tramos: string[] = [];
    let actual = "";
    s.valores.forEach((v, i) => {
      if (v === undefined) {
        if (actual) tramos.push(actual);
        actual = "";
        return;
      }
      actual += `${actual ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    if (actual) tramos.push(actual);
    return tramos;
  });

  return (
    <figure className="rounded-xl border border-line bg-surface p-3">
      <figcaption className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="rotulo text-ink">{titulo}</span>
        {series.map((s) => (
          <span key={s.nombre} className="flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden>
              <line x1="0" x2="22" y1="4" y2="4" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.discontinua ? "5 3" : undefined} />
            </svg>
            {s.nombre}
          </span>
        ))}
      </figcaption>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={titulo} className="h-auto w-full">
        <title id={id}>{titulo}</title>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={M.izq} x2={ANCHO - M.der} y1={y(m)} y2={y(m)} stroke="var(--line)" strokeWidth={m === 0 ? 1.5 : 1} />
            <text x={M.izq - 6} y={y(m) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">
              {compacto.format(m)}
            </text>
          </g>
        ))}
        {marcaActual !== undefined && marcaActual >= 0 ? (
          <g>
            <line x1={x(marcaActual)} x2={x(marcaActual)} y1={M.arr} y2={ALTO - M.abj} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={x(marcaActual)} y={M.arr - 3} textAnchor="middle" fontSize="10" fill="var(--accent)">
              hoy
            </text>
          </g>
        ) : null}
        {etiquetas.map((e, i) => (
          <text key={e + i} x={x(i)} y={ALTO - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
            {e}
          </text>
        ))}
        {series.map((s, k) => (
          <g key={s.nombre}>
            {trazos[k].map((d, j) => (
              <path
                key={j}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth="2.25"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.discontinua ? "6 4" : undefined}
              />
            ))}
            {s.valores.map((v, i) =>
              v === undefined || !(s.puntos ?? true) ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r="3.2" fill={s.color}>
                  <title>{`${s.nombre} · ${etiquetas[i]}: ${compacto.format(v)} ${unidad}`}</title>
                </circle>
              ),
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}
