import { STORAGE_KEY } from "./constants";
import { REGISTROS_MOCK } from "./mock-data";
import type { CampoTextoMRP, MesKey, RegistroMRP } from "./types";
import { generarId } from "./utils";

/**
 * Store del MRP basado en un "external store" de React.
 *
 * Se implementa fuera de los componentes para que `localStorage` se lea una
 * sola vez (evitando el patrón `useEffect` + `setState` de hidratación) y para
 * que el estado sobreviva a cualquier re-montaje de la UI. Los componentes se
 * suscriben con `useSyncExternalStore` desde `hooks/use-mrp-store.ts`.
 */

/** Estado en memoria. Empieza con los datos mock para que el SSR sea estable. */
let estado: RegistroMRP[] = REGISTROS_MOCK;

/** Evita leer `localStorage` más de una vez por sesión de navegador. */
let hidratado = false;

const oyentes = new Set<() => void>();

/** Avisa a todos los suscriptores que el estado cambió. */
function notificar() {
  for (const oyente of oyentes) oyente();
}

/** Guarda el estado actual en `localStorage` (silencioso si falla). */
function persistir() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch {
    // Cuota excedida o modo privado: la app sigue funcionando en memoria.
  }
}

/**
 * Reemplaza el estado y notifica. Único punto de escritura, de modo que
 * cualquier cambio se persiste automáticamente.
 */
function establecer(siguiente: RegistroMRP[]) {
  estado = siguiente;
  persistir();
  notificar();
}

function esObjeto(valor: unknown): valor is Partial<RegistroMRP> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Completa los campos que pudieran faltar en datos guardados por versiones anteriores. */
function normalizar(registro: Partial<RegistroMRP>): RegistroMRP {
  return {
    id: registro.id ?? generarId(),
    propietario: registro.propietario ?? "",
    departamento: registro.departamento ?? "",
    cuenta: registro.cuenta ?? "",
    proyecto: registro.proyecto ?? "",
    detalleProducto: registro.detalleProducto ?? "",
    grupoLinea: registro.grupoLinea ?? "",
    refineria: registro.refineria ?? "",
    unidadMedida: registro.unidadMedida ?? "",
    tipoAplicacion: registro.tipoAplicacion ?? "",
    proyecciones: registro.proyecciones ?? {},
    reales: registro.reales ?? {},
  };
}

/** Carga la copia persistida la primera vez que un componente se suscribe. */
function hidratar() {
  if (hidratado || typeof window === "undefined") return;
  hidratado = true;

  try {
    const crudo = window.localStorage.getItem(STORAGE_KEY);
    if (!crudo) return;

    const parseado: unknown = JSON.parse(crudo);
    // Una lista vacía es un estado válido (el usuario vació la tabla).
    if (Array.isArray(parseado)) {
      estado = parseado.filter(esObjeto).map(normalizar);
      notificar();
    }
  } catch {
    // Datos corruptos: se continúa con los datos mock.
  }
}

export const mrpStore = {
  /** Suscribe un componente a los cambios (contrato de `useSyncExternalStore`). */
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },

  /** Instantánea del estado en el cliente. */
  obtenerInstantanea(): RegistroMRP[] {
    return estado;
  },

  /** Instantánea usada en el servidor y durante la hidratación. */
  obtenerInstantaneaServidor(): RegistroMRP[] {
    return REGISTROS_MOCK;
  },

  /** `true` cuando ya se intentó leer `localStorage`. */
  estaHidratado(): boolean {
    return hidratado;
  },

  /** En el servidor todavía no hay nada persistido. */
  estaHidratadoServidor(): boolean {
    return false;
  },

  /**
   * Anexa registros al final de la lista (**append**).
   * Usado por la importación de Excel: nunca reemplaza datos existentes.
   */
  importar(nuevos: RegistroMRP[]): number {
    establecer([...estado, ...nuevos]);
    return nuevos.length;
  },

  /** Crea un registro a partir de los datos del formulario. */
  agregar(datos: Omit<RegistroMRP, "id">): RegistroMRP {
    const nuevo: RegistroMRP = { ...datos, id: generarId() };
    establecer([...estado, nuevo]);
    return nuevo;
  },

  /** Reemplaza un registro completo (edición desde el formulario). */
  actualizar(registro: RegistroMRP): void {
    establecer(estado.map((actual) => (actual.id === registro.id ? registro : actual)));
  },

  /** Edición en celda de un campo de texto. */
  actualizarCampo(id: string, campo: CampoTextoMRP, valor: string): void {
    establecer(estado.map((registro) => (registro.id === id ? { ...registro, [campo]: valor } : registro)));
  },

  /** Edición en celda del pronóstico de un mes. `undefined` limpia la celda. */
  actualizarProyeccion(id: string, mes: MesKey, valor?: number): void {
    establecer(
      estado.map((registro) => {
        if (registro.id !== id) return registro;
        return { ...registro, proyecciones: { ...registro.proyecciones, [mes]: valor } };
      }),
    );
  },

  /** Edición en celda del despacho real (o avance) de un mes. `undefined` lo limpia. */
  actualizarReal(id: string, mes: MesKey, valor?: number): void {
    establecer(
      estado.map((registro) => {
        if (registro.id !== id) return registro;
        return { ...registro, reales: { ...registro.reales, [mes]: valor } };
      }),
    );
  },

  /** Elimina un registro por `id`. */
  eliminar(id: string): void {
    establecer(estado.filter((registro) => registro.id !== id));
  },

  /** Restaura los datos de ejemplo (descarta los cambios locales). */
  restaurar(): void {
    establecer(REGISTROS_MOCK);
  },

  /** Vacía por completo la lista de registros. */
  vaciar(): void {
    establecer([]);
  },
};
