import { convertirACisternas, UNIDAD_CISTERNAS } from "./conversion";
import type { MesKey, RegistroMRP } from "./types";

/**
 * Comparación del pronóstico de Seguimiento entre dos fotos (dos cortes mensuales, o un corte y los datos
 * actuales). Todo se compara en cisternas; las UM sin conversión (UND) quedan fuera.
 */

export type EstadoCambio = "nuevo" | "retirado" | "cambio" | "igual";

export interface LineaComparada {
  clave: string;
  proyecto: string;
  detalleProducto: string;
  a: Record<MesKey, number>;
  b: Record<MesKey, number>;
  totalA: number;
  totalB: number;
  estado: EstadoCambio;
}

export interface ClienteComparado {
  cuenta: string;
  propietario: string;
  a: Record<MesKey, number>;
  b: Record<MesKey, number>;
  totalA: number;
  totalB: number;
  estado: EstadoCambio;
  lineas: LineaComparada[];
}

export interface Comparacion {
  meses: MesKey[];
  clientes: ClienteComparado[];
  totalesA: Record<MesKey, number>;
  totalesB: Record<MesKey, number>;
  totalA: number;
  totalB: number;
  /** Cuántos clientes entraron, salieron o cambiaron. */
  resumen: Record<EstadoCambio, number>;
}

const EPS = 0.005;

function sumar(destino: Record<MesKey, number>, origen: Record<MesKey, number>) {
  for (const [mes, v] of Object.entries(origen)) destino[mes] = (destino[mes] ?? 0) + v;
}

const totalDe = (porMes: Record<MesKey, number>, meses: MesKey[]) => meses.reduce((a, m) => a + (porMes[m] ?? 0), 0);

function estadoDe(a: Record<MesKey, number>, b: Record<MesKey, number>, meses: MesKey[]): EstadoCambio {
  const ta = totalDe(a, meses);
  const tb = totalDe(b, meses);
  if (ta < EPS && tb >= EPS) return "nuevo";
  if (ta >= EPS && tb < EPS) return "retirado";
  return meses.some((m) => Math.abs((a[m] ?? 0) - (b[m] ?? 0)) >= EPS) ? "cambio" : "igual";
}

/** Meses con pronóstico en cualquiera de las listas, ordenados. */
export function mesesConPronostico(...listas: RegistroMRP[][]): MesKey[] {
  const meses = new Set<MesKey>();
  for (const lista of listas) {
    for (const r of lista) for (const [mes, v] of Object.entries(r.proyecciones)) if (v !== undefined) meses.add(mes);
  }
  return [...meses].sort();
}

interface LineaAgrupada {
  propietario: string;
  cuenta: string;
  proyecto: string;
  detalleProducto: string;
  mes: Record<MesKey, number>;
}

function agrupar(registros: RegistroMRP[]): Map<string, LineaAgrupada> {
  const lineas = new Map<string, LineaAgrupada>();
  for (const r of convertirACisternas(registros).filter((x) => x.unidadMedida === UNIDAD_CISTERNAS)) {
    const clave = [r.cuenta, r.proyecto, r.detalleProducto].join("\u0000");
    const linea = lineas.get(clave) ?? {
      propietario: r.propietario,
      cuenta: r.cuenta,
      proyecto: r.proyecto,
      detalleProducto: r.detalleProducto,
      mes: {},
    };
    for (const [mes, v] of Object.entries(r.proyecciones)) if (v !== undefined) linea.mes[mes] = (linea.mes[mes] ?? 0) + v;
    lineas.set(clave, linea);
  }
  return lineas;
}

/**
 * Compara `a` (base) contra `b` (nuevo) en los meses indicados. El delta de cada celda es `b − a`.
 * Las filas se emparejan por cliente + proyecto + producto, y se agrupan por cliente.
 */
export function compararRegistros(a: RegistroMRP[], b: RegistroMRP[], meses: MesKey[]): Comparacion {
  const lA = agrupar(a);
  const lB = agrupar(b);
  const claves = new Set([...lA.keys(), ...lB.keys()]);
  const clientes = new Map<string, ClienteComparado>();

  for (const clave of claves) {
    const x = lA.get(clave);
    const y = lB.get(clave);
    const ref = (y ?? x) as LineaAgrupada;
    const linea: LineaComparada = {
      clave,
      proyecto: ref.proyecto,
      detalleProducto: ref.detalleProducto,
      a: x?.mes ?? {},
      b: y?.mes ?? {},
      totalA: totalDe(x?.mes ?? {}, meses),
      totalB: totalDe(y?.mes ?? {}, meses),
      estado: estadoDe(x?.mes ?? {}, y?.mes ?? {}, meses),
    };
    if (linea.totalA < EPS && linea.totalB < EPS) continue; // sin pronóstico en el rango
    const cliente: ClienteComparado = clientes.get(ref.cuenta) ?? {
      cuenta: ref.cuenta,
      propietario: ref.propietario,
      a: {},
      b: {},
      totalA: 0,
      totalB: 0,
      estado: "igual",
      lineas: [],
    };
    sumar(cliente.a, linea.a);
    sumar(cliente.b, linea.b);
    cliente.lineas.push(linea);
    clientes.set(ref.cuenta, cliente);
  }

  const lista = [...clientes.values()];
  for (const c of lista) {
    c.totalA = totalDe(c.a, meses);
    c.totalB = totalDe(c.b, meses);
    c.estado = estadoDe(c.a, c.b, meses);
    c.lineas.sort((p, q) => Math.abs(q.totalB - q.totalA) - Math.abs(p.totalB - p.totalA));
  }
  lista.sort((p, q) => Math.abs(q.totalB - q.totalA) - Math.abs(p.totalB - p.totalA) || q.totalB - p.totalB);

  const totalesA: Record<MesKey, number> = {};
  const totalesB: Record<MesKey, number> = {};
  for (const c of lista) {
    sumar(totalesA, c.a);
    sumar(totalesB, c.b);
  }
  const resumen: Record<EstadoCambio, number> = { nuevo: 0, retirado: 0, cambio: 0, igual: 0 };
  for (const c of lista) resumen[c.estado]++;

  return {
    meses,
    clientes: lista,
    totalesA,
    totalesB,
    totalA: totalDe(totalesA, meses),
    totalB: totalDe(totalesB, meses),
    resumen,
  };
}
