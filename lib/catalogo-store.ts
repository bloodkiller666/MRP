import { CAMPOS_TEXTO, CATALOGO_SEMILLA, CATALOGO_STORAGE_KEY } from "./constants";
import { enlazarDocumento, guardar } from "./persistencia";
import type { CampoTextoMRP, CatalogoMRP } from "./types";
import { normalizarTexto } from "./utils";

/**
 * Catálogo global de valores por campo (store externo).
 *
 * Sigue el mismo patrón que `lib/mrp-store.ts`: el estado vive fuera de React,
 * se persiste en `localStorage` en cada cambio y los componentes se suscriben
 * con `useSyncExternalStore`. Así, cuando el usuario escribe un valor inédito
 * (una refinería nueva, un propietario nuevo…), este queda disponible de
 * inmediato en los filtros y en el siguiente registro **sin recargar la página**.
 */

/** Estado en memoria: copia profunda de la semilla para no mutar las constantes. */
let estado: CatalogoMRP = clonar(CATALOGO_SEMILLA);

/** Evita enlazar con la base de datos más de una vez por sesión de navegador. */
let iniciado = false;

const oyentes = new Set<() => void>();

/** Copia superficial por campo (evita compartir los arrays con las constantes). */
function clonar(catalogo: CatalogoMRP): CatalogoMRP {
  const copia = {} as CatalogoMRP;
  for (const campo of CAMPOS_TEXTO) copia[campo] = [...(catalogo[campo] ?? [])];
  return copia;
}

/** Normaliza un valor antes de guardarlo o compararlo. */
function limpiar(valor: unknown): string {
  if (typeof valor !== "string") return "";
  return valor.replace(/\s+/g, " ").trim();
}

function notificar() {
  for (const oyente of oyentes) oyente();
}

function persistir() {
  guardar(CATALOGO_STORAGE_KEY, estado);
}

/** Único punto de escritura: reemplaza, persiste y notifica. */
function establecer(siguiente: CatalogoMRP) {
  estado = siguiente;
  persistir();
  notificar();
}

/**
 * Aplica lo que llega de la base de datos.
 *
 * Lo guardado se **une** a la semilla, de forma que los catálogos base
 * (departamentos, refinerías, grupos línea, UM) nunca desaparecen aunque lo
 * guardado venga incompleto o de una versión anterior.
 */
function aplicarRemoto(parseado: unknown) {
  try {
    if (!parseado || typeof parseado !== "object" || Array.isArray(parseado)) return;

    const combinado = clonar(CATALOGO_SEMILLA);
    for (const campo of CAMPOS_TEXTO) {
      const guardados = (parseado as Record<string, unknown>)[campo];
      if (!Array.isArray(guardados)) continue;

      for (const bruto of guardados) {
        const valor = limpiar(bruto);
        if (!valor) continue;
        if (combinado[campo].some((actual) => normalizarTexto(actual) === normalizarTexto(valor))) {
          continue;
        }
        combinado[campo].push(valor);
      }
    }

    estado = combinado;
    notificar();
  } catch {
    // Datos corruptos: se continúa con la semilla.
  }
}

/** Se enlaza con la base la primera vez que un componente se suscribe. */
function hidratar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  void enlazarDocumento(CATALOGO_STORAGE_KEY, aplicarRemoto);
}

export const catalogoStore = {
  /** Suscribe un componente a los cambios (contrato de `useSyncExternalStore`). */
  suscribir(oyente: () => void): () => void {
    hidratar();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },

  /** Instantánea del catálogo en el cliente. */
  obtenerInstantanea(): CatalogoMRP {
    return estado;
  },

  /** Instantánea usada en el servidor y durante la hidratación. */
  obtenerInstantaneaServidor(): CatalogoMRP {
    return CATALOGO_SEMILLA;
  },

  /** Agrega un valor al catálogo de un campo. Devuelve `true` si era inédito. */
  registrar(campo: CampoTextoMRP, valor: string): boolean {
    const limpio = limpiar(valor);
    if (!limpio) return false;

    const actuales = estado[campo] ?? [];
    if (actuales.some((actual) => normalizarTexto(actual) === normalizarTexto(limpio))) return false;

    establecer({ ...estado, [campo]: [...actuales, limpio] });
    return true;
  },

  /**
   * Registra de golpe todos los valores de texto de un registro.
   * Se usa al guardar un alta o una edición desde el formulario.
   */
  registrarVarios(valores: Partial<Record<CampoTextoMRP, string>>): void {
    const siguiente = clonar(estado);
    let cambiado = false;

    for (const campo of CAMPOS_TEXTO) {
      const limpio = limpiar(valores[campo]);
      if (!limpio) continue;

      const actuales = siguiente[campo];
      if (actuales.some((actual) => normalizarTexto(actual) === normalizarTexto(limpio))) continue;

      actuales.push(limpio);
      cambiado = true;
    }

    if (cambiado) establecer(siguiente);
  },

  /** Devuelve el catálogo a su semilla (lo usan los datos de ejemplo). */
  restaurar(): void {
    establecer(clonar(CATALOGO_SEMILLA));
  },
};
