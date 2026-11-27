"use client";

import { CalendarPlus, Trash2 } from "lucide-react";
import { useState } from "react";

import { etiquetaPeriodo, periodoAnual } from "@/lib/periodos";
import type { Periodo } from "@/lib/types";

import { Boton } from "./ui/Boton";
import { Campo, Input } from "./ui/Campos";
import { Modal } from "./ui/Modal";

interface PropsPeriodo {
  abierto: boolean;
  onCerrar: () => void;
  periodos: Periodo[];
  /** Año con el que arranca el formulario (el siguiente al último periodo). */
  anioSugerido: number;
  onCrear: (periodo: Periodo) => void;
  onQuitar: (periodo: Periodo) => void;
}

/**
 * Crea el periodo de un año (Ene – Dic) o quita uno de la lista.
 * Quitar un periodo no borra datos: los meses siguen guardados en cada registro.
 */
export function PeriodoModal({ abierto, onCerrar, periodos, anioSugerido, onCrear, onQuitar }: PropsPeriodo) {
  const [anio, setAnio] = useState(String(anioSugerido));

  const anioNumero = Number(anio);
  const anioValido = Number.isInteger(anioNumero) && anioNumero >= 2000 && anioNumero <= 2100;
  const nuevo = periodoAnual(anioValido ? anioNumero : anioSugerido);
  const yaExiste = periodos.some((p) => p.desde === nuevo.desde);

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Periodos de seguimiento"
      descripcion="Cada periodo es un año completo, de enero a diciembre. Los registros conservan sus cantidades de todos los años."
      tamano="md"
      pie={
        <Boton variante="fantasma" onClick={onCerrar}>
          Cerrar
        </Boton>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="rounded-md border border-line bg-surface-2/60 p-3.5">
          <h3 className="rotulo mb-3 text-ink">Nuevo periodo</h3>
          <Campo etiqueta="Año" htmlFor="periodo-anio" error={anioValido ? undefined : "Año no válido"} className="max-w-40">
            <Input
              id="periodo-anio"
              inputMode="numeric"
              value={anio}
              onChange={(evento) => setAnio(evento.target.value)}
              className="num"
            />
          </Campo>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-2">
              Se creará <span className="font-semibold text-ink">{etiquetaPeriodo(nuevo)}</span>
              {yaExiste ? " (ya existe)" : ""}
            </p>
            <Boton
              variante="primario"
              disabled={!anioValido || yaExiste}
              icono={<CalendarPlus className="size-4" />}
              onClick={() => {
                onCrear(nuevo);
                onCerrar();
              }}
            >
              Crear y abrir
            </Boton>
          </div>
        </section>

        <section>
          <h3 className="rotulo mb-2 text-ink-2">Periodos existentes</h3>
          <ul className="divide-y divide-line rounded-md border border-line">
            {periodos.map((p) => (
              <li key={`${p.desde}/${p.cantidad}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="font-medium text-ink">{etiquetaPeriodo(p)}</span>
                <button
                  type="button"
                  disabled={periodos.length <= 1}
                  onClick={() => onQuitar(p)}
                  title={periodos.length <= 1 ? "Debe quedar al menos un periodo" : "Quitar de la lista (no borra datos)"}
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-bad-soft hover:text-bad disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-2"
                >
                  <Trash2 className="size-3.5" />
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
