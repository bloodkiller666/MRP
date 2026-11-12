import { convertirACisternas, UNIDAD_CISTERNAS } from "./conversion";
import { fraccionEmul01, listaOtrosAditivos } from "./mezclas";
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
  cisternas: (campo: "emulsion" | "polimero" | "aditivo" | "otrosAditivos", valor: string) => Record<MesKey, number>;
}

/**
 * Qué parte de la demanda de un registro consume una materia prima (0 = nada, 1 = todo).
 * Los Adhesol se reparten por grado: 7000 = 70 % de EMUL-01 y 30 % de aceite epoxidado.
 * «Otros aditivos» admite varios por registro («T1000, T2000»).
 */
export function pesoDeConsumo(registro: RegistroMRP, campo: ReglaDemandaCampo, valor: string): number {
  if (campo === "otrosAditivos") return listaOtrosAditivos(registro.otrosAditivos).includes(valor.toUpperCase()) ? 1 : 0;
  if (registro[campo] !== valor) return 0;
  const fraccion = fraccionEmul01(registro.detalleProducto);
  if (fraccion === null) return 1;
  if (campo === "emulsion" && valor === "EMUL-01") return fraccion;
  if (campo === "aditivo" && valor === "ACEITE EPOXIDADO") return 1 - fraccion;
  return 1;
}

type ReglaDemandaCampo = "emulsion" | "polimero" | "aditivo" | "otrosAditivos";

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
        const peso = pesoDeConsumo(r, campo, valor);
        if (peso === 0) continue;
        for (const [mes, cantidad] of Object.entries(r.proyecciones)) {
          if (cantidad !== undefined) porMes[mes] = (porMes[mes] ?? 0) + cantidad * peso;
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

export interface DemandaDeCliente {
  propietario: string;
  cuenta: string;
  /** Cisternas por mes que este cliente le pide a la materia prima. */
  cisternas: Record<MesKey, number>;
}

/**
 * Demanda de una materia prima desglosada por cliente (las filas de arriba de cada hoja «RESUMEN …»).
 * Solo salen los clientes con algo de demanda, de mayor a menor.
 */
export function demandaPorCliente(
  registros: RegistroMRP[],
  campo: ReglaDemandaCampo,
  valor: string,
): DemandaDeCliente[] {
  const filas = new Map<string, DemandaDeCliente>();
  const enCisternas = convertirACisternas(registros).filter((r) => r.unidadMedida === UNIDAD_CISTERNAS);
  for (const r of enCisternas) {
    const peso = pesoDeConsumo(r, campo, valor);
    if (peso === 0) continue;
    const clave = `${r.propietario}\u0000${r.cuenta}`;
    const fila = filas.get(clave) ?? { propietario: r.propietario, cuenta: r.cuenta, cisternas: {} };
    for (const [mes, cantidad] of Object.entries(r.proyecciones)) {
      if (cantidad !== undefined) fila.cisternas[mes] = (fila.cisternas[mes] ?? 0) + cantidad * peso;
    }
    filas.set(clave, fila);
  }
  const total = (f: DemandaDeCliente) => Object.values(f.cisternas).reduce((a, b) => a + b, 0);
  return [...filas.values()].filter((f) => total(f) > 1e-9).sort((a, b) => total(b) - total(a));
}
