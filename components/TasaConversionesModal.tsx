"use client";

import { RotateCcw } from "lucide-react";

import { useTasas } from "@/hooks/use-tasas";
import { calcularTasa, KG_POR_CISTERNA, UNIDADES_ENTRADA, type UnidadEntrada } from "@/lib/tasas";
import { parsearNumero } from "@/lib/utils";

import { Boton } from "./ui/Boton";
import { clasesInput, clasesSelect } from "./ui/Campos";
import { Modal } from "./ui/Modal";

interface PropsTasas {
  abierto: boolean;
  onCerrar: () => void;
}

const formato = (decimales: number) =>
  new Intl.NumberFormat("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: decimales });
const f2 = formato(2);
const f4 = formato(4);
const f5 = formato(5);

const CLASES_TH = "border-b border-line-strong bg-surface-2 px-3 py-2 text-left text-xs font-semibold text-ink-2";
const CLASES_TD = "num border-b border-line px-3 py-1.5 text-right text-sm text-ink";

/**
 * Tasa de conversiones: cuánta MP lleva una cisterna. Se edita el valor y la unidad de entrada
 * (las columnas de la izquierda); el resto se recalcula. Mismas columnas que la hoja del Excel.
 */
export function TasaConversionesModal({ abierto, onCerrar }: PropsTasas) {
  const { tasas, actualizar, restaurar } = useTasas();

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Tasa de conversiones"
      descripcion={`Materia prima por cisterna de 8 000 galones (${f2.format(KG_POR_CISTERNA / 1000)} TM). Edita el valor ingresado y la unidad; el resto se calcula.`}
      tamano="xl"
      pie={
        <>
          <Boton variante="fantasma" onClick={restaurar} icono={<RotateCcw className="size-4" />} className="mr-auto">
            Restaurar valores del Excel
          </Boton>
          <Boton variante="primario" onClick={onCerrar}>
            Cerrar
          </Boton>
        </>
      }
    >
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[56rem] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={CLASES_TH}>MP</th>
              <th className={`${CLASES_TH} text-right`}>Valor ingresado</th>
              <th className={CLASES_TH}>Unidad de entrada</th>
              <th className={`${CLASES_TH} text-right`}>% cisterna</th>
              <th className={`${CLASES_TH} text-right`}>kg/TN</th>
              <th className={`${CLASES_TH} text-right`}>kg/cisterna</th>
              <th className={`${CLASES_TH} text-right`}>TM/cisterna</th>
              <th className={`${CLASES_TH} text-right`}>Galones/cisterna aprox.</th>
            </tr>
          </thead>
          <tbody>
            {tasas.map((tasa) => {
              const c = calcularTasa(tasa);
              return (
                <tr key={tasa.mp} className="hover:bg-surface-2">
                  <th scope="row" className="border-b border-line px-3 py-1.5 text-left text-sm font-medium text-ink">
                    {tasa.mp}
                  </th>
                  <td className="border-b border-line px-3 py-1.5">
                    <input
                      // La clave fuerza a releer el valor guardado tras confirmar o restaurar.
                      key={`${tasa.valor}-${tasa.unidad}`}
                      aria-label={`Valor ingresado de ${tasa.mp}`}
                      inputMode="decimal"
                      defaultValue={f5.format(tasa.valor)}
                      onBlur={(evento) => {
                        const valor = parsearNumero(evento.target.value);
                        if (valor !== undefined && valor >= 0) actualizar(tasa.mp, { valor });
                        else evento.target.value = f5.format(tasa.valor);
                      }}
                      onKeyDown={(evento) => {
                        if (evento.key === "Enter") evento.currentTarget.blur();
                      }}
                      className={`${clasesInput} num h-8 w-28 text-right`}
                    />
                  </td>
                  <td className="border-b border-line px-3 py-1.5">
                    <select
                      aria-label={`Unidad de entrada de ${tasa.mp}`}
                      value={tasa.unidad}
                      onChange={(evento) => actualizar(tasa.mp, { unidad: evento.target.value as UnidadEntrada })}
                      className={`${clasesSelect} h-8 w-40`}
                    >
                      {UNIDADES_ENTRADA.map((unidad) => (
                        <option key={unidad} value={unidad}>
                          {unidad}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={CLASES_TD}>{f4.format(c.pctCisterna * 100)} %</td>
                  <td className={CLASES_TD}>{f2.format(c.kgPorTn)}</td>
                  <td className={CLASES_TD}>{f2.format(c.kgPorCisterna)}</td>
                  <td className={CLASES_TD}>{f4.format(c.tmPorCisterna)}</td>
                  <td className={CLASES_TD}>{f2.format(c.galonesPorCisterna)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Una cisterna lleva 8 000 galones × 3,785 = 30 280 kg. % cisterna = kg/cisterna ÷ 30 280; kg/TN = % cisterna ×
        1000; galones = kg/cisterna ÷ 3,785.
      </p>
    </Modal>
  );
}
