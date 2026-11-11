/**
 * Persistencia en el servidor (base de datos Neon, vía `/api/datos`) para los stores de la app.
 *
 * Cada store se «enlaza» a un documento por su clave: al cargar recibe lo guardado y, cuando cambia,
 * llama a `guardar` (con espera de unos instantes para agrupar ediciones seguidas). Detalles:
 *
 * - Nunca se guarda nada antes de haber leído la base; así un fallo de conexión no pisa los datos
 *   reales con los de ejemplo.
 * - Si otra persona guardó el mismo documento antes, el servidor responde 409 y se recarga su versión.
 * - Cada 30 s y al volver a la pestaña se revisan los cambios de otras personas.
 * - **Migración**: si la base no tiene el documento pero este navegador sí lo tiene en `localStorage`
 *   (versión anterior de la app), se sube una sola vez.
 */

export type EstadoSync = "cargando" | "sincronizado" | "guardando" | "sin-conexion" | "no-configurada" | "conflicto";

export interface InfoSync {
  estado: EstadoSync;
  /** Momento del último guardado o lectura correcta. */
  ultimaVez: number | null;
}

const ESPERA_GUARDADO_MS = 700;
const REINTENTO_MS = 5000;
const REVISION_MS = 30000;

type Aplicar = (valor: unknown) => void;
type Documentos = Record<string, { valor: unknown; version: number }>;

const enlaces = new Map<string, Aplicar>();
/** Versión que el servidor tenía la última vez que supimos de cada documento. */
const versiones = new Map<string, number>();
const pendientes = new Map<string, unknown>();
const temporizadores = new Map<string, ReturnType<typeof setTimeout>>();
const enVuelo = new Set<string>();
const migrados = new Set<string>();

let ultimosDocumentos: Documentos = {};
let cargado = false;
let cargaInicial: Promise<void> | null = null;
let vigilando = false;

/* ------------------------------ Estado visible ------------------------------ */

let info: InfoSync = { estado: "cargando", ultimaVez: null };
const oyentes = new Set<() => void>();
const INFO_SERVIDOR: InfoSync = { estado: "cargando", ultimaVez: null };

function fijar(estado: EstadoSync, conMarca = false) {
  if (info.estado === estado && !conMarca) return;
  info = { estado, ultimaVez: conMarca ? Date.now() : info.ultimaVez };
  for (const oyente of oyentes) oyente();
}

export const sincronizacion = {
  suscribir(oyente: () => void): () => void {
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },
  obtenerInstantanea: (): InfoSync => info,
  obtenerInstantaneaServidor: (): InfoSync => INFO_SERVIDOR,
  /** Vuelve a intentar la conexión (botón «Reintentar»). */
  async reintentar(): Promise<void> {
    await traer();
    reintentarPendientes();
  },
};

/* --------------------------------- Lectura --------------------------------- */

async function pedirDocumentos(): Promise<Documentos> {
  let respuesta: Response;
  try {
    respuesta = await fetch("/api/datos", { cache: "no-store" });
  } catch {
    fijar("sin-conexion");
    throw new Error("sin-conexion");
  }
  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
    fijar(cuerpo.error === "base-no-configurada" ? "no-configurada" : "sin-conexion");
    throw new Error(cuerpo.error ?? "error");
  }
  const { documentos } = (await respuesta.json()) as { documentos: Documentos };
  return documentos ?? {};
}

function leerLocalAnterior(clave: string): unknown {
  try {
    const crudo = window.localStorage.getItem(clave);
    return crudo ? JSON.parse(crudo) : undefined;
  } catch {
    return undefined;
  }
}

/** Entrega al store lo que hay en la base para su clave (o sube lo que tenía en el navegador). */
function procesarClave(clave: string, documentos: Documentos) {
  const aplicar = enlaces.get(clave);
  if (!aplicar) return;
  const doc = documentos[clave];
  if (doc) {
    if (versiones.get(clave) !== doc.version) {
      versiones.set(clave, doc.version);
      aplicar(doc.valor);
    }
    return;
  }
  if (migrados.has(clave)) return;
  migrados.add(clave);
  const anterior = leerLocalAnterior(clave);
  if (anterior !== undefined) {
    aplicar(anterior);
    programar(clave, anterior);
  }
}

/** Lee todo de la base y avisa a los stores enlazados. Devuelve `false` si no hay conexión. */
async function traer(): Promise<boolean> {
  try {
    ultimosDocumentos = await pedirDocumentos();
  } catch {
    return false;
  }
  cargado = true;
  for (const clave of enlaces.keys()) procesarClave(clave, ultimosDocumentos);
  if (pendientes.size === 0 && enVuelo.size === 0) fijar("sincronizado", true);
  return true;
}

/**
 * Enlaza un store con su documento. La promesa se resuelve cuando ya se aplicó lo guardado
 * (o cuando se comprobó que no hay conexión): el store pasa entonces a «listo».
 */
export async function enlazarDocumento(clave: string, aplicar: Aplicar): Promise<void> {
  enlaces.set(clave, aplicar);
  vigilar();
  cargaInicial ??= traer().then(() => undefined);
  await cargaInicial;
  if (cargado) procesarClave(clave, ultimosDocumentos);
  else cargaInicial = null; // sin conexión: la próxima revisión vuelve a intentarlo
}

/* --------------------------------- Escritura --------------------------------- */

/** Pide guardar el valor actual de un documento. Se agrupa con las ediciones que lleguen enseguida. */
export function guardar(clave: string, valor: unknown): void {
  if (typeof window === "undefined" || !cargado) return;
  programar(clave, valor);
}

function programar(clave: string, valor: unknown, espera = ESPERA_GUARDADO_MS) {
  pendientes.set(clave, valor);
  fijar("guardando");
  const previo = temporizadores.get(clave);
  if (previo) clearTimeout(previo);
  temporizadores.set(clave, setTimeout(() => void vaciar(clave), espera));
}

async function vaciar(clave: string, alSalir = false): Promise<void> {
  temporizadores.delete(clave);
  if (enVuelo.has(clave)) return; // al terminar el envío en curso se reprograma
  const valor = pendientes.get(clave);
  if (valor === undefined) return;
  pendientes.delete(clave);
  enVuelo.add(clave);

  try {
    const respuesta = await fetch(`/api/datos/${encodeURIComponent(clave)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor, versionBase: versiones.get(clave) ?? 0 }),
      keepalive: alSalir,
    });

    if (respuesta.ok) {
      versiones.set(clave, ((await respuesta.json()) as { version: number }).version);
    } else if (respuesta.status === 409) {
      const { actual } = (await respuesta.json()) as { actual: { valor: unknown; version: number } | null };
      if (actual) {
        // Otra persona guardó antes: gana su versión y se descarta lo pendiente de este documento.
        pendientes.delete(clave);
        versiones.set(clave, actual.version);
        enlaces.get(clave)?.(actual.valor);
        fijar("conflicto", true);
      } else {
        versiones.delete(clave);
        if (!pendientes.has(clave)) pendientes.set(clave, valor);
      }
    } else {
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
      throw new Error(cuerpo.error ?? "error");
    }
  } catch {
    if (!pendientes.has(clave)) pendientes.set(clave, valor);
    fijar("sin-conexion");
    temporizadores.set(clave, setTimeout(() => void vaciar(clave), REINTENTO_MS));
    enVuelo.delete(clave);
    return;
  }

  enVuelo.delete(clave);
  if (pendientes.has(clave)) programar(clave, pendientes.get(clave), 0);
  else if (pendientes.size === 0 && enVuelo.size === 0 && info.estado !== "conflicto") fijar("sincronizado", true);
}

function reintentarPendientes() {
  for (const clave of pendientes.keys()) void vaciar(clave);
}

/* ------------------------- Cambios de otras personas ------------------------- */

function vigilar() {
  if (vigilando || typeof window === "undefined") return;
  vigilando = true;

  const revisar = () => {
    if (enVuelo.size > 0 || pendientes.size > 0) return;
    void traer();
  };
  window.setInterval(() => {
    if (document.visibilityState === "visible") revisar();
  }, REVISION_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") revisar();
    // Al ocultar o cerrar la pestaña se envía de inmediato lo que haya pendiente.
    else for (const clave of [...pendientes.keys()]) void vaciar(clave, true);
  });
  window.addEventListener("pagehide", () => {
    for (const clave of [...pendientes.keys()]) void vaciar(clave, true);
  });
}

/** Solo para pruebas. */
export function _reiniciarPersistenciaParaPruebas(): void {
  enlaces.clear();
  versiones.clear();
  pendientes.clear();
  for (const t of temporizadores.values()) clearTimeout(t);
  temporizadores.clear();
  enVuelo.clear();
  migrados.clear();
  ultimosDocumentos = {};
  cargado = false;
  cargaInicial = null;
  info = { estado: "cargando", ultimaVez: null };
}
