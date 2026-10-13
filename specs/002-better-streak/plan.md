# Plan de implementación — Spec 002: Better streak (metas y rachas semanales)

Base: `specs/002-better-streak/spec.md` (RF-1 a RF-10, RNF-1 a RNF-3).
Respeta `docs/constitution.md`: 3 archivos de app (`index.html`, `styles.css`,
`app.js`), lógica pura separada del DOM (P3), `node --test` sin instalar nada (P4,
enmendado), datos del usuario intactos y normalizados (P5), todo en español (P6).
La spec **sustituye** dos reglas vigentes de `AGENTS.md`: el fuego de «semana
perfecta» de lunes a hoy (ahora exige los 7 días) y el texto
«Estudia cada día de lunes a hoy para encender el fuego».

Decisiones tomadas con el usuario antes de implementar (ver §5): no se toca el
marcado de la tira, el aviso de Ajustes es solo «Se aplicará desde el lunes», se
enmienda P4, las tarjetas nuevas llevan pista y un `desde` importado que no sea
lunes se ajusta al lunes.

## 1. Archivos que se crean o modifican

| Archivo | Acción | Responsabilidad | RF |
|---|---|---|---|
| `index.html` | Modificar | (a) Vaciar el texto estático de `#week-fire` (lo escribe el JS en cada render). (b) Dar id al párrafo de guía conservando su clase: `<p id="week-guide" class="week-legend">` (reutiliza el CSS existente). (c) Primer bloque de Ajustes «Meta semanal»: `<select id="meta-select">` con opciones 1–7 y `<p id="meta-aviso">`. (d) Dos tarjetas nuevas en el carrusel: `<article class="stat-card" aria-label="Metas semanales">` y `aria-label="Semanas perfectas"`, con valor `<div id="metas-card" class="stat-value stat-value-compact">` e `id="perfectas-card"`. | RF-1, RF-7, RF-8, RF-10, RNF-3 |
| `styles.css` | Modificar | `.week-fire` escalable (`clamp`) para que quepa «🔥 Racha de metas semanales activa» desde 320 px; `.stat-value-compact` con `clamp` para que «4 · racha 3 · récord 6» quepa en 320 px; bloque de meta en Ajustes reutilizando `.settings-text` / `.form-input`. No se toca el marcado de la tira (decisión 11). | RF-4–RF-7, RF-10, RNF-3 |
| `app.js` | Modificar | (a) `state.metas` + persistencia: `saveState` lo incluye, export con `version: 2`, `validateImportedData` acepta el campo ausente o de tipo incorrecto, import con `state.metas = normalizarMetas(parsed.metas)`. (b) Sección nueva de lógica pura «METAS Y RACHAS SEMANALES». (c) `renderWeekStrip(resumen)`: mantiene el marcado con `getFechasEstudiadas` y pinta solo el fuego único y `#week-guide`; `renderStats(resumen)` pinta las dos tarjetas; `renderAjustes()` pinta la meta y el aviso. (d) `CAROUSEL_COUNT` 4 → 6 y etiquetas. (e) Intervalo de 60 s más listener `visibilitychange`/`focus` que re-renderizan solo si cambió el día local. (f) Exportar la lógica nueva en `module.exports` para los tests. | Todos |
| `tests/metas.test.js` | **Crear** | Tests de la lógica pura con `node --test` (auto-descubrimiento; no instala nada, P4). | RF-1 a RF-10 |
| `AGENTS.md` | Modificar | Sustituir las reglas de «semana perfecta» (lunes–hoy) y del texto de la tira por las de la spec 002; documentar `metas` en el modelo de datos, las semanas cerradas, el orden de los fuegos, las 6 tarjetas del carrusel y las dos definiciones de «día estudiado» (P2: spec y código en el mismo paso). | RF-1, RF-2, RF-3, RF-9, RF-10, RNF-2 |
| `docs/constitution.md` | Modificar | Enmendar el principio 4: la lógica pura podrá verificarse además con el runner integrado de Node (`node --test`), sin instalar nada. | P4 |
| `MEMORY.md` | Modificar | Estado actual y notas de sesión. La entrada del 14 oct cita «RF-1 a RF-19» y «7 tarjetas», que **no** corresponde a la spec vigente (RF-1 a RF-10, 6 tarjetas); se alinea con `spec.md`. | — |

## 2. Funciones puras de lógica

Todas viven en `app.js`, junto a `computeStreak` y a la lógica del mapa, y reciben
`hoy` (`'YYYY-MM-DD'` local) como parámetro; ninguna toca el DOM (P3). Reutilizan
`addDaysYMD`, `lunesDeYMD`, `parseYMD` y `computeDiasEstudio` (spec 001).

Modelo de datos nuevo: `state.metas = [{ dias: 1..7, desde: 'YYYY-MM-DD' }]`,
ordenado por `desde`, donde `desde` es el **lunes** desde el que rige esa meta
(RF-1: «cada cambio queda registrado con la fecha desde la que rige»). Constante
`META_POR_DEFECTO = 3` (RF-2, RNF-2).

| Función | Firma | Qué devuelve | RF |
|---|---|---|---|
| `normalizarMetas` | `(valor) → [{dias, desde}]` | Historial válido y ordenado. Descarta metas con `dias` fuera de 1–7 o `desde` inválido; **ajusta al lunes** (`lunesDeYMD`) un `desde` que no lo sea en lugar de descartarla (P5); sin datos → `[]` (la vigencia cae en 3). Tolera `null`, string o número. | RNF-2, P5 |
| `guardarMetaSemanal` | `(metas, dias, hoy) → metas'` | Regla de vigencia sobre un historial ya normalizado: sin metas previas → primera meta desde el lunes de la semana en curso; con metas vigentes → desde el lunes siguiente, sustituyendo al pendiente; elegir la meta ya vigente → quita el pendiente y no deja aviso. | RF-1, RF-2 |
| `metaVigenteDe` | `(metas, lunes) → 1..7` | Meta de esa semana: el último cambio con `desde <= lunes`, o 3 si no hay ninguno. Nunca reevalúa semanas vividas. | RF-2, RF-9 |
| `metaPendiente` | `(metas, hoy) → {dias, desde} \| null` | Cambio registrado que aún no rige (`desde > hoy`); si hubiera varios (solo posible con datos importados), el de `desde` más avanzada. | RF-1 |
| `metaSemanaActual` | `(metas, hoy) → {dias, aviso}` | Lo que muestra Ajustes: la meta elegida (el pendiente si existe) y el texto «Se aplicará desde el lunes». | RF-1 |
| `diasConMinutos` | `(dias) → [fecha]` | Fechas con minutos totales > 0 a partir de `computeDiasEstudio` (una sola fuente de verdad, RNF-1), **ordenadas** de más antigua a más reciente. | RF-3 |
| `diasEstudiadosSemana` | `(fechas ordenadas, lunes) → 0..7` | Días estudiados de esa semana (días únicos con minutos > 0). | RF-3 |
| `semanasAEvaluar` | `(fechas ordenadas, hoy) → [lunes]` | Ventana a evaluar: del lunes del primer día estudiado (`fechas[0]`) al lunes de la última semana cerrada. Equivale al lunes de la primera entrada (§3.2). Vacía si aún no hay semana cerrada. | RF-9, glosario |
| `resumenSemanas` | `(fechas ordenadas, metas, hoy) → [{lunes, meta, diasEstudiados, cumplida, perfecta}]` | Evalúa cada semana cerrada de la ventana con su meta vigente. | RF-9 |
| `rachasDeSemanas` | `(semanas, tipo) → {racha, record}` | `tipo` = `'cumplida'` \| `'perfecta'`. La racha es la tanda final (termina en la última semana cerrada; 0 si esa semana no cuenta); el récord es la mejor tanda del historial. | RF-9 |
| `fechaLogroMeta` | `(fechas ordenadas, metas, lunes) → ymd \| null` | Fecha del día estudiado nº N de la semana (N = meta vigente); `null` si aún no se alcanza. | RF-4 |
| `esPerfectaHoy` | `(fechas ordenadas, hoy) → bool` | Hoy es domingo y los 7 días de la semana están estudiados. | RF-5 |
| `diasPosiblesSemana` | `(fechas ordenadas, hoy) → n` | Días de hoy al domingo que aún no están estudiados (hoy cuenta solo si no tiene estudio). | RF-8 |
| `estadoFuegoHoy` | `(fechas ordenadas, metas, hoy, rachaMetas) → {tipo, texto}` | Fuego del día con la prioridad perfecta > meta > racha; `{tipo: null}` si no toca ninguno. | RF-4, RF-5, RF-6, RF-7 |
| `textoGuiaMeta` | `(datos) → texto` | Los 6 casos del RF-8 en orden, con concordancia singular/plural. | RF-8 |
| `textoMetaDias` | `(n) → texto` | «5 días» / «1 día» **sin preposición**: el «de» lo pone la frase. | RF-8 |
| `textoFaltanDias` | `(n) → texto` | «te faltan 2 días» / «te falta 1 día». | RF-8 |
| `textoTarjetaRacha` | `(total, racha, record) → texto` | «4 · racha 3 · récord 6». | RF-10 |
| `resumenMetas` | `(entradas, metas, hoy) → objeto` | Orquestadora: un solo recorrido de entradas y todo lo que necesita la interfaz (meta, días estudiados, días posibles, meta cumplida, semana sin empezar, perfecta hoy, fecha de logro, fuego, guía, totales, rachas y récords de metas y de perfectas). | RF-3 a RF-10, RNF-1 |

## 3. Algoritmos no triviales (pseudocódigo)

### 3.1 Vigencia de la meta (RF-1, RF-2)

```
función guardarMetaSemanal(metas, dias, hoy):        // 'metas' ya está normalizado
    lunesHoy = lunesDeYMD(hoy)
    vigentes = metas filtra (m => m.desde <= hoy)      // descarta pendientes previos
    si dias == metaVigenteDe(vigentes, lunesHoy):      // vuelve a la meta ya en curso
        devolver vigentes                               // sin pendiente ni aviso
    si vigentes está vacío:                             // primera meta configurada
        devolver vigentes + [{dias, desde: lunesHoy}]   // rige ya esta semana (RF-2)
    devolver vigentes + [{dias, desde: lunesHoy + 7}]   // pendiente: lunes siguiente (RF-1)

función metaVigenteDe(metas, lunes):
    ultimo = null
    para m en metas: si m.desde <= lunes: ultimo = m     // 'metas' está ordenado
    devolver ultimo ? ultimo.dias : 3
```

Un cambio pendiente no necesita paso de activación: cuando llega su lunes, `desde`
ya es `<= hoy` y `metaVigenteDe` lo aplica solo (RNF-1). Si el equipo estuvo cerrado
varias semanas, el cambio rige desde su lunes y alcanza también a las semanas cerradas
que empezaron después; nunca reevalúa semanas anteriores a su `desde` (RF-2).

### 3.2 Semanas, rachas y récords (RF-3, RF-9)

```
función semanasAEvaluar(fechas, hoy):                  // 'fechas' ordenadas
    si fechas está vacío: devolver []
    lunesInicio = lunesDeYMD(fechas[0])                // semana del primer DÍA ESTUDIADO
                                                       // (equivalente a la de la primera
                                                       // entrada: ver la nota de abajo)
    lunesFin    = lunesDeYMD(hoy) - 7 días             // última semana CERRADA
    si lunesFin < lunesInicio: devolver []             // todavía no cerró ninguna
    devolver [lunesInicio, +7, +14, ..., lunesFin]

función resumenSemanas(fechas, metas, hoy):
    para lunes en semanasAEvaluar(fechas, hoy):         // todas cerradas
        n = días de [lunes .. lunes+6] que están en fechas
        añadir { lunes, meta: metaVigenteDe(metas, lunes), diasEstudiados: n,
                 cumplida: n >= meta, perfecta: n == 7 }

función rachasDeSemanas(semanas, tipo):                 // tipo: 'cumplida' | 'perfecta'
    racha = 0; record = 0
    para s en semanas:                                  // orden cronológico
        si s[tipo]: racha++
        si no:     record = max(record, racha); racha = 0
    record = max(record, racha)
    devolver { racha, record }
    // la racha ya es 0 si la última semana cerrada no cuenta: la ventana
    // termina siempre en la última semana cerrada y la tanda se corta al fallar
```

Notas: la ventana arranca en el lunes del **primer día estudiado**, que equivale al
lunes de la primera entrada: las semanas previas tienen 0 días estudiados, así que
nunca son `cumplida` ni suman a los totales, y lo único que hacen es cortar una racha
que ya está a 0. Añadirlas o no a la ventana da la misma racha, el mismo récord y los
mismos totales (también cuando todas las entradas son de 0 minutos: los dos caminos
devuelven 0, 0 y 0). Una semana cerrada sin entradas —o cuya única entrada es de 0
minutos— tiene `diasEstudiados = 0`, luego `cumplida = false`: corta la racha y no
suma al total, pero el récord se conserva. Las sesiones con minutos negativos o no
numéricos las descarta `computeDiasEstudio`. La semana en curso no está en la ventana
(no se suma hasta cerrar).

### 3.3 Fuegos del día (RF-4, RF-5, RF-6, RF-7)

```
función estadoFuegoHoy(fechas, metas, hoy, rachaMetas):
    lunes = lunesDeYMD(hoy)
    si esPerfectaHoy(fechas, hoy):                       // hoy es domingo y 7 días (RF-5)
        devolver { tipo: 'perfecta', texto: '🔥 ¡Semana perfecta!' }
    si fechaLogroMeta(fechas, metas, lunes) == hoy:      // día nº N de la semana (RF-4)
        devolver { tipo: 'meta', texto: '🔥 ¡Meta semanal alcanzada!' }
    si rachaMetas > 0:                                   // la semana en curso no cuenta aún (RF-6)
        devolver { tipo: 'racha', texto: '🔥 Racha de metas semanales activa' }
    devolver { tipo: null, texto: '' }
```

El orden de los `si` **es** la prioridad del RF-7, en un único elemento. El logro se
mide por la fecha de la sesión, no por cuándo se registró: una sesión con fecha del
lunes archivada hoy deja el fuego en el lunes (RF-4, segundo ejemplo). Toda sesión
nueva se registra con la fecha local de hoy (`getTodayLocalYMD()`), así que una
entrada creada pasada la medianoche cuenta para el día local que empieza (RF-3).

### 3.4 Texto de guía (RF-8)

```
función textoGuiaMeta({ meta, estudiados, diasPosibles, perfectaPosible,
                        hayEntradasAnteriores, perfectaHoy }):
    si perfectaHoy:              devolver '¡Completaste una semana perfecta!'                     // 1
    si estudiados == 0 y hayEntradasAnteriores:
                                 devolver 'Esta semana aún no has estudiado: tu meta es de '
                                          + textoMetaDias(meta) + '.'                             // 2
    si estudiados < meta:                                                                         // meta no cumplida
        si estudiados + diasPosibles >= meta:
                                 devolver 'Tu meta semanal es de ' + textoMetaDias(meta)
                                          + ', ' + textoFaltanDias(meta - estudiados) + '.'       // 3
                                 devolver 'Recuerda estudiar todas las semanas'                   // 4
    si perfectaPosible:         devolver 'Meta semanal alcanzada, ¡esta semana puedes conseguir
                                          una semana perfecta!'                                  // 5
    devolver 'Meta alcanzada' + (diasPosibles > 0 ? ', ¿vamos a estudiar más?' : '')               // 6
```

`perfectaPosible` = ningún día de `[lunes .. hoy-1]` sin estudiar.
`hayEntradasAnteriores` = alguna entrada con alguna sesión antes del lunes de esta
semana, aunque sus minutos sean 0 (lectura literal del caso 2). El caso 2 exige
entradas en semanas anteriores, así que un usuario sin entradas cae directamente al
3 o al 4 (propio del RF-8).

### 3.5 Orquestadora (RNF-1)

```
función resumenMetas(entradas, metas, hoy):
    dias    = computeDiasEstudio(entradas, hoy)         // reutiliza spec 001; futuras fuera
    fechas  = claves de dias con minutos > 0, ordenadas
    hist    = Array.isArray(metas) ? metas : []
    lunes   = lunesDeYMD(hoy)
    semanas = resumenSemanas(fechas, hist, hoy)
    rMetas  = rachasDeSemanas(semanas, 'cumplida')
    rPerf   = rachasDeSemanas(semanas, 'perfecta')
    estudiados = diasEstudiadosSemana(fechas, lunes)
    devolver {
      lunes, meta: metaVigenteDe(hist, lunes), estudiados, metaCumplida: estudiados >= meta,
      diasPosibles: diasPosiblesSemana(fechas, hoy),
      perfectaPosible: todo día de [lunes .. hoy-1] está en fechas,
      hayEntradasAnteriores: alguna entrada con sesión antes de lunes,
      perfectaHoy: esPerfectaHoy(fechas, hoy),
      fechaLogroMeta: fechaLogroMeta(fechas, hist, lunes),
      fuego: estadoFuegoHoy(fechas, hist, hoy, rMetas.racha),
      guia: textoGuiaMeta({ meta, estudiados,
                            diasPosibles, perfectaPosible,
                            hayEntradasAnteriores, perfectaHoy }),
      totalMetas: semanas cuenta (cumplida), rachaMetas: rMetas.racha, recordMetas: rMetas.record,
      totalPerfectas: semanas cuenta (perfecta), rachaPerfectas: rPerf.racha,
      recordPerfectas: rPerf.record
    }
```

## 4. Cómo se pinta en la interfaz

- **Fuego (RF-4, RF-5, RF-6, RF-7)**: se reutiliza el elemento único `#week-fire`
  (junto a la tira de la semana, `role="status" aria-live="polite"`).
  `hidden = resumen.fuego.tipo === null`; `textContent = resumen.fuego.texto`.
  El texto estático del HTML se vacía para que no aparezca «¡Semana perfecta!»
  antes del primer render.
- **Guía (RF-8)**: `<p id="week-guide" class="week-legend">` bajo la tira, con
  `resumen.guia`. Mantiene la clase, así que reutiliza el CSS actual. No es
  `aria-live` (evita anuncios en cada recálculo).
- **Tira de la semana (RF-3 no la cambia)**: se mantiene tal cual, L–D con días
  futuros atenuados y marcado con `getFechasEstudiadas` (cualquier sesión, con minutos
  o sin ellos). La spec 002 deja la racha diaria fuera de alcance (§7) y su glosario
  solo redefine «día estudiado» para las metas, que viven en `diasConMinutos` y
  alimentan metas, rachas y guía. Las dos definiciones quedan escritas en `AGENTS.md`
  (decisión 11).
- **Carrusel (RF-10)**: dos tarjetas nuevas tras las cuatro actuales —
  «Metas semanales» y «Semanas perfectas», con `aria-label` propio como las
  existentes — y valor `textoTarjetaRacha(total, racha, record)`
  («4 · racha 3 · récord 6») con la clase `.stat-value-compact` para que quepa en
  320 px. Llevan pista («semanas cumplidas» / «semanas perfectas»; decisión 12).
  Los puntos se generan desde `CAROUSEL_LABELS`, así que swipe, pulsación sostenida
  y flechas siguen funcionando sin cambios al subir `CAROUSEL_COUNT` a 6.
- **Ajustes (RF-1)**: bloque «Meta semanal» con `<select id="meta-select">`
  (opciones 1 a 7) y `<p id="meta-aviso">`. El `select` muestra la meta elegida
  (la vigente si ya rige, la pendiente si aún no); `#meta-aviso` muestra
  «Se aplicará desde el lunes» y se oculta cuando no hay cambio pendiente. Elegir un
  valor hace `state.metas = guardarMetaSemanal(state.metas, Number(valor), hoy)`,
  `saveState()` y `render()`.
- **Recálculo (RNF-1)**: `render()` calcula `resumenMetas` una sola vez y lo pasa
  a `renderStats(resumen)`, `renderWeekStrip(resumen)` y `renderAjustes()`. Todas
  las acciones que ya llaman a `render()` (crear, seguir estudiando, corregir,
  eliminar, importar) recalculan por sí solas. Para el cambio de semana con la app
  abierta: un `setInterval` de 60 s más un listener `visibilitychange`/`focus`
  comparan el día local cacheado y solo llaman a `render()` si cambió (así el fuego
  de «Semana perfecta» desaparece el lunes sin recargar, RF-5, incluso con la
  pestaña suspendida).
- **Rótulos (RNF-3)**: todo el reconocimiento es texto con 🔥 en español; el fuego
  usa `font-size: clamp(1rem, 4.5vw, 1.4rem)` y la guía envuelve, para que ambos
  quepan desde 320 px (se verifica en navegador, criterio de finalización 1).

## 5. Decisiones técnicas (y alternativa descartada)

1. **Historial único `metas` con `desde` = lunes de entrada en vigor**; el cambio
   pendiente es simplemente el elemento con `desde` en el futuro. *Descartado*:
   guardar dos campos (`metas` + `metaPendiente`) o guardar la fecha de
   configuración y derivar el lunes de aplicación al leer. Con un solo array,
   `metaVigenteDe` es un recorrido único, **no hace paso de activación** cuando
   llega el lunes (el elemento pasa a ser vigente solo, RNF-1) y hay un campo menos
   que normalizar, exportar e importar (RNF-2). Además es exactamente lo que pide
   el RF-1 («registrado con la fecha desde la que rige»).
2. **Semana cerrada = la anterior a la actual** (`lunes < lunesDeYMD(hoy)`; la
   ventana de evaluación acaba en `lunesDeYMD(hoy) - 7`). Es equivalente a
   «domingo ya pasó» para todos los días de la semana, y respeta la frase del
   glosario «la semana en curso nunca está cerrada»: el domingo aún no suma a la
   racha, el lunes sí.
3. **Una sola orquestadora `resumenMetas`** que hace un recorrido de entradas y
   devuelve todo, más funciones puras pequeñas. *Descartado*: que `renderStats`,
   `renderWeekStrip` y Ajustes calculen cada uno su trozo — duplicaría recorridos y
   podría discrepar de los totales (criterio de finalización 4).
4. **Reutilizar `computeDiasEstudio` (spec 001) como única fuente de minutos por
   día** y definir «día estudiado» = día con minutos totales > 0
   (`diasConMinutos`). *Descartado*: un recorrido nuevo paralelo — dos fuentes de
   verdad para el mismo dato.
5. **Racha y récord en una sola pasada hacia adelante sobre la ventana de semanas
   cerradas**, no con un paseo hacia atrás desde la última semana cerrada. La
   pasada hacia adelante da racha, récord y los dos totales a la vez y hace
   evidente que una semana sin entradas corta la racha (RF-9). *Descartado*: el
   paseo hacia atrás obligaría a repetir el recorrido para cada total.
6. **Prioridad de fuegos dentro de una función pura** (`estadoFuegoHoy`) en lugar
   de una cadena de `if` en el render. *Descartado*: la lógica de presentación no
   se podría probar con `node --test` (P3) y el RF-7 quedaría sin verificación
   automática.
7. **Intervalo de 60 s más `visibilitychange`/`focus` que re-renderizan solo si
   cambió el día local**, además del recálculo en cada acción. *Descartado*: calcular
   `hoy` solo dentro de los listeners — con la app abierta el fuego de «Semana
   perfecta» seguiría visible el lunes hasta que el usuario tocase algo (RF-5,
   criterio de finalización 3), y con la pestaña suspendida el intervalo puede
   no dispararse a tiempo.
8. **Meta en Ajustes con `<select>` 1–7**. *Descartado*: siete botones/radio
   botones — ocupan alto de pantalla en móvil y duplican el valor mostrado.
9. **Normalizar descartando metas con `dias` inválido y ajustando `desde` al lunes**
   (`lunesDeYMD`). *Descartado*: recortar `dias` a 1–7 inventaría un dato que el
   usuario no eligió, y descartar una meta con `desde` desplazado perdería una
   configuración que sí eligió; el RF-2 y el RNF-2 ya cubren el hueco con la meta
   por defecto de 3 y las entradas nunca se tocan (P5).
10. **Elegir la meta ya vigente borra el cambio pendiente** (no deja aviso).
    *Descartado*: crear igualmente un pendiente → Ajustes diría «Se aplicará desde
    el lunes» para un cambio que no cambia nada. Regla documentada en `AGENTS.md`.
11. **La tira de la semana no se toca**: su marcado sigue con `getFechasEstudiadas`
    (cualquier sesión) y el cambio se limita al fuego y al texto de guía.
    *Descartado*: alinear el marcado a «minutos > 0» — la spec deja la racha diaria
    fuera de alcance (§7) y el glosario solo redefine «día estudiado» para las
    metas; alinear la tira dejaría la tira, la racha diaria y el contador «Días
    estudiados» con tres definiciones distintas del mismo día. Las dos definiciones
    vigentes quedan escritas en `AGENTS.md` (P2).
12. **Las tarjetas nuevas llevan pista** («semanas cumplidas» / «semanas perfectas»)
    aunque el RF-10 no la pida. *Descartado*: dejarlas sin pista — con seis
    tarjetas, la pista evita confundir el total con la racha. Es decisión de diseño,
    no requisito de la spec.
13. **`#week-guide` conserva la clase `.week-legend`**. *Descartado*: renombrar la
    clase — dejaría la regla CSS existente huérfana sin ganar nada.

### Puntos que la spec no fijaba (resueltos con el usuario)

- **Inicio de la ventana de evaluación** (el glosario habla de «la primera entrada»,
  pero `fechas` solo trae días con minutos > 0) → arranca en el primer día estudiado,
  equivalente al de la primera entrada (§3.2): no añade parámetro y no cambia ningún
  resultado.
- **Marcado de la tira con días de 0 minutos** → no se toca la tira (decisión 11).
- **Re elegir la meta ya vigente con un cambio pendiente** → borra el pendiente
  (decisión 10).
- **Semana saltada** (equipo sin abrir varias semanas con un cambio pendiente) →
  el cambio rige desde su lunes y alcanza también a las semanas cerradas que
  empezaron después; nunca reevalúa semanas anteriores a su `desde` (§3.1).
- **`desde` que no es lunes en datos importados** → se ajusta al lunes (decisión 9).

El resto de la spec es suficiente para decidir: textos literales con su
concordancia, prioridad de fuegos, definición de semana cerrada, meta 3 por
defecto y totales de todo el historial.

## 6. Estrategia de tests (`node --test`)

Comando: `node --test` desde la raíz (Node 24; auto-descubre `tests/`; la ruta con
espacios rompe `node --test tests/`). Solo se prueban funciones puras; lo visual se
verifica en el navegador con Chrome DevTools, previa aprobación del usuario (P4,
criterio de finalización 1). Archivo nuevo `tests/metas.test.js`, con un helper
`mk(sesiones)` equivalente al de `tests/heatmap.test.js`.

| Bloque | Casos | RF |
|---|---|---|
| `normalizarMetas` | Sin campo → `[]`; `dias` fuera de 1–7 o `desde` inválido se descartan sin perder el resto; un `desde` que no sea lunes se ajusta al lunes de esa semana; ordena por `desde`; tolera `null`, texto y números. | RNF-2 |
| `guardarMetaSemanal` | Primera meta un miércoles → `desde` = lunes de esa semana (y las anteriores siguen con 3); cambio posterior → `desde` = lunes siguiente; segundo cambio antes del lunes → sustituye al pendiente y conserva la vigente; elegir la meta vigente → sin pendiente. | RF-1, RF-2 |
| `metaVigenteDe` / `metaPendiente` / `metaSemanaActual` | Sin historial → 3; con varios cambios devuelve el último con `desde <= lunes`; la semana anterior a la primera meta sigue con 3 (no se reevalúa); un pendiente no cambia la semana en curso; el aviso «Se aplicará desde el lunes». | RF-1, RF-2, RF-9 |
| Reapertura de la app | Con un cambio creado el miércoles y `hoy` = lunes siguiente, la meta pendiente pasa a ser vigente sin ningún paso de activación (RNF-1). | RF-2, RNF-1 |
| `diasConMinutos` / `diasEstudiadosSemana` | L+M+dos el jueves = 3 días; un día con única sesión de 0 minutos no suma; sesión futura no cuenta; varias entradas el mismo día = 1 día; sesiones con minutos negativos o no numéricos no cuentan. | RF-3, RNF-1 |
| Medianoche (RF-3) | Sesión registrada a las 00:30 de un día local cuenta para ese día, no para el anterior. | RF-3 |
| `semanasAEvaluar` | Empieza en el primer día estudiado, equivalente al de la primera entrada: una entrada de 0 minutos en semanas anteriores no cambia racha, récord ni totales; acaba en la última semana cerrada; `[]` si todavía no cerró ninguna; el lunes siguiente al cierre no se incluye. | RF-9, glosario |
| `resumenSemanas` | Semana cerrada sin entradas → `cumplida: false` (corta racha y no suma al total); cada semana con su meta vigente; antes de la primera meta → 3. | RF-2, RF-9 |
| `rachasDeSemanas` | 3 cumplidas seguidas con récord previo de 6 → `{racha: 3, record: 6}`; la siguiente cierra sin cumplir → `{racha: 0, record: 6}`; sin semanas → `{0,0}`; `cumplida` y `perfecta` se cuentan por separado; una tanda nueva iguala o supera el récord. | RF-9 |
| `fechaLogroMeta` | Fecha del día nº N de la semana; `null` si aún no se alcanza; sesión con fecha del lunes que completa la meta → el logro es el lunes, no hoy. | RF-4 |
| `esPerfectaHoy` | Domingo con 7 días → `true`; sábado con 7 → `false`; lunes siguiente → `false`. | RF-5 |
| `estadoFuegoHoy` | Prioridad perfecta > meta > racha; sin condiciones → `null`; racha activa sin logro hoy → texto de racha; logro hoy con racha activa → texto de meta; meta 7 el domingo → «Semana perfecta». | RF-4, RF-5, RF-6, RF-7 |
| `diasPosiblesSemana` | De hoy al domingo; hoy no cuenta si ya está estudiado; domingo → 0 o 1. | RF-8 |
| `textoGuiaMeta` / `textoMetaDias` / `textoFaltanDias` | Los 6 casos con los ejemplos literales del RF-8; concordancia («te falta 1 día», «te faltan 2 días», «de 1 día», «de 5 días»); usuario sin entradas → caso 3 o 4; meta alcanzada con días posibles → «Meta alcanzada, ¿vamos a estudiar más?». | RF-8 |
| `textoTarjetaRacha` | «4 · racha 3 · récord 6»; todo a ceros. | RF-10 |
| `resumenMetas` (integración) | Primer uso a mitad de semana (jueves, meta 3, cumplida el sábado); meta 1 (cualquier día cumple, la perfecta sigue pidiendo 7) y meta 7 (coinciden y prevalece «Semana perfecta»); corrección o eliminación en semana cerrada → semanas, rachas y récords recalculados; eliminación de la entrada más antigua → la ventana se desplaza; importación sin historial → meta 3. | RF-3 a RF-10, casos límite |
| DST y cambio de año | Semana del cambio de hora (marzo y octubre) y semana 29 dic – 4 ene: ni días duplicados ni huecos en la ventana de semanas. | RF-3, RF-8, RF-9 |

Verificación manual adicional (con aprobación): textos a 320 px, el singular y el
plural; carrusel con 6 tarjetas; fuego único con prioridad; exportar e importar el
historial de metas; JSON antiguo sin `metas`; cruce de domingo a lunes con la app
abierta (incluida la vuelta a la pestaña); consola sin errores nuevos.

## 7. Cobertura de requisitos

| RF | Función pura (§2) | Algoritmo (§3) | Interfaz (§4) | Tests (§6) |
|---|---|---|---|---|
| RF-1 Meta en Ajustes | `guardarMetaSemanal`, `metaPendiente`, `metaSemanaActual` | 3.1 | bloque Ajustes, `#meta-aviso` | ✔ |
| RF-2 Meta vigente por semana | `metaVigenteDe` | 3.1, 3.2 | — (calcula todo lo demás) | ✔ |
| RF-3 Días estudiados | `diasConMinutos`, `diasEstudiadosSemana` | 3.2 | — (la tira no cambia, decisión 11) | ✔ |
| RF-4 Fuego meta semanal | `fechaLogroMeta`, `estadoFuegoHoy` | 3.3 | `#week-fire` (tipo `meta`) | ✔ |
| RF-5 Fuego semana perfecta | `esPerfectaHoy`, `estadoFuegoHoy` | 3.3 | `#week-fire` (tipo `perfecta`) | ✔ |
| RF-6 Fuego racha activa | `rachasDeSemanas`, `estadoFuegoHoy` | 3.2, 3.3 | `#week-fire` (tipo `racha`) | ✔ |
| RF-7 Fuego único y prioridad | `estadoFuegoHoy` | 3.3 | un solo `#week-fire` | ✔ |
| RF-8 Texto de guía | `diasPosiblesSemana`, `textoGuiaMeta`, `textoMetaDias`, `textoFaltanDias` | 3.4 | `#week-guide` | ✔ |
| RF-9 Totales, rachas, récords | `semanasAEvaluar`, `resumenSemanas`, `rachasDeSemanas` | 3.2, 3.5 | tarjetas del carrusel | ✔ |
| RF-10 Dos tarjetas | `resumenMetas`, `textoTarjetaRacha` | 3.5 | `#metas-card`, `#perfectas-card` | ✔ |
| RNF-1 Sin contadores guardados | `resumenMetas` (deriva todo) | 3.5 | recálculo en `render()` + intervalo y `visibilitychange` | navegador* |
| RNF-2 Historial exportable | `normalizarMetas` | — | `saveState`, exportar/importar | ✔ (normalizar) + navegador* |
| RNF-3 Texto con 🔥 en español | `estadoFuegoHoy`, `textoGuiaMeta` | — | `clamp` de `#week-fire`, `.stat-value-compact`, guía | navegador* |
| Constitución P4 | — | — | enmienda en `docs/constitution.md` | ✔ |

\* navegador = verificación con Chrome DevTools, previa aprobación del usuario
(constitución P4, criterio de finalización 1 de la spec).
