import { convertirACisternas, UNIDAD_CISTERNAS } from "./conversion";
import type { MateriaPrima } from "./abastecimiento";
import { calcularTasa, type TasaMP } from "./tasas";
import type { MesKey, RegistroMRP } from "./types";

/**
 * Demanda de la app convertida al consumo de cada materia prima, como hace el Excel:
 *
 *   consumo (TN) = cisternas de los productos que la llevan × kg por cisterna ÷ 1000
 *
 * Los registros deben traer ya la mezcla aplicada (emulsión, polímero y aditivo).
 */
export interface DemandaEnCisternas {
  /** Meses con algún pronóstico cargado (fuera de ellos no se sabe la demanda, no es que sea cero). */
  mesesConPronostico: ReadonlySet<MesKey>;
  /** Cisternas por mes de los registros que cumplen la regla. */
  cisternas: (campo: "emulsion" | "polimero" | "aditivo", valor: string) => Record<MesKey, number>;
}

export function extraerDemanda(registros: RegistroMRP[]): DemandaEnCisternas {
  const meses = new Set<MesKey>();
  for (const r of registros) {
    for (const [mes, valor] of Object.entries(r.proyecciones)) if (valor !== undefined) meses.add(mes);
  }
  // Las UM sin conversión (p. ej. UND) no son una cantidad de cisternas: se dejan fuera.
  const enCisternas = convertirACisternas(registros).filter((r) => r.unidadMedida === UNIDAD_CISTERNAS);

  return {
    mesesConPronostico: meses,
    cisternas(campo, valor) {
      const porMes: Record<MesKey, number> = {};
      for (const mes of meses) porMes[mes] = 0;
      for (const r of enCisternas) {
        if (r[campo] !== valor) continue;
        for (const [mes, cantidad] of Object.entries(r.proyecciones)) {
          if (cantidad !== undefined) porMes[mes] = (porMes[mes] ?? 0) + cantidad;
        }
      }
      return porMes;
    },
  };
}

/** Consumo proyectado (TN por mes) de una MP, o `null` si no tiene regla o no tiene tasa. */
export function consumoPronosticado(
  mp: Pick<MateriaPrima, "regla" | "tasaMp">,
  demanda: DemandaEnCisternas,
  tasas: TasaMP[],
): Record<MesKey, number> | null {
  if (!mp.regla || !mp.tasaMp) return null;
  const tasa = tasas.find((t) => t.mp === mp.tasaMp);
  if (!tasa) return null;
  const kgPorCisterna = calcularTasa(tasa).kgPorCisterna;
  const resultado: Record<MesKey, number> = {};
  for (const [mes, cisternas] of Object.entries(demanda.cisternas(mp.regla.campo, mp.regla.valor))) {
    resultado[mes] = (cisternas * kgPorCisterna) / 1000;
  }
  return resultado;
}
