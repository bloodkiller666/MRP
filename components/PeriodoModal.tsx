"use client";

import { CalendarPlus, Trash2 } from "lucide-react";
import { useState } from "react";

import { anioDeMes, claveMes, etiquetaRango, mesesDesde, mesesDePeriodo, nombreMesIndice } from "@/lib/periodos";
import type { Periodo } from "@/lib/types";

import { Boton } from "./ui/Boton";
import { Campo, Input, clasesSelect } from "./ui/Campos";
import { Modal } from "./ui/Modal";

interface PropsPeriodo {
  abierto: boolean;
  onCerrar: () => void;
  periodos: Periodo[];
  /** Mes y año con los que arranca el formulario (el mes siguiente al último periodo). */
  sugerido: { indiceMes: number; anio: number };
  onCrear: (periodo: Periodo) => void;
  onQuitar: (periodo: Periodo) => void;
}

/**
 * Crea un periodo de seguimiento (p. ej. Ene – Mar 2027) o quita uno de la lista.
 * Quitar un periodo no borra datos: los meses siguen guardados en cada registro.
 */
export function PeriodoModal({ abierto, onCerrar, periodos, sugerido, onCrear, onQuitar }: PropsPeriodo) {
  const [indiceMes, setIndiceMes] = useState(sugerido.indiceMes);
  const [anio, setAnio] = useState(String(sugerido.anio));
  const [cantidad, setCantidad] = useState(3);

  const anioNumero = Number(anio);
  const anioValido = Number.isInteger(anioNumero) && anioNumero >= 2000 && anioNumero <= 2100;
  const desde = claveMes(anioValido ? anioNumero : sugerido.anio, indiceMes);
  const nuevo: Periodo = { desde, cantidad };
  const yaExiste = periodos.some((p) => p.desde === desde && p.cantidad === cantidad);

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Periodos de seguimiento"
      descripcion="Cada periodo agrupa meses consecutivos. Los registros conservan sus cantidades de todos los periodos."
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Campo etiqueta="Mes inicial" htmlFor="periodo-mes">
              <select
                id="periodo-mes"
                value={indiceMes}
                onChange={(evento) => setIndiceMes(Number(evento.target.value))}
                className={clasesSelect}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {nombreMesIndice(i)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Año" htmlFor="periodo-anio" error={anioValido ? undefined : "Año no válido"}>
              <Input
                id="periodo-anio"
                inputMode="numeric"
                value={anio}
                onChange={(evento) => setAnio(evento.target.value)}
                className="num"
              />
            </Campo>
            <Campo etiqueta="Cantidad de meses" htmlFor="periodo-cantidad" className="col-span-2 sm:col-span-1">
              <select
                id="periodo-cantidad"
                value={cantidad}
                onChange={(evento) => setCantidad(Number(evento.target.value))}
                className={clasesSelect}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} {i === 0 ? "mes" : "meses"}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-2">
              Se creará <span className="font-semibold text-ink">{etiquetaRango(mesesDesde(desde, cantidad))}</span>
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
                <span className="font-medium text-ink">
                  {etiquetaRango(mesesDePeriodo(p))}
                  <span className="ml-2 text-xs font-normal text-ink-3">
                    {p.cantidad} {p.cantidad === 1 ? "mes" : "meses"} · {anioDeMes(p.desde)}
                  </span>
                </span>
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
