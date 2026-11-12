import type { ConsumoSap, MateriaPrima, ReglaDemanda } from "./abastecimiento";
import { crearHistorial } from "./historial";
import { CONSUMOS_SAP_SEMILLA, MB51_SEMILLA } from "./abastecimiento-consumos";
import { MATERIAS_SEMILLA } from "./abastecimiento-semilla";
import { ABASTECIMIENTO_STORAGE_KEY } from "./constants";
import type { ResultadoMb51 } from "./mb51";
import { enlazarDocumento, guardar } from "./persistencia";
import type { MesKey } from "./types";
import { generarId, normalizarTexto } from "./utils";

/**
 * Abastecimiento de MP (store externo, persistido en la base de datos): parámetros y movimientos de
 * cada materia prima, y el consumo real leído del MB51.
 */

export interface InfoMb51 {
  archivo: string;
  desde: string;
  hasta: string;
  movimientos: number;
}

export interface EstadoAbastecimiento {
  materias: MateriaPrima[];
  /** Ids de materias primas del Excel que el usuario quitó (para que no reaparezcan al recargar). */
  eliminadas: string[];
  consumosSap: Record<string, ConsumoSap>;
  mb51: InfoMb51;
}

const SEMILLA: EstadoAbastecimiento = {
  materias: MATERIAS_SEMILLA,
  eliminadas: [],
  consumosSap: CONSUMOS_SAP_SEMILLA,
  mb51: MB51_SEMILLA,
};

let estado: EstadoAbastecimiento = SEMILLA;
let iniciado = false;

/** Versiones anteriores del estado, para «Deshacer». */
const historial = crearHistorial<EstadoAbastecimiento>();

/** Datos para dar de alta una materia prima desde la pantalla. */
export interface DatosMateriaNueva {
  nombre: string;
  codigosSap: string[];
  regla: ReglaDemanda | null;
  tasaMp: string | null;
  loteMinTn: number;
  stockMinTn: number;
  coberturaDias: number;
  costoKg: number | null;
  stockInicialTn: number;
  proveedor: { nombre: string; leadTimeDias: number };
  notas?: string;
}

/** Id legible y único a partir del nombre («Aceite crudo de palma» → «aceite-crudo-de-palma»). */
function idUnico(nombre: string, existentes: Set<string>): string {
  const base =
    normalizarTexto(nombre)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "mp";
  let id = base;
  for (let n = 2; existentes.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** Arma una materia prima completa con los datos del formulario de alta. */
export function crearMateria(datos: DatosMateriaNueva, existentes: Set<string>): MateriaPrima {
  const proveedorId = generarId();
  return {
    id: idUnico(datos.nombre, existentes),
    nombre: datos.nombre.trim(),
    codigosSap: datos.codigosSap,
    regla: datos.regla,
    tasaMp: datos.tasaMp,
    proveedores: [{ id: proveedorId, nombre: datos.proveedor.nombre.trim(), leadTimeDias: datos.proveedor.leadTimeDias }],
    proveedorSugeridoId: proveedorId,
    loteMinTn: datos.loteMinTn,
    loteConfirmado: true,
    stockMinTn: datos.stockMinTn,
    coberturaDias: datos.coberturaDias,
    costoKg: datos.costoKg,
    stockInicialTn: datos.stockInicialTn,
    ingresos: {},
    consumoManual: {},
    notas: datos.notas?.trim() ?? "",
  };
}

const oyentes = new Set<() => void>();

function notificar() {
  for (const oyente of oyentes) oyente();
}

const esNumero = (valor: unknown): valor is number => typeof valor === "number" && Number.isFinite(valor);

/** Mapa «mes → número» con solo las entradas válidas. */
function depurarMapa(valor: unknown): Record<MesKey, number> {
  const limpio: Record<MesKey, number> = {};
  if (typeof valor !== "object" || valor === null) return limpio;
  for (const [mes, cifra] of Object.entries(valor)) if (esNumero(cifra)) limpio[mes] = cifra;
  return limpio;
}

function depurarMateria(valor: unknown, base: MateriaPrima): MateriaPrima {
  if (typeof valor !== "object" || valor === null) return base;
  const v = valor as Partial<MateriaPrima>;
  const proveedores = Array.isArray(v.proveedores)
    ? v.proveedores.filter(
        (p) => p && typeof p.id === "string" && typeof p.nombre === "string" && esNumero(p.leadTimeDias),
      )
    : base.proveedores;
  const ingresos: MateriaPrima["ingresos"] = {};
  if (typeof v.ingresos === "object" && v.ingresos !== null) {
    for (const [proveedor, porMes] of Object.entries(v.ingresos)) ingresos[proveedor] = depurarMapa(porMes);
  }
  const proveedorSugeridoId = proveedores.some((p) => p.id === v.proveedorSugeridoId)
    ? (v.proveedorSugeridoId as string)
    : (proveedores[0]?.id ?? base.proveedorSugeridoId);
  const regla =
    v.regla === null
      ? null
      : v.regla && typeof v.regla.valor === "string" && ["emulsion", "polimero", "aditivo", "otrosAditivos"].includes(v.regla.campo)
        ? { campo: v.regla.campo, valor: v.regla.valor }
        : base.regla;
  return {
    ...base,
    nombre: typeof v.nombre === "string" && v.nombre.trim() ? v.nombre : base.nombre,
    codigosSap: Array.isArray(v.codigosSap) ? v.codigosSap.filter((c) => typeof c === "string") : base.codigosSap,
    regla,
    tasaMp: v.tasaMp === null ? null : typeof v.tasaMp === "string" ? v.tasaMp : base.tasaMp,
    notas: typeof v.notas === "string" ? v.notas : base.notas,
    proveedores: proveedores.length > 0 ? proveedores : base.proveedores,
    proveedorSugeridoId,
    loteMinTn: esNumero(v.loteMinTn) && v.loteMinTn >= 0 ? v.loteMinTn : base.loteMinTn,
    loteConfirmado: typeof v.loteConfirmado === "boolean" ? v.loteConfirmado : base.loteConfirmado,
    stockMinTn: esNumero(v.stockMinTn) && v.stockMinTn >= 0 ? v.stockMinTn : base.stockMinTn,
    coberturaDias: esNumero(v.coberturaDias) && v.coberturaDias >= 0 ? v.coberturaDias : base.coberturaDias,
    costoKg: v.costoKg === null ? null : esNumero(v.costoKg) && v.costoKg >= 0 ? v.costoKg : base.costoKg,
    stockInicialTn: esNumero(v.stockInicialTn) ? v.stockInicialTn : base.stockInicialTn,
    ingresos,
    consumoManual: depurarMapa(v.consumoManual),
  };
}

/** Valores de reserva para una MP creada por el usuario cuyo registro guardado esté incompleto. */
function PLANTILLA_PROPIA(m: { id: string }): MateriaPrima {
  return {
    id: m.id,
    nombre: m.id,
    codigosSap: [],
    regla: null,
    tasaMp: null,
    proveedores: [{ id: `${m.id}-prov`, nombre: "Proveedor", leadTimeDias: 30 }],
    proveedorSugeridoId: `${m.id}-prov`,
    loteMinTn: 1,
    loteConfirmado: true,
    stockMinTn: 0,
    coberturaDias: 30,
    costoKg: null,
    stockInicialTn: 0,
    ingresos: {},
    consumoManual: {},
    notas: "",
  };
}

export function depurar(valor: unknown): EstadoAbastecimiento | null {
  if (typeof valor !== "object" || valor === null) return null;
  const v = valor as Partial<EstadoAbastecimiento>;
  if (!Array.isArray(v.materias)) return null;

  // Las MP del Excel se parten de su original (una nueva del Excel aparece aunque falte en lo guardado),
  // salvo las que el usuario quitó. Las que el usuario creó se conservan tal cual, ya validadas.
  const eliminadas = Array.isArray(v.eliminadas) ? v.eliminadas.filter((id): id is string => typeof id === "string") : [];
  const guardadas = new Map<string, unknown>();
  for (const m of v.materias) if (m && typeof m.id === "string") guardadas.set(m.id, m);
  const idsSemilla = new Set(MATERIAS_SEMILLA.map((m) => m.id));
  const materias = [
    ...MATERIAS_SEMILLA.filter((base) => !eliminadas.includes(base.id)).map((base) =>
      depurarMateria(guardadas.get(base.id), base),
    ),
    ...v.materias
      .filter((m) => m && typeof m.id === "string" && !idsSemilla.has(m.id))
      .map((m) => depurarMateria(m, PLANTILLA_PROPIA(m))),
  ];

  const consumosSap: Record<string, ConsumoSap> = {};
  if (typeof v.consumosSap === "object" && v.consumosSap !== null) {
    for (const [codigo, consumo] of Object.entries(v.consumosSap)) {
      if (consumo && typeof consumo.nombre === "string") {
        consumosSap[codigo] = { nombre: consumo.nombre, meses: depurarMapa(consumo.meses) };
      }
    }
  }
  const mb51 = v.mb51;
  const infoValida = mb51 && typeof mb51.archivo === "string" && typeof mb51.desde === "string";
  return {
    materias,
    eliminadas,
    consumosSap: Object.keys(consumosSap).length > 0 ? consumosSap : SEMILLA.consumosSap,
    mb51: infoValida ? mb51 : SEMILLA.mb51,
  };
}

function establecer(siguiente: EstadoAbastecimiento) {
  if (siguiente !== estado) historial.registrar(estado);
  estado = siguiente;
  guardar(ABASTECIMIENTO_STORAGE_KEY, estado);
  notificar();
}

function hidratar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  void enlazarDocumento(ABASTECIMIENTO_STORAGE_KEY, (crudo) => {
    const limpio = depurar(crudo);
    if (limpio) {
      estado = limpio;
      notificar();
    }
  });
}

function cambiarMateria(id: string, cambio: (mp: MateriaPrima) => MateriaPrima) {
  establecer({ ...estado, materias: estado.materias.map((mp) => (mp.id === id ? cambio(mp) : mp)) });
}

/** Copia del mapa sin la clave, o con ella si hay valor. */
function conValor(mapa: Record<MesKey, number>, mes: MesKey, valor: number | undefined) {
  const copia = { ...mapa };
  if (valor === undefined) delete copia[mes];
  else copia[mes] = valor;
  return copia;
}

export const abastecimientoStore = {
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },

  obtenerInstantanea(): EstadoAbastecimiento {
    return estado;
  },

  obtenerInstantaneaServidor(): EstadoAbastecimiento {
    return SEMILLA;
  },

  /** Cambia parámetros de una MP (lote, stock mínimo, cobertura, costo, stock inicial, proveedor sugerido). */
  actualizarMateria(
    id: string,
    cambios: Partial<
      Pick<
        MateriaPrima,
        "loteMinTn" | "loteConfirmado" | "stockMinTn" | "coberturaDias" | "costoKg" | "stockInicialTn" | "proveedorSugeridoId"
      >
    >,
  ): void {
    cambiarMateria(id, (mp) => ({ ...mp, ...cambios }));
  },

  actualizarLeadTime(id: string, proveedorId: string, dias: number): void {
    cambiarMateria(id, (mp) => ({
      ...mp,
      proveedores: mp.proveedores.map((p) => (p.id === proveedorId ? { ...p, leadTimeDias: dias } : p)),
    }));
  },

  /** Fija (o borra, con `undefined`) el ingreso de un proveedor en un mes. */
  fijarIngreso(id: string, proveedorId: string, mes: MesKey, tn: number | undefined): void {
    cambiarMateria(id, (mp) => ({
      ...mp,
      ingresos: { ...mp.ingresos, [proveedorId]: conValor(mp.ingresos[proveedorId] ?? {}, mes, tn) },
    }));
  },

  /** Suma una compra sugerida a los ingresos confirmados. */
  confirmarCompra(id: string, proveedorId: string, mes: MesKey, tn: number): void {
    cambiarMateria(id, (mp) => {
      const actual = mp.ingresos[proveedorId]?.[mes] ?? 0;
      return {
        ...mp,
        ingresos: {
          ...mp.ingresos,
          [proveedorId]: conValor(mp.ingresos[proveedorId] ?? {}, mes, Math.round((actual + tn) * 1e6) / 1e6),
        },
      };
    });
  },

  /** Escribe a mano el consumo de un mes (o lo borra, con `undefined`, para volver al automático). */
  fijarConsumo(id: string, mes: MesKey, tn: number | undefined): void {
    cambiarMateria(id, (mp) => ({ ...mp, consumoManual: conValor(mp.consumoManual, mes, tn) }));
  },

  /** Reemplaza el consumo de los códigos que trae el archivo; los demás se conservan. */
  importarMb51(resultado: ResultadoMb51): void {
    establecer({
      ...estado,
      consumosSap: { ...estado.consumosSap, ...resultado.consumos },
      mb51: {
        archivo: resultado.archivo,
        desde: resultado.desde,
        hasta: resultado.hasta,
        movimientos: resultado.movimientos,
      },
    });
  },

  restaurar(): void {
    establecer(SEMILLA);
  },

  /** Da de alta una materia prima con su primer proveedor. Devuelve su id. */
  agregarMateria(datos: DatosMateriaNueva): string {
    const nueva = crearMateria(datos, new Set(estado.materias.map((m) => m.id)));
    establecer({ ...estado, materias: [...estado.materias, nueva], eliminadas: estado.eliminadas.filter((id) => id !== nueva.id) });
    return nueva.id;
  },

  /** Cambia los datos de identificación: nombre, códigos SAP, regla de demanda, tasa y notas. */
  actualizarDatosMateria(
    id: string,
    cambios: Partial<Pick<MateriaPrima, "nombre" | "codigosSap" | "regla" | "tasaMp" | "notas">>,
  ): void {
    cambiarMateria(id, (mp) => ({ ...mp, ...cambios }));
  },

  /** Quita una materia prima. Si venía del Excel, se recuerda para que no reaparezca. */
  eliminarMateria(id: string): void {
    const eraDelExcel = MATERIAS_SEMILLA.some((m) => m.id === id);
    establecer({
      ...estado,
      materias: estado.materias.filter((m) => m.id !== id),
      eliminadas: eraDelExcel && !estado.eliminadas.includes(id) ? [...estado.eliminadas, id] : estado.eliminadas,
    });
  },

  /** Agrega un proveedor a una materia prima. Devuelve el id del proveedor. */
  agregarProveedor(id: string, datos: { nombre: string; leadTimeDias: number }): string {
    const proveedorId = generarId();
    cambiarMateria(id, (mp) => ({
      ...mp,
      proveedores: [...mp.proveedores, { id: proveedorId, nombre: datos.nombre.trim(), leadTimeDias: datos.leadTimeDias }],
    }));
    return proveedorId;
  },

  /** Cambia el nombre y/o el tiempo de entrega de un proveedor. */
  actualizarProveedor(id: string, proveedorId: string, cambios: { nombre?: string; leadTimeDias?: number }): void {
    cambiarMateria(id, (mp) => ({
      ...mp,
      proveedores: mp.proveedores.map((p) =>
        p.id === proveedorId
          ? { ...p, ...(cambios.nombre !== undefined ? { nombre: cambios.nombre.trim() } : {}), ...(cambios.leadTimeDias !== undefined ? { leadTimeDias: cambios.leadTimeDias } : {}) }
          : p,
      ),
    }));
  },

  /**
   * Quita un proveedor junto con sus ingresos. Siempre queda al menos uno: devuelve `false` si era el
   * único. Si era el sugerido, las compras pasan al primero que quede.
   */
  eliminarProveedor(id: string, proveedorId: string): boolean {
    const mp = estado.materias.find((m) => m.id === id);
    if (!mp || mp.proveedores.length <= 1 || !mp.proveedores.some((p) => p.id === proveedorId)) return false;
    cambiarMateria(id, (actual) => {
      const proveedores = actual.proveedores.filter((p) => p.id !== proveedorId);
      const ingresos = { ...actual.ingresos };
      delete ingresos[proveedorId];
      return {
        ...actual,
        proveedores,
        ingresos,
        proveedorSugeridoId: actual.proveedorSugeridoId === proveedorId ? proveedores[0].id : actual.proveedorSugeridoId,
      };
    });
    return true;
  },

  /** Vuelve a la versión anterior. Devuelve `false` si no hay nada que deshacer. */
  deshacer(): boolean {
    const anterior = historial.deshacer();
    if (!anterior) return false;
    estado = anterior;
    guardar(ABASTECIMIENTO_STORAGE_KEY, estado);
    notificar();
    return true;
  },

  puedeDeshacer(): boolean {
    return historial.cantidad() > 0;
  },

  puedeDeshacerServidor(): boolean {
    return false;
  },

  /** Solo para pruebas: vuelve al estado de fábrica sin dejar historial. */
  _reiniciarParaPruebas(): void {
    estado = SEMILLA;
    historial.vaciar();
  },
};
