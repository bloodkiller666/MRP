import { TEMA_STORAGE_KEY } from "./constants";
import type { Tema } from "./types";

/**
 * Tema visual (claro / oscuro) como store externo.
 *
 * El tema se guarda en `localStorage` y se aplica como clase `dark` en `<html>`,
 * que es lo que Tailwind necesita cuando se declara
 * `@custom-variant dark (&:where(.dark, .dark *))`.
 *
 * Para que no haya parpadeo, `app/layout.tsx` inyecta un script en línea que
 * aplica la clase **antes del primer pintado**; este store sólo mantiene el
 * estado de React sincronizado con esa misma fuente de verdad.
 */

const TEMA_POR_DEFECTO: Tema = "claro";

let estado: Tema = TEMA_POR_DEFECTO;
let hidratado = false;

const oyentes = new Set<() => void>();

function esTema(valor: unknown): valor is Tema {
  return valor === "claro" || valor === "oscuro";
}

/** Aplica el tema al `<html>`: clase `dark` (Tailwind) + `color-scheme` nativo. */
export function aplicarTema(tema: Tema): void {
  if (typeof document === "undefined") return;
  const raiz = document.documentElement;
  raiz.classList.toggle("dark", tema === "oscuro");
  raiz.style.colorScheme = tema === "oscuro" ? "dark" : "light";
}

/** Lee el tema persistido; `null` si no hay ninguna preferencia guardada. */
export function leerTemaGuardado(): Tema | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(TEMA_STORAGE_KEY);
    return esTema(crudo) ? crudo : null;
  } catch {
    return null;
  }
}

function notificar() {
  for (const oyente of oyentes) oyente();
}

function persistir(tema: Tema) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TEMA_STORAGE_KEY, tema);
  } catch {
    // Modo privado: el tema sigue aplicándose en memoria.
  }
}

/** Único punto de escritura: persistir, aplicar al DOM y notificar. */
function establecer(tema: Tema) {
  estado = tema;
  persistir(tema);
  aplicarTema(tema);
  notificar();
}

/** Recupera la preferencia guardada (una sola lectura por sesión de navegador). */
function hidratar() {
  if (hidratado || typeof window === "undefined") return;
  hidratado = true;

  const guardado = leerTemaGuardado();
  if (guardado && guardado !== estado) {
    estado = guardado;
    notificar();
  }
}

export const temaStore = {
  /**
   * Suscribe un componente a los cambios.
   *
   * Además de hidratar, vuelve a aplicar el tema al DOM en cada montaje: en
   * desarrollo, React (Strict Mode) remonta los componentes y restablece los
   * atributos de `<html>`, por lo que esta reaplicación evita perder la clase
   * `dark`. En producción es un no-op, ya que el script inline hizo el trabajo.
   */
  suscribir(oyente: () => void): () => void {
    hidratar();
    aplicarTema(estado);
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },

  /** Instantánea del tema en el cliente. */
  obtenerInstantanea(): Tema {
    return estado;
  },

  /** Instantánea usada en el servidor y durante la hidratación. */
  obtenerInstantaneaServidor(): Tema {
    return TEMA_POR_DEFECTO;
  },

  /** Fija un tema concreto. */
  establecer,

  /** Alterna entre claro y oscuro. */
  alternar(): void {
    establecer(estado === "oscuro" ? "claro" : "oscuro");
  },
};

/** Script que aplica el tema antes del primer pintado (se inyecta en `<head>`). */
export const SCRIPT_TEMA_INICIAL =
  `(function(){try{var t=localStorage.getItem(${JSON.stringify(TEMA_STORAGE_KEY)});` +
  `if(t==="oscuro"){document.documentElement.classList.add("dark");` +
  `document.documentElement.style.colorScheme="dark";}}catch(e){}})()`;
