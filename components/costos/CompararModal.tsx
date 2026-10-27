"use client";

import {
  costoReceta,
  formatearFecha,
  porcentaje,
  soles2,
  soles4,
} from "@/lib/costos/calculo";
import type { DatosCostos, Insumo } from "@/lib/costos/types";

import { Boton } from "../ui/Boton";
import { Modal } from "../ui/Modal";

interface PropsComparar {
  ids: string[];
  datos: DatosCostos;
  insumosPorId: Map<string, Insumo>;
  fecha: string;
  onCerrar: () => void;
}

/** Compara de 2 a 4 variantes lado a lado: composición por insumo y totales, con la diferencia frente a la más barata. */
export function CompararModal({ ids, datos, insumosPorId, fecha, onCerrar }: PropsComparar) {
  const recetas = ids.map((id) => datos.recetas.find((r) => r.id === id)).filter((r) => r !== undefined);
  const costos = recetas.map((r) => costoReceta(r, insumosPorId, datos.parametros, fecha));

  const completos = costos.filter((c) => c.completo).map((c) => c.total);
  const minimo = completos.length ? Math.min(...completos) : 0;

  // Unión de insumos usados por cualquiera de las recetas.
  const insumoIds = [...new Set(recetas.flatMap((r) => r.lineas.map((l) => l.insumoId)))];

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Comparar variantes"
      descripcion={`Costos al ${formatearFecha(fecha)} · soles por kg salvo donde se indica`}
      tamano="xl"
      pie={
        <Boton variante="fantasma" onClick={onCerrar}>
          Cerrar
        </Boton>
      }
    >
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left">
              <th className="rotulo sticky left-0 z-10 border-b border-line-strong bg-surface-2 px-3 py-2 text-ink-2">Concepto</th>
              {recetas.map((r) => (
                <th key={r.id} className="min-w-44 border-b border-line-strong bg-surface-2 px-3 py-2 align-bottom">
                  <span className="rotulo text-accent">Grado {r.grado}</span>
                  <p className="mt-0.5 text-xs leading-snug font-medium text-ink">{r.nombre}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {insumoIds.map((id) => (
              <tr key={id}>
                <td className="sticky left-0 border-b border-line bg-surface px-3 py-1.5 text-ink-2">
                  {insumosPorId.get(id)?.nombre ?? "(eliminado)"}
                </td>
                {recetas.map((r, i) => {
                  const linea = costos[i].lineas.find((l) => l.insumoId === id);
                  return (
                    <td key={r.id} className="num border-b border-line px-3 py-1.5">
                      {linea ? (
                        <>
                          <span className="font-medium text-ink">{soles4(linea.costo)}</span>
                          <span className="ml-1.5 text-xs text-ink-3">{porcentaje(linea.proporcion, 1)}</span>
                        </>
                      ) : (
                        <span className="text-ink-3">–</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <Fila etiqueta="Materia prima (MP)" valores={costos.map((c) => soles4(c.mp))} />
            <Fila etiqueta="Gas + mano de obra" valores={costos.map((c) => soles4(c.gas + c.mo))} />
            <Fila etiqueta="Total soles por kg" valores={costos.map((c) => (c.completo ? soles4(c.total) : "–"))} fuerte />
            <Fila etiqueta="Total soles por galón" valores={costos.map((c) => (c.completo ? soles2(c.galon) : "–"))} fuerte acento />
            <Fila
              etiqueta="Frente a la más barata"
              valores={costos.map((c) => {
                if (!c.completo || minimo <= 0) return "–";
                const dif = c.total / minimo - 1;
                return dif < 0.00005 ? "la más barata" : `+${porcentaje(dif)} (+${soles2((c.total - minimo) * datos.parametros.kgPorGalon)} S/gal)`;
              })}
            />
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function Fila({ etiqueta, valores, fuerte, acento }: { etiqueta: string; valores: string[]; fuerte?: boolean; acento?: boolean }) {
  return (
    <tr className={fuerte ? "bg-surface-2" : undefined}>
      <td className={`sticky left-0 border-b border-line px-3 py-2 ${fuerte ? "bg-surface-2 font-semibold" : "bg-surface text-ink-2"}`}>{etiqueta}</td>
      {valores.map((v, i) => (
        <td key={i} className={`num border-b border-line px-3 py-2 ${fuerte ? "font-semibold" : ""} ${acento ? "text-accent" : ""}`}>
          {v}
        </td>
      ))}
    </tr>
  );
}
