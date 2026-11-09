const dos = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tres = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const entero = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });

/** Toneladas: 2 decimales, 3 cuando la cifra es menor a 0,1 para que no parezca cero. */
export function formatearTn(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "–";
  if (Math.abs(valor) < 0.005) return "0,00";
  return Math.abs(valor) < 0.1 ? tres.format(valor) : dos.format(valor);
}

export function formatearSoles(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "–";
  return `S/ ${entero.format(valor)}`;
}

export function formatearDias(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "–";
  return entero.format(Math.round(valor));
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** «12 nov 2026» */
export function formatearFechaLarga(fecha: Date): string {
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

/** «12 nov» */
export function formatearFechaCorta(fecha: Date): string {
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
}

/** «2026-11-05» → «5 nov 2026» */
export function formatearFechaIso(iso: string): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return anio && mes && dia ? `${dia} ${MESES[mes - 1]} ${anio}` : iso;
}
