/**
 * Historial para deshacer: guarda las últimas versiones del estado de un store.
 * Los estados son inmutables, así que cada copia comparte casi todo con la anterior y es barata.
 */
export interface Historial<T> {
  /** Guarda la versión que se va a reemplazar. */
  registrar: (anterior: T) => void;
  /** Saca la última versión guardada, o `undefined` si no hay nada que deshacer. */
  deshacer: () => T | undefined;
  cantidad: () => number;
  vaciar: () => void;
}

export function crearHistorial<T>(maximo = 50): Historial<T> {
  let pila: T[] = [];
  return {
    registrar(anterior) {
      pila.push(anterior);
      if (pila.length > maximo) pila = pila.slice(pila.length - maximo);
    },
    deshacer: () => pila.pop(),
    cantidad: () => pila.length,
    vaciar() {
      pila = [];
    },
  };
}

/**
 * ¿El evento de teclado es «Ctrl/Cmd + Z» fuera de un campo de texto? Dentro de un campo, Ctrl+Z
 * debe seguir deshaciendo lo escrito, y con un cuadro de diálogo abierto no se toca el fondo.
 */
export function esAtajoDeshacer(evento: KeyboardEvent): boolean {
  if (!(evento.ctrlKey || evento.metaKey) || evento.shiftKey || evento.altKey) return false;
  if (evento.key.toLowerCase() !== "z") return false;
  const destino = evento.target as HTMLElement | null;
  if (destino) {
    const etiqueta = destino.tagName;
    if (etiqueta === "INPUT" || etiqueta === "TEXTAREA" || etiqueta === "SELECT" || destino.isContentEditable) return false;
  }
  return !document.querySelector('[role="dialog"]');
}
