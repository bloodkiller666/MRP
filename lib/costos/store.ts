import { generarId } from "../utils";
import { formatearFecha } from "./calculo";
import { INSUMOS_SEMILLA, RECETAS_SEMILLA } from "./seed";
import type { CambioCosto, DatosCostos, Grado, Insumo, ParametrosCosto, PrecioInsumo, Receta } from "./types";

/**
 * Almacén de la sección «Costos PLUS» (store externo, persistido en localStorage).
 *
 * Misma estrategia que el MRP: la copia en memoria se lee una sola vez, todo cambio pasa por
 * `establecer` (que persiste y notifica) y `useSyncExternalStore` evita desajustes de hidratación.
 * Es independiente del MRP: usa su propia clave y no comparte datos con él.
 */

export const COSTOS_STORAGE_KEY = "costos:v1";

export const PARAMETROS_INICIALES: ParametrosCosto = {
  gas: 0.005555555555555555,
  mo: 0.001533333333333333,
  kgPorGalon: 3.785,
};

const MAX_CAMBIOS = 300;

function datosIniciales(): DatosCostos {
  return {
    insumos: INSUMOS_SEMILLA.map((i) => ({ ...i, precios: i.precios.map((p) => ({ ...p })) })),
    recetas: RECETAS_SEMILLA.map((r) => ({ ...r, lineas: r.lineas.map((l) => ({ ...l })) })),
    parametros: { ...PARAMETROS_INICIALES },
    cambios: [],
  };
}

const SEMILLA: DatosCostos = datosIniciales();

let estado: DatosCostos = SEMILLA;
let hidratado = false;
const oyentes = new Set<() => void>();

function notificar() {
  for (const oyente of oyentes) oyente();
}

function establecer(siguiente: DatosCostos, cambio?: string) {
  const cambios = cambio
    ? [{ id: generarId(), cuando: new Date().toISOString(), texto: cambio }, ...siguiente.cambios].slice(0, MAX_CAMBIOS)
    : siguiente.cambios;
  estado = { ...siguiente, cambios };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(COSTOS_STORAGE_KEY, JSON.stringify(estado));
    } catch {
      // Cuota excedida o modo privado: la sección sigue funcionando en memoria.
    }
  }
  notificar();
}

/* ------------------------------ Validación -------------------------------- */

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function ordenarPrecios(precios: PrecioInsumo[]): PrecioInsumo[] {
  return [...precios].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function depurar(crudo: unknown): DatosCostos | null {
  if (!esObjeto(crudo) || !Array.isArray(crudo.insumos) || !Array.isArray(crudo.recetas)) return null;

  const insumos: Insumo[] = [];
  for (const i of crudo.insumos) {
    if (!esObjeto(i) || typeof i.id !== "string" || typeof i.nombre !== "string") continue;
    const precios: PrecioInsumo[] = [];
    for (const p of Array.isArray(i.precios) ? i.precios : []) {
      if (esObjeto(p) && esFecha(p.fecha) && typeof p.precio === "number" && Number.isFinite(p.precio)) {
        precios.push({ id: typeof p.id === "string" ? p.id : generarId(), fecha: p.fecha, precio: p.precio, nota: typeof p.nota === "string" ? p.nota : "" });
      }
    }
    insumos.push({
      id: i.id,
      nombre: i.nombre,
      proveedor: typeof i.proveedor === "string" ? i.proveedor : "",
      archivado: i.archivado === true,
      precios: ordenarPrecios(precios),
    });
  }

  const recetas: Receta[] = [];
  for (const r of crudo.recetas) {
    if (!esObjeto(r) || typeof r.id !== "string" || typeof r.nombre !== "string") continue;
    if (r.grado !== "A" && r.grado !== "B" && r.grado !== "C") continue;
    const lineas = (Array.isArray(r.lineas) ? r.lineas : [])
      .filter((l): l is Record<string, unknown> => esObjeto(l) && typeof l.insumoId === "string" && typeof l.proporcion === "number")
      .map((l) => ({ insumoId: l.insumoId as string, proporcion: l.proporcion as number }));
    recetas.push({ id: r.id, grado: r.grado, nombre: r.nombre, nota: typeof r.nota === "string" ? r.nota : "", archivada: r.archivada === true, lineas });
  }

  const p = esObjeto(crudo.parametros) ? crudo.parametros : {};
  const parametros: ParametrosCosto = {
    gas: typeof p.gas === "number" ? p.gas : PARAMETROS_INICIALES.gas,
    mo: typeof p.mo === "number" ? p.mo : PARAMETROS_INICIALES.mo,
    kgPorGalon: typeof p.kgPorGalon === "number" && p.kgPorGalon > 0 ? p.kgPorGalon : PARAMETROS_INICIALES.kgPorGalon,
  };

  const cambios: CambioCosto[] = (Array.isArray(crudo.cambios) ? crudo.cambios : [])
    .filter((c): c is Record<string, unknown> => esObjeto(c) && typeof c.texto === "string" && typeof c.cuando === "string")
    .map((c) => ({ id: typeof c.id === "string" ? c.id : generarId(), cuando: c.cuando as string, texto: c.texto as string }));

  return { insumos, recetas, parametros, cambios };
}

function hidratar() {
  if (hidratado || typeof window === "undefined") return;
  hidratado = true;
  try {
    const crudo = window.localStorage.getItem(COSTOS_STORAGE_KEY);
    if (!crudo) return;
    const datos = depurar(JSON.parse(crudo));
    if (datos) {
      estado = datos;
      notificar();
    }
  } catch {
    // Datos corruptos: se continúa con la semilla.
  }
}

/* -------------------------------- Acciones -------------------------------- */

const buscarInsumo = (id: string) => estado.insumos.find((i) => i.id === id);

export interface FilaPrecioImportada {
  insumo: string;
  fecha: string;
  precio: number;
  nota?: string;
}

export const costosStore = {
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },
  obtenerInstantanea(): DatosCostos {
    return estado;
  },
  obtenerInstantaneaServidor(): DatosCostos {
    return SEMILLA;
  },
  estaHidratado(): boolean {
    return hidratado;
  },
  estaHidratadoServidor(): boolean {
    return false;
  },

  /* ----- Precios (historial: nunca se pisa una fecha anterior) ----- */

  /**
   * Registra un precio nuevo. Los anteriores se conservan y siguen en el historial.
   * Si ya existía un precio con esa misma fecha, se corrige ese (un insumo no tiene dos precios el mismo día).
   */
  registrarPrecio(insumoId: string, fecha: string, precio: number, nota = ""): void {
    const insumo = buscarInsumo(insumoId);
    if (!insumo || !esFecha(fecha) || !Number.isFinite(precio) || precio <= 0) return;
    const existente = insumo.precios.find((p) => p.fecha === fecha);
    const precios = existente
      ? insumo.precios.map((p) => (p.id === existente.id ? { ...p, precio, nota: nota || p.nota } : p))
      : ordenarPrecios([...insumo.precios, { id: generarId(), fecha, precio, nota }]);
    establecer(
      { ...estado, insumos: estado.insumos.map((i) => (i.id === insumoId ? { ...i, precios } : i)) },
      `${insumo.nombre}: ${existente ? "corrige" : "nuevo"} precio ${precio.toFixed(4)} S/kg desde ${formatearFecha(fecha)}`,
    );
  },

  editarPrecio(insumoId: string, precioId: string, cambios: { fecha?: string; precio?: number; nota?: string }): void {
    const insumo = buscarInsumo(insumoId);
    if (!insumo) return;
    if (cambios.fecha !== undefined && !esFecha(cambios.fecha)) return;
    if (cambios.precio !== undefined && !(cambios.precio > 0)) return;
    const precios = ordenarPrecios(insumo.precios.map((p) => (p.id === precioId ? { ...p, ...cambios } : p)));
    establecer(
      { ...estado, insumos: estado.insumos.map((i) => (i.id === insumoId ? { ...i, precios } : i)) },
      `${insumo.nombre}: edita un precio del historial`,
    );
  },

  /** Borra una entrada del historial (rara vez; el último precio de un insumo no se puede borrar). */
  eliminarPrecio(insumoId: string, precioId: string): void {
    const insumo = buscarInsumo(insumoId);
    if (!insumo || insumo.precios.length <= 1) return;
    const borrado = insumo.precios.find((p) => p.id === precioId);
    establecer(
      {
        ...estado,
        insumos: estado.insumos.map((i) =>
          i.id === insumoId ? { ...i, precios: i.precios.filter((p) => p.id !== precioId) } : i,
        ),
      },
      `${insumo.nombre}: elimina el precio del ${borrado ? formatearFecha(borrado.fecha) : "historial"}`,
    );
  },

  importarPrecios(filas: FilaPrecioImportada[]): { precios: number; insumosNuevos: number } {
    let insumos = estado.insumos.map((i) => ({ ...i, precios: [...i.precios] }));
    let nuevos = 0;
    let total = 0;
    const clave = (t: string) => t.trim().toLowerCase();
    for (const fila of filas) {
      if (!fila.insumo.trim() || !esFecha(fila.fecha) || !(fila.precio > 0)) continue;
      let insumo = insumos.find((i) => clave(i.nombre) === clave(fila.insumo));
      if (!insumo) {
        insumo = { id: generarId(), nombre: fila.insumo.trim(), proveedor: "", archivado: false, precios: [] };
        insumos = [...insumos, insumo];
        nuevos += 1;
      }
      const existente = insumo.precios.find((p) => p.fecha === fila.fecha);
      if (existente) {
        existente.precio = fila.precio;
        if (fila.nota) existente.nota = fila.nota;
      } else {
        insumo.precios.push({ id: generarId(), fecha: fila.fecha, precio: fila.precio, nota: fila.nota ?? "" });
      }
      total += 1;
    }
    insumos = insumos.map((i) => ({ ...i, precios: ordenarPrecios(i.precios) }));
    if (total > 0) {
      establecer({ ...estado, insumos }, `Importación de precios desde Excel: ${total} precios, ${nuevos} insumos nuevos`);
    }
    return { precios: total, insumosNuevos: nuevos };
  },

  /* ----- Insumos ----- */

  crearInsumo(nombre: string, proveedor: string, fecha: string, precio: number): string | null {
    const limpio = nombre.trim();
    if (!limpio || !esFecha(fecha) || !(precio > 0)) return null;
    if (estado.insumos.some((i) => i.nombre.trim().toLowerCase() === limpio.toLowerCase())) return null;
    const nuevo: Insumo = {
      id: generarId(),
      nombre: limpio,
      proveedor: proveedor.trim(),
      archivado: false,
      precios: [{ id: generarId(), fecha, precio, nota: "" }],
    };
    establecer({ ...estado, insumos: [...estado.insumos, nuevo] }, `Nuevo insumo «${limpio}» a ${precio.toFixed(4)} S/kg`);
    return nuevo.id;
  },

  editarInsumo(id: string, cambios: { nombre?: string; proveedor?: string }): void {
    const insumo = buscarInsumo(id);
    if (!insumo) return;
    const nombre = cambios.nombre?.trim();
    if (nombre !== undefined && !nombre) return;
    establecer(
      {
        ...estado,
        insumos: estado.insumos.map((i) =>
          i.id === id ? { ...i, nombre: nombre ?? i.nombre, proveedor: cambios.proveedor?.trim() ?? i.proveedor } : i,
        ),
      },
      `Edita el insumo «${insumo.nombre}»`,
    );
  },

  /** Archivar oculta el insumo de los selectores, pero las recetas que ya lo usan siguen calculándose. */
  archivarInsumo(id: string, archivado: boolean): void {
    const insumo = buscarInsumo(id);
    if (!insumo) return;
    establecer(
      { ...estado, insumos: estado.insumos.map((i) => (i.id === id ? { ...i, archivado } : i)) },
      `${archivado ? "Archiva" : "Restaura"} el insumo «${insumo.nombre}»`,
    );
  },

  /* ----- Recetas ----- */

  guardarReceta(receta: Omit<Receta, "id" | "archivada"> & { id?: string }): string {
    const existente = receta.id ? estado.recetas.find((r) => r.id === receta.id) : undefined;
    if (existente) {
      establecer(
        { ...estado, recetas: estado.recetas.map((r) => (r.id === existente.id ? { ...existente, ...receta, id: existente.id } : r)) },
        `Edita la receta «${receta.nombre}» (grado ${receta.grado})`,
      );
      return existente.id;
    }
    const id = generarId();
    establecer(
      { ...estado, recetas: [...estado.recetas, { ...receta, id, archivada: false }] },
      `Nueva receta «${receta.nombre}» (grado ${receta.grado})`,
    );
    return id;
  },

  duplicarReceta(id: string): string | null {
    const origen = estado.recetas.find((r) => r.id === id);
    if (!origen) return null;
    const nueva: Receta = {
      ...origen,
      id: generarId(),
      nombre: `${origen.nombre} (copia)`,
      archivada: false,
      lineas: origen.lineas.map((l) => ({ ...l })),
    };
    establecer({ ...estado, recetas: [...estado.recetas, nueva] }, `Duplica la receta «${origen.nombre}»`);
    return nueva.id;
  },

  archivarReceta(id: string, archivada: boolean): void {
    const receta = estado.recetas.find((r) => r.id === id);
    if (!receta) return;
    establecer(
      { ...estado, recetas: estado.recetas.map((r) => (r.id === id ? { ...r, archivada } : r)) },
      `${archivada ? "Archiva" : "Restaura"} la receta «${receta.nombre}»`,
    );
  },

  eliminarReceta(id: string): void {
    const receta = estado.recetas.find((r) => r.id === id);
    if (!receta) return;
    establecer({ ...estado, recetas: estado.recetas.filter((r) => r.id !== id) }, `Elimina la receta «${receta.nombre}»`);
  },

  /* ----- Parámetros y mantenimiento ----- */

  actualizarParametros(parametros: ParametrosCosto): void {
    if (!(parametros.kgPorGalon > 0) || parametros.gas < 0 || parametros.mo < 0) return;
    establecer(
      { ...estado, parametros },
      `Parámetros: gas ${parametros.gas.toFixed(5)}, MO ${parametros.mo.toFixed(5)}, ${parametros.kgPorGalon} kg/gal`,
    );
  },

  restaurar(): void {
    estado = datosIniciales();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(COSTOS_STORAGE_KEY, JSON.stringify(estado));
      } catch {
        // sin persistencia
      }
    }
    notificar();
  },
};

export type { Grado };
