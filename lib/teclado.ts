import type { KeyboardEvent } from "react";

/**
 * Navegación con teclado de un `role="tablist"` (patrón WAI-ARIA): flechas izquierda/derecha
 * (y arriba/abajo) recorren las pestañas de forma circular, Inicio/Fin saltan a la primera/última.
 * La pestaña a la que se llega se activa al instante. Se usa en el `onKeyDown` del contenedor,
 * junto con `tabIndex={activa ? 0 : -1}` en cada pestaña.
 */
export function navegarPestanas(evento: KeyboardEvent<HTMLElement>): void {
  const pestanas = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
  const actual = pestanas.indexOf(document.activeElement as HTMLElement);
  if (pestanas.length === 0 || actual === -1) return;

  let destino = actual;
  switch (evento.key) {
    case "ArrowRight":
    case "ArrowDown":
      destino = (actual + 1) % pestanas.length;
      break;
    case "ArrowLeft":
    case "ArrowUp":
      destino = (actual - 1 + pestanas.length) % pestanas.length;
      break;
    case "Home":
      destino = 0;
      break;
    case "End":
      destino = pestanas.length - 1;
      break;
    default:
      return;
  }
  evento.preventDefault();
  pestanas[destino].focus();
  pestanas[destino].click();
}
