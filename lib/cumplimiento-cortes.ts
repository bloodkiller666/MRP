import { compararRegistros } from "./comparar-cortes";
import { estadoPorRatio } from "./mrp-utils";
import type { EstadoCumplimiento, MesKey, RegistroMRP } from "./types";

/**
 * Cumplimiento medido contra el pronóstico del corte anterior.
 *
 * En cada libro mensual, el mes del corte ya trae el real + avance en lugar del pronóstico. Por eso el
 * cumplimiento útil de un mes M compara lo que decía el **corte anterior** para M (el pronóstico, antes de ser
 * reemplazado) con lo que trae el corte de M (real + avance). Todo se compara en cisternas.
 *
 * Ojo: el real + avance de un mes es el avance **a la fecha en que se hizo el corte**, no necesariamente el mes
 * completo; por eso los porcentajes suelen quedar por debajo de 100 % aunque el cliente termine cumpliendo.
 */

export type EstadoCliente = "cumple" | "en-riesgo" | "critico" | "sin-pronostico" | "sin-real";

export interface ClienteCumplimiento {
  cuenta: string;
  propietario: string;
  pronostico: number;
  real: number;
  /** real − pronóstico (cisternas). */
  desvio: number;
  /** real ÷ pronóstico; `null` si el corte anterior no lo pronosticaba. */
  ratio: number | null;
  estado: EstadoCliente;
}

export interface CumplimientoMes {
  mes: MesKey;
  /** Corte que se usó como pronóstico (el último anterior a `mes`). */
  corteBase: MesKey;
  /** Pronóstico del corte anterior para este mes. */
  pronostico: number;
  /** Real + avance del mes, de los clientes que el corte anterior sí pronosticaba. */
  real: number;
  /** Real + avance de clientes que el corte anterior no pronosticaba. */
  realSinPronostico: number;
  /** real ÷ pronóstico (clientes pronosticados); `null` si no se pronosticó nada. */
  ratio: number | null;
  estado: EstadoCumplimiento;
  clientes: ClienteCumplimiento[];
  /**
   * Es el mes del corte más reciente: su «real» es solo el avance hasta la fecha del corte, no el mes completo, así
   * que su cumplimiento aún no es definitivo.
   */
  enCurso: boolean;
}

interface CorteMinimo {
  registros: RegistroMRP[];
}

/** El real + avance del mes del corte: lo de «Resumen Despachos» si vino, y si no, la columna del mes en «Base de datos». */
function conRealDelMes(registros: RegistroMRP[], mes: MesKey): RegistroMRP[] {
  return registros.map((r) => ({
    ...r,
    proyecciones: { [mes]: r.reales[mes] ?? r.proyecciones[mes] },
    reales: {},
  }));
}

function estadoDeCliente(ratio: number | null, pronostico: number, real: number): EstadoCliente {
  if (pronostico <= 0) return "sin-pronostico";
  if (real <= 0) return "sin-real";
  const e = estadoPorRatio(ratio ?? 0);
  return e === "verde" ? "cumple" : e === "amarillo" ? "en-riesgo" : "critico";
}

/**
 * Para cada mes con corte propio y algún corte anterior, el cumplimiento del real del mes contra el pronóstico
 * que daba el corte anterior. Ordenado por mes.
 */
export function cumplimientoContraCorteAnterior(cortes: Record<MesKey, CorteMinimo>): CumplimientoMes[] {
  const meses = Object.keys(cortes).sort();
  const salida: CumplimientoMes[] = [];
  for (const mes of meses) {
    const corteBase = meses.filter((m) => m < mes).at(-1);
    if (!corteBase) continue;
    const cmp = compararRegistros(cortes[corteBase].registros, conRealDelMes(cortes[mes].registros, mes), [mes]);

    const clientes: ClienteCumplimiento[] = cmp.clientes.map((c) => {
      const ratio = c.totalA > 0 ? c.totalB / c.totalA : null;
      return {
        cuenta: c.cuenta,
        propietario: c.propietario,
        pronostico: c.totalA,
        real: c.totalB,
        desvio: c.totalB - c.totalA,
        ratio,
        estado: estadoDeCliente(ratio, c.totalA, c.totalB),
      };
    });
    const pronosticados = clientes.filter((c) => c.pronostico > 0);
    const pronostico = pronosticados.reduce((a, c) => a + c.pronostico, 0);
    const real = pronosticados.reduce((a, c) => a + c.real, 0);
    const ratio = pronostico > 1e-9 ? real / pronostico : null;
    salida.push({
      mes,
      corteBase,
      pronostico,
      real,
      realSinPronostico: clientes.filter((c) => c.pronostico <= 0).reduce((a, c) => a + c.real, 0),
      ratio,
      estado: ratio === null ? "sin-demanda" : estadoPorRatio(ratio),
      enCurso: mes === meses[meses.length - 1],
      clientes: clientes.sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio)),
    });
  }
  return salida;
}
