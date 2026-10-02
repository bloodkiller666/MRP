import { COLUMNAS_OCULTABLES, COLUMNAS_STORAGE_KEY } from "./constants";
import type { ColumnaTabla } from "./types";

/**
 * Visibilidad de las columnas de la tabla (store externo).
 *
 * Guarda **qué columnas están ocultas**, no cuáles se ven: así, si en el futuro
 * se agrega una columna nueva, aparece visible por defecto.
 *
 * Importante: esto es puramente de presentación. Los totales (`totalFila`,
 * `totalesPorMes`, `totalGeneral`) se calculan siempre sobre **todas** las
 * columnas, por lo que ocultar un mes nunca altera el total de la fila ni el
 * total general.
 */

/** Claves válidas, para descartar datos corruptos o de versiones anteriores. */
const CLAVES_VALIDAS = new Set<string>(COLUMNAS_OCULTABLES);

/** Instantánea inmutable del servidor (evita crear un array en cada render). */
const COLUMNAS_OCULTAS_VACIAS: ColumnaTabla[] = [];

let estado: ColumnaTabla[] = [];
let hidratado = false;

const oyentes = new Set<() => void>();

/** Normaliza una lista arbitraria: solo claves válidas, sin duplicados. */
function depurar(valores: unknown): ColumnaTabla[] {
  if (!Array.isArray(valores)) return [];

  const limpias: ColumnaTabla[] = [];
  for (const valor of valores) {
    if (typeof valor === "string" && CLAVES_VALIDAS.has(valor) && !limpias.includes(valor as ColumnaTabla)) {
      limpias.push(valor as ColumnaTabla);
    }
  }
  return limpias;
}

function notificar() {
  for (const oyente of oyentes) oyente();
}

function persistir() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLUMNAS_STORAGE_KEY, JSON.stringify(estado));
  } catch {
    // Modo privado: la preferencia sigue aplicándose en memoria.
  }
}

/** Único punto de escritura: reemplaza, persiste y notifica. */
function establecer(siguiente: ColumnaTabla[]) {
  estado = siguiente;
  persistir();
  notificar();
}

/** Recupera las columnas ocultas guardadas (una lectura por sesión). */
function hidratar() {
  if (hidratado || typeof window === "undefined") return;
  hidratado = true;

  try {
    const crudo = window.localStorage.getItem(COLUMNAS_STORAGE_KEY);
    if (!crudo) return;

    const ocultas = depurar(JSON.parse(crudo));
    if (ocultas.length > 0) {
      estado = ocultas;
      notificar();
    }
  } catch {
    // Datos corruptos: se continúa con todas las columnas visibles.
  }
}

export const columnasStore = {
  /** Suscribe un componente a los cambios (contrato de `useSyncExternalStore`). */
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },

  /** Instantánea de las columnas ocultas en el cliente. */
  obtenerInstantanea(): ColumnaTabla[] {
    return estado;
  },

  /** En el servidor todas las columnas se muestran. */
  obtenerInstantaneaServidor(): ColumnaTabla[] {
    return COLUMNAS_OCULTAS_VACIAS;
  },

  /** Muestra u oculta una columna concreta. */
  alternar(columna: ColumnaTabla): void {
    if (!CLAVES_VALIDAS.has(columna)) return;

    establecer(
      estado.includes(columna)
        ? estado.filter((actual) => actual !== columna)
        : [...estado, columna],
    );
  },

  /** Fija la lista completa de columnas ocultas (normalizando la entrada). */
  establecerOcultas(columnas: unknown): void {
    establecer(depurar(columnas));
  },

  /** Vuelve a mostrar todas las columnas. */
  mostrarTodas(): void {
    establecer([]);
  },
};
