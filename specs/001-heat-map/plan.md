# Plan de implementación — Spec 001: Mapa de calor

Base: `specs/001-heat-map/spec.md` (RF-1 a RF-11). Respeta `docs/constitution.md`:
3 archivos de app, lógica pura separada del DOM, sin instalar nada, datos intactos.

## 1. Archivos y responsabilidades

| Archivo | Acción | Responsabilidad | RF |
|---|---|---|---|
| `index.html` | Modificar | Reordenar Hoy (carrusel → Entradas de hoy → tira → mapa). Nueva sección `#heatmap-section`: cabecera con título y selector de año, cuadrícula, botón «Ver más semanas», leyenda, panel de detalle, mensajes de vacío. | RF-1, RF-4, RF-5, RF-6, RF-8, RF-10, RF-11 |
| `styles.css` | Modificar | Cuadrícula en CSS grid, 5 niveles de color + sin color, atenuados, borde de hoy, leyenda, detalle, selector compacto, breakpoint 768 px, foco visible y `prefers-reduced-motion`. | RF-2, RF-3, RF-5, RF-7, RNF-3, RNF-5 |
| `app.js` | Modificar | (a) Lógica pura nueva del mapa (sección propia). (b) `mapaState` centralizado. (c) `renderHeatMap()` + listeners (clic, botón, selector, teclado, cambio de ancho). (d) Guard de exportación para tests. | Todos |
| `tests/heatmap.test.js` | **Crear** | Tests de la lógica pura con `node --test` (runner integrado en Node 24; no instala nada, P4). Requiere permitir `tests/` en AGENTS.md. | Verifica RF-1, RF-2, RF-3, RF-4, RF-5, RF-7 |
| `AGENTS.md` | Modificar | Permitir carpeta `tests/`; resumir la funcionalidad (P2: spec y código en el mismo paso). | P2 |
| `MEMORY.md` | Modificar | Estado actual y notas de sesión. | — |

## 2. Funciones puras de lógica (todas reciben `hoy` como parámetro)

Se añaden a la sección de lógica de `app.js`, junto a `computeStreak` y demás. Se
reutilizan las utilidades de fechas existentes (`addDaysYMD`, `parseYMD`,
`diffDaysYMD`, `getSesiones`); `hoy` siempre es texto `YYYY-MM-DD` local.

| Función | Firma | Qué devuelve | RF |
|---|---|---|---|
| `lunesDeYMD` | `(ymd) → ymd` | Lunes de la semana de esa fecha. | RF-1 |
| `computeDiasEstudio` | `(entradas, hoy) → { fecha: {minutos, numEntradas} }` | Suma de minutos y nº de entradas por día, ignorando sesiones futuras o corruptas. | RF-2, RF-7, RNF-1 |
| `nivelIntensidad` | `(minutos) → 0..5` | 0 = sin color; 1–29, 30–59, 60–119, 120–239, 240+. | RF-2 |
| `aniosConDatos` | `(entradas, hoy) → [2024, 2025…]` | Años con al menos una sesión no futura, ordenados. | RF-5 |
| `rangoVistaActual` | `(esMovil, extra) → numColumnas` | `min((esMovil ? 12 : 53) + extra, 53)`. | RF-3, RF-4 |
| `rangoVistaAnio` | `(anio, esMovil, extra) → {numColumnas, totalAnio}` | Año completo (52/53) en desktop; en móvil bloques de 12 desde el final del año hasta `totalAnio`. | RF-4, RF-5 |
| `construirModeloSemanas` | `(diasEstudio, hoy, fechaFin, numColumnas, limiteInferior) → [[día×7]×N]` | Matriz de columnas; cada día: `{fecha, minutos, numEntradas, nivel, esHoy, esFuturo, fueraDeRango, pulsable}`. | RF-1, RF-5, RF-7 |
| `modeloMapa` | `(entradas, hoy, mapaState, esMovil) → {columnas, hayDatosVisibles, anios}` | Orquestadora: calcula rango y límites según la vista y llama a `construirModeloSemanas`. | RF-1, RF-3, RF-4, RF-5 |
| `transicionMapa` | `(mapaState, accion, contexto) → mapaState` | Reducer puro de la máquina de estados (cambiar vista, elegir año, ampliar, seleccionar/cerrar día, rotar). Los listeners solo lo invocan. | RF-3, RF-4, RF-5, RF-6 |
| `formatoMinutos` | `(min) → texto` | `«45 min»` o `«120 (2h 0m)»` (se extrae del código del carrusel para reutilizarlo). | RF-6 |

Estado de sesión (no se persiste, RNF-1):
`mapaState = { vista: 'actual' | 'anio', anio: null | number, extra: 0, diaSel: null | fecha }`

## 3. Algoritmo del mapa (pseudocódigo)

```
función modeloMapa(entradas, hoy, mapaState, esMovil):
    dias = computeDiasEstudio(entradas, hoy)          // futuras ignoradas dentro
    si mapaState.vista == 'actual':
        N      = rangoVistaActual(esMovil, mapaState.extra)
        fin    = hoy                                   // última columna = semana de hoy
        limite = hoy - 7*(N-1) días                    // ventana rodante GitHub (53 col = 1 año)
        esFuera = (fecha) => fecha < limite            // días antes del rango: atenuados
    si no:                                             // vista de un año pasado
        {N, totalAnio} = rangoVistaAnio(mapaState.anio, esMovil, mapaState.extra)
        fin    = 31-dic del año
        esFuera = (fecha) => fecha < 1-ene del año o fecha > 31-dic del año
    devolver construirModeloSemanas(dias, hoy, fin, N, esFuera)
           + { hayDatosVisibles, anios: aniosConDatos(entradas, hoy) }

función construirModeloSemanas(dias, hoy, fin, N, esFuera):
    primeraColumna = lunesDeYMD(fin) - 7*(N-1) días
    para c en 0 .. N-1:                                // columnas = semanas
        para f en 0 .. 6:                              // filas = lunes..domingo
            fecha = primeraColumna + c*7 + f días      // suma con setDate, nunca ms
            dia   = dias[fecha] o vacío
            marcar: esHoy (fecha == hoy),
                    esFuturo (fecha > hoy),
                    fueraDeRango = esFuera(fecha),     // condición según la vista
                    pulsable = no esFuturo y no fueraDeRango,
                    nivel = (esFuturo o fueraDeRango) ? 0 : nivelIntensidad(dia.minutos)
    devolver columnas
```

Notas de fechas (skill local-dates): sumas con `setDate`, comparaciones como texto
`YYYY-MM-DD`, nunca `new Date("...")` ni `toISOString()` para hoy. La ventana
rodante (vista «Actual») cubre los últimos N×7 días terminando hoy, como GitHub:
la primera columna puede mostrar días anteriores al rango, atenuados.

## 4. Cómo se pinta en la interfaz

- **Sección** (en Hoy, tras la tira de la semana, RF-10): título «Mapa de calor» +
  selector de año (RF-5): en escritorio, fila de botones «Actual», 2024, 2025…;
  en móvil, un `<select>` nativo (compacto y accesible). Oculto si hay ≤1 año.
- **Cuadrícula**: contenedor `role="grid"` con CSS grid (`grid-auto-flow: column`,
  7 filas). Cada día es un `<button class="heat-cell">` (RNF-3) con `aria-label`
  según tres casos fijos: con datos «8 de octubre de 2026 · 45 min · 2 entradas»;
  sin datos «8 de octubre de 2026 · sin estudio»; futuro o fuera de rango
  «8 de octubre de 2026 · no disponible». Clases: `lvl-1..lvl-5`, `empty`,
  `dimmed` (futuro/fuera de rango), `today` (borde, RF-7), `selected`.
- **Teclado** (RNF-3): patrón grid con *roving tabindex* — solo la celda activa
  tiene `tabindex="0"`; flechas mueven selección; Enter/Espacio abre el detalle.
  Foco inicial: hoy (o último día con datos en vista de año).
- **Detalle** (RF-6): panel bajo la cuadrícula con fecha, minutos
  (`formatoMinutos`) y nº de entradas; «Día sin estudio» si procede. Se cierra con
  toggle, cambio de pestaña, rotación/redimensionado o si el día sale de vista.
- **«Ver más semanas»** (RF-4): botón bajo la cuadrícula, visible solo si no se
  llegó al máximo del contexto.
- **Leyenda** (RF-11): 5 cuadrados de tono entre «Menos» y «Más».
- **Vacíos** (RF-8): sin entradas → cuadrícula sin color + mensaje invitando a
  estudiar; entradas sin días visibles → «No hay días que mostrar en este periodo».
- **Recalculo**: `renderHeatMap()` se llama desde `render()` (RF-9) y desde dos
  listeners: `matchMedia('(min-width: 768px)')` recalcula el rango al cruzar el
  breakpoint (RF-3); `resize` con debounce (~150 ms) cierra el detalle ante
  cualquier rotación o redimensionado (RF-6). Toda transición de estado pasa por
  `transicionMapa` (los listeners solo traducen eventos a acciones).

## 5. Decisiones técnicas (y alternativa descartada)

1. **Lógica pura dentro de `app.js` + doble guard**: `init()` solo se ejecuta si
   existe `document`, y las funciones puras solo se exportan si existe `module`.
   Así Node carga la lógica sin arrancar la app. *Descartada*: mover la lógica a
   un 4.º archivo JS — la constitución fija 3 archivos de app (P1).
2. **`node --test` (runner integrado en Node 24)** para los tests. No instala
   nada ni añade dependencias al proyecto (P4). *Descartada*: verificación solo
   manual en navegador — los casos de fechas (DST, bisiesto, umbrales) no son
   repetibles a mano de forma fiable.
3. **Cuadrícula con DOM + CSS grid y celdas `<button>`**. *Descartados*: canvas
   (sin accesibilidad ni teclado, incumpliría RNF-3) y SVG (más verboso para 371
   celdas interactivas sin ventaja real).
4. **Roving tabindex + flechas** (una sola parada Tab). *Descartada*: 371 celdas
   tabulables una a una — inusable con teclado.
5. **`matchMedia` para el rango + `resize` con debounce para el detalle**:
   `matchMedia` solo recalcula al cruzar 768 px (RF-3, sin eventos redundantes);
   un listener `resize` aparte solo cierra el detalle (RF-6 exige cerrarlo ante
   cualquier cambio de tamaño, no solo al cruzar el breakpoint). *Descartado*:
   usar solo `resize` con medición manual — mezcla dos responsabilidades y
   duplica el umbral.
5b. **Máquina de estados como reducer puro (`transicionMapa`)**: las
   transiciones vista/año/ampliación/selección son funciones puras testeables.
   *Descartado*: lógica de estado repartida en listeners — imposible de testear
   con `node --test` y más difícil de leer.
6. **`mapaState` centralizado en memoria, sin persistir**. *Descartado*:
   guardarlo en localStorage — añadiría datos nuevos (RNF-1) y la spec lo limita
   a la sesión.
7. **Reutilizar las utilidades de fechas existentes** (`addDaysYMD`, `parseYMD`…).
   *Descartada*: crear helpers nuevos — duplicaría lógica sensible (DST).

## 6. Estrategia de tests (`node --test`)

Comando: `node --test` desde la raíz del proyecto (Node 24, sin instalar nada;
auto-descubre `tests/` — la ruta con espacios rompe la forma `node --test tests/`).
Solo se testean funciones puras; lo visual/interactivo se verifica con
Chrome DevTools, previa aprobación del usuario (P4, criterio de finalización 1).

| Bloque de tests | Casos | RF |
|---|---|---|
| `nivelIntensidad` | Bordes exactos: 0, 1, 29, 30, 59, 60, 119, 120, 239, 240. | RF-2 |
| `computeDiasEstudio` | Suma multi-libro el mismo día; ignora sesiones futuras; cuenta entradas por día; tolera sesiones corruptas (P5). | RF-2, RF-7 |
| `lunesDeYMD` | Cualquier día cae en el lunes de su semana; semanas que cruzan mes y año. | RF-1 |
| `construirModeloSemanas` | Última columna contiene hoy; primera columna empieza en lunes; futuros sin color ni pulsables; fuera de rango atenuados; hoy marcado. | RF-1, RF-7 |
| `rangoVistaActual` | 12 en móvil, 53 en desktop; extra acotado al máximo. | RF-3, RF-4 |
| `rangoVistaAnio` | Año completo 52/53 en desktop; móvil empieza en 12 desde el final; 29 de febrero presente en año bisiesto; último bloque parcial. | RF-4, RF-5 |
| `transicionMapa` | Ampliar hasta el máximo y tope; cambiar a año y volver a «Actual» (reset de extra); seleccionar/cerrar día; cerrar detalle al rotar o al salir el día de vista; conservación de extra entre modos móvil/desktop. | RF-3, RF-4, RF-5, RF-6 |
| `aniosConDatos` | Omite años sin sesiones y años solo con sesiones futuras; orden ascendente. | RF-5 |
| DST | Semana del cambio de hora (marzo y octubre): sin días duplicados ni huecos. | RF-1 |
| `formatoMinutos` | <60 sin paréntesis; ≥60 con horas. | RF-6 |

Verificación manual adicional (con aprobación): RNF-2 se mide con `console.time`
en el navegador de pruebas con 2 años de datos generados.

## 7. Cobertura de requisitos

| RF | Lógica pura | Interfaz | Tests |
|---|---|---|---|
| RF-1 Cuadrícula | `lunesDeYMD`, `construirModeloSemanas` | `#heatmap-grid` | ✔ |
| RF-2 Niveles | `computeDiasEstudio`, `nivelIntensidad` | clases `lvl-*` | ✔ |
| RF-3 768 px / recalculo | `rangoVistaActual` | `matchMedia` listener | ✔ (lógica) |
| RF-4 Ver más semanas | `rangoVistaActual`, `rangoVistaAnio`, `mapaState.extra` | botón | ✔ |
| RF-5 Selector de año | `aniosConDatos`, `rangoVistaAnio` | selector | ✔ |
| RF-6 Detalle | `formatoMinutos`, `transicionMapa` | panel detalle | ✔ (formato y estado) |
| RF-7 Hoy/futuros | `construirModeloSemanas` | clases `today`/`dimmed` | ✔ |
| RF-8 Vacíos | `modeloMapa.hayDatosVisibles` | mensajes | navegador* |
| RF-9 Recalculo | — | llamada desde `render()` | navegador* |
| RF-10 Orden en Hoy | — | reorden en `index.html` | navegador* |
| RF-11 Leyenda | — | leyenda | navegador* |
| RNF-1..RNF-6 | diseño sin persistencia | aria, contraste | `console.time` + navegador* |

\* navegador = verificación con Chrome DevTools, previa aprobación del usuario
(criterio de finalización 1 de la spec). "✔" = test automático con `node --test`.
