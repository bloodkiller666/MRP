# MRP · Planificación de Requerimientos de Materiales

Aplicación web interactiva para la **gestión y proyección mensual de insumos asfálticos**
(PEN 60/70, PEN 120/150, EMULTEC, BETUTEC, etc.) por propietario, departamento, cuenta,
grupo línea y refinería.

Por ahora **no hay base de datos**: todo el estado vive en memoria del navegador (React)
y se persiste automáticamente en `localStorage`.

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS v4 + `lucide-react` |
| Excel | `xlsx` (SheetJS 0.20.3) |
| PDF | `jspdf` + `jspdf-autotable` |
| Estado | Hooks de React + store externo (`useSyncExternalStore`) |
| Paquetes | **pnpm** (`packageManager` fijado en `package.json`) |

## Puesta en marcha

> Este proyecto usa **pnpm**, no npm: ver [Seguridad de dependencias](#seguridad-de-dependencias).

```bash
pnpm install
pnpm dev         # http://localhost:3000
pnpm build       # build de producción
pnpm typecheck   # tsc --noEmit
pnpm lint
```

## Funcionalidades

1. **Tabla principal estilo Excel moderno** (`components/MRPTable.tsx`)
   - Edición en celda con **doble clic** (o `Enter`/`F2` con la celda enfocada):
     `Enter` y `Tab` guardan, `Esc` cancela.
   - Filtros por columna (`Propietario`, `Departamento`, `Grupo Línea`, `Refinería`,
     `Detalle Producto`) y **buscador global** que ignora mayúsculas y tildes.
   - Cabecera y fila de totales **fijas** al hacer scroll; total por fila y por mes.
   - **Columnas ocultables** (`components/ColumnasSelector.tsx`): el selector
     “Columnas” permite ocultar/mostrar campos y meses. Es puramente visual: el
     total por fila, los totales por mes y el total general se siguen calculando
     con **todas** las columnas, así que ocultar un mes nunca cambia una cifra.
     La preferencia se guarda en `localStorage`.
2. **Tarjetas resumen** (`components/SummaryCards.tsx`): total por mes (Ago–Dic) y
   desglose por unidad de medida (GLN / KG / TM).
3. **Importación de Excel** (`components/ExcelImportModal.tsx` + `lib/excel.ts`)
   - Lee `.xlsx`, `.xls` y `.csv`, con arrastrar y soltar.
   - Mapea encabezados automáticamente (`Propietario`, `Departamento`, `Cuenta`,
     `Proyecto`, `Detalle Producto`, `Grupo Línea`, `Refinería`, `UM`, `Ago`, `Set`,
     `Oct`, `Nov`, `Dic`) tolerando variantes como `Dpto.`, `Und.`, `Proyección Agosto`
     o `Set-26`, y detecta títulos por encima de la tabla.
   - Ignora filas vacías y filas de `TOTAL`/`SUBTOTAL`, y descarta cada fila sin
     producto ni cuenta.
   - **Anexa (append) siempre**: nunca sobrescribe ni borra los datos existentes.
     Cada fila importada recibe un `id` único.
   - Previsualización de filas y del mapeo detectado antes de confirmar.
4. **Exportación** (`Exportar Excel`): descarga la **vista actual** (con filtros
   aplicados) en un `.xlsx` con hoja `MRP` (datos + fila de totales) y hoja
   `Resumen` (por grupo línea, refinería y UM).
5. **Reporte rápido** (`components/ReportModal.tsx`): KPIs, barras por mes, por
   grupo línea, por refinería (PETROPERU vs. IMPORTADO) y por unidad de medida.
6. **Alta y edición manual** (`components/RegistroFormModal.tsx`)
   - Modal en tres secciones: **metadatos**, **clasificación** y **cantidades
     mensuales** (Ago–Dic), con suma del borrador en vivo.
   - Validación de campos requeridos (`Detalle Producto`, `UM`) y de que cada mes
     sea numérico; los errores se marcan bajo el campo correspondiente.
   - Botón **“Guardar y Anexar”** para sumar el registro al final de la lista.
7. **Catálogo dinámico de valores** (`lib/catalogo-store.ts`)
   - Cada selector permite **elegir una opción existente** o **escribir una nueva**
     mediante la opción *“＋ Agregar nuevo valor…”* (`components/ui/SelectorConNuevo.tsx`).
   - Al guardar, los valores inéditos pasan al **catálogo global** (persistido en
     `localStorage`), por lo que aparecen de inmediato en los filtros y en el
     siguiente registro **sin recargar la página**.
   - Los filtros y el formulario comparten siempre la misma lista: catálogo global
     ∪ valores presentes en la tabla.
8. **Modo oscuro** (`components/ThemeToggle.tsx`)
   - Interruptor en la barra superior; la preferencia se guarda en `localStorage`.
   - La tabla, las tarjetas, las celdas editables y los modales tienen contraste
     propio vía clases `dark:` (variante de clase, no `prefers-color-scheme`).
9. **Exportación a PDF** (`lib/pdfExport.ts`)
   - Encabezado formal *“Reporte de Proyección de Materiales (MRP)”*, fecha de
     generación y los filtros activos.
   - Tabla de la **vista actual** (respeta filtros y búsqueda) en orientación
     **horizontal (landscape)**.
   - Bloque de cierre con los **totales globales por mes** (Ago–Dic) y por
     **Unidad de Medida**, más el folio “Página X de Y”.
10. **Datos de ejemplo**: 8 registros de insumos asfálticos se cargan al iniciar.
    Desde el pie de página se pueden **restaurar** (registros + catálogo) o **vaciar**
    (solo registros).

## Estructura

```
app/
  layout.tsx            # metadatos, layout raíz y script anti-parpadeo del tema
  page.tsx              # Server Component mínimo que monta <MRPApp />
  globals.css           # variante `dark`, paleta clara/oscura y scrollbars
components/
  MRPApp.tsx            # Client Component raíz: estado, filtros y modales
  MRPTable.tsx          # tabla principal + totales
  EditableCell.tsx      # celda editable (texto / número / select)
  SummaryCards.tsx      # tarjetas de totales por mes y por UM
  FiltersBar.tsx        # buscador global + filtros por columna
  ExcelImportModal.tsx  # importación con previsualización y append
  ReportModal.tsx       # reporte rápido con agrupaciones
  RegistroFormModal.tsx # alta / edición de un registro
  ColumnasSelector.tsx  # selector de columnas visibles
  ThemeToggle.tsx       # interruptor claro / oscuro
  ui/                   # Boton, Modal, Campos, SelectorConNuevo
hooks/
  use-mrp-store.ts      # binding React del store de registros
  use-catalogo.ts       # binding React del catálogo global
  use-columnas.ts       # binding React de las columnas ocultas
  use-tema.ts           # binding React del tema
lib/
  types.ts              # RegistroMRP, Proyecciones, CatalogoMRP, Tema…
  constants.ts          # meses, catálogos, etiquetas, claves de storage
  mock-data.ts          # 8 registros de ejemplo
  mrp-utils.ts          # totales, agrupaciones, filtrado, formato, opciones
  excel.ts              # importación / exportación (SheetJS)
  pdfExport.ts          # reporte PDF apaisado (jsPDF + autotable)
  mrp-store.ts          # store externo de registros + localStorage
  catalogo-store.ts     # store externo del catálogo dinámico + localStorage
  columnas-store.ts     # store externo de columnas ocultas + localStorage
  tema-store.ts         # store externo del tema + localStorage
  utils.ts              # normalización de texto, parseo de números, ids
```

### Claves de `localStorage`

| Clave | Contenido |
| --- | --- |
| `mrp:registros:v1` | Lista de registros del MRP |
| `mrp:catalogo:v1` | Catálogo global de valores por campo |
| `mrp:columnas:v1` | Columnas ocultas de la tabla |
| `mrp:tema` | `"claro"` o `"oscuro"` |

## Modelo de datos

```ts
export interface RegistroMRP {
  id: string;
  propietario: string;   // "Alex Estela"
  departamento: string;  // "APURIMAC"
  cuenta: string;        // "CORPORACION SALGAL"
  proyecto: string;      // "ADQUISICION"
  detalleProducto: string; // "PEN 120/150"
  grupoLinea: string;    // "ASFALTO CONVENCIONAL"
  refineria: string;     // "PETROPERU" | "IMPORTADO"
  unidadMedida: string;  // "GLN" | "KG"
  proyecciones: { ago?: number; set?: number; oct?: number; nov?: number; dic?: number };
}
```

## Notas de implementación

- `xlsx` se importa de forma dinámica dentro de `lib/excel.ts`, por lo que sus
  ~900 KB no entran en el bundle inicial.
- La descarga del `.xlsx` se arma con un `Blob` propio, así el export no depende
  de la detección de entorno de la librería.
- `localStorage` se lee mediante un store externo (`useSyncExternalStore`), lo
  que evita el `useEffect` de hidratación y mantiene el HTML del servidor
  idéntico al primer render del cliente.
- El separador decimal/miles se interpreta con convención es-PE: `1,500` → 1500
  y `1,5` → 1.5. Los negativos contables `(1,200)` se leen como −1200.
- El modo oscuro usa una **variante de clase**:
  `@custom-variant dark (&:where(.dark, .dark *));` en `app/globals.css`, y la
  clase `dark` se aplica a `<html>`. Para que no haya parpadeo, `app/layout.tsx`
  inyecta un script en `<head>` que lee `localStorage` y aplica la clase **antes
  del primer pintado** (`suppressHydrationWarning` en `<html>`).
- `jspdf` y `jspdf-autotable` se importan de forma dinámica dentro de
  `lib/pdfExport.ts`: solo se descargan al pulsar “Exportar a PDF”.
- El ancho de las columnas del PDF se calcula a partir del ancho real de la
  página (`841.89 pt` en A4 apaisado), así la tabla llena la hoja sin desbordarse.
- Los catálogos (`mrp:catalogo:v1`), las columnas (`mrp:columnas:v1`) y el tema
  (`mrp:tema`) siguen el mismo patrón de store externo que los registros, de modo
  que nunca hay `setState` dentro de un `useEffect` (regla
  `react-hooks/set-state-in-effect`).
- La visibilidad de columnas es un ajuste de **presentación**: `totalFila`,
  `totalesPorMes` y `totalGeneral` no reciben las columnas ocultas, así que los
  totales son matemáticamente independientes de lo que se vea. En el PDF se
  respetan las columnas ocultas en la tabla, pero el bloque de totales por mes
  siempre imprime Ago–Dic.
- La exportación a **Excel** sí incluye todas las columnas: al ser un volcado de
  datos, ocultar una columna en pantalla no debería perder información.

## Seguridad de dependencias

El proyecto migró de npm a **pnpm** por seguridad de la cadena de suministro:

- `packageManager` en `package.json` fija `pnpm@11.5.0`, y `pnpm-lock.yaml`
  reemplaza a `package-lock.json` (eliminado).
- pnpm **no ejecuta los scripts de instalación** (`preinstall`/`install`/
  `postinstall`) de las dependencias salvo que estén aprobados explícitamente en
  `pnpm-workspace.yaml` (`allowBuilds`). Con `strictDepBuilds` activo por
  defecto, un script sin revisar hace fallar la instalación en lugar de ejecutarse
  en silencio.
- En este repositorio las dos dependencias con scripts quedan **rechazadas**
  (`core-js: false`, `unrs-resolver: false`): ninguna de las dos los necesita
  para funcionar, así que se mantiene la superficie de ataque al mínimo.
- `.npmrc` activa `minimumReleaseAge=1440`, que evita resolver versiones
  publicadas hace menos de 24 h (ventana típica de un compromiso de mantenedor),
  y `verify-store-integrity` para validar cada paquete contra el lockfile.

```bash
pnpm install            # respeta allowBuilds y el lockfile
pnpm approve-builds     # (solo si algún día hace falta permitir un build)
```
