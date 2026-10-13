# Tareas — Spec 002: Better streak (metas y rachas semanales)

Derivadas de `plan.md`. Base: `specs/002-better-streak/spec.md` (RF-1 a RF-10) y
`docs/constitution.md`. En cada tarea se escriben primero los tests y luego el
código; lo visual se verifica en el navegador con Chrome DevTools, previa aprobación
del usuario (P4). Comando de tests: `node --test` desde la raíz.

- [x] T1: Historial de metas: normalizar y persistir
  - Archivos: `app.js`, `tests/metas.test.js` (crear)
  - Cubre: RNF-2, RF-1
  - Depende de: ninguna
  - Tests: `normalizarMetas` sin campo, con `dias` fuera de 1–7, con `desde` no lunes (se ajusta), con datos desordenados y con `null`/texto/número.
  - Hecha cuando: `state.metas` se carga con `normalizarMetas`, `saveState` y el export (`version: 2`) lo incluyen, el import lo normaliza y un JSON antiguo sin `metas` sigue cargando con meta 3.

- [x] T2: Elegir la meta en Ajustes
  - Archivos: `index.html`, `styles.css`, `app.js`, `tests/metas.test.js`
  - Cubre: RF-1, RF-2
  - Depende de: T1
  - Tests: `guardarMetaSemanal` (primera meta el miércoles, cambio al lunes siguiente, segundo cambio que sustituye al pendiente, elegir la vigente), `metaPendiente` y `metaSemanaActual`.
  - Hecha cuando: el bloque «Meta semanal» con `#meta-select` (1–7) y `#meta-aviso` funciona: elegir 5 un miércoles muestra «5 días» sin aviso y cambiarlo a 4 muestra «Se aplicará desde el lunes», persistiendo tras recargar.

- [x] T3: Meta vigente y días estudiados
  - Archivos: `app.js`, `tests/metas.test.js`
  - Cubre: RF-2, RF-3
  - Depende de: T1
  - Tests: `metaVigenteDe` sin historial (3) y con varios cambios sin reevaluar semanas vividas; `diasConMinutos`/`diasEstudiadosSemana` con L+M+2 el jueves = 3, día de 0 minutos, sesión futura y minutos negativos.
  - Hecha cuando: los tests pasan y las tres funciones están exportadas en `module.exports`.

- [x] T4: Semanas cerradas, rachas y récords
  - Archivos: `app.js`, `tests/metas.test.js`
  - Cubre: RF-9
  - Depende de: T3
  - Tests: `semanasAEvaluar` desde el primer día estudiado (equivalente al de la primera entrada: una entrada de 0 minutos en semanas anteriores no cambia racha, récord ni totales) y hasta la última cerrada; `resumenSemanas` con semana vacía que corta la racha; `rachasDeSemanas` con 3 seguidas y récord 6 → `{3,6}` y la siguiente sin cumplir → `{0,6}`.
  - Hecha cuando: los tests pasan y las tres funciones están exportadas.

- [x] T5: Orquestadora del resumen semanal
  - Archivos: `app.js`, `tests/metas.test.js`
  - Cubre: RF-2 a RF-10, RNF-1
  - Depende de: T3, T4
  - Tests: integración con primer uso a mitad de semana, meta 1 y meta 7, corrección o eliminación en semana cerrada, eliminación de la entrada más antigua, importación sin historial y DST/cambio de año.
  - Hecha cuando: los tests pasan y `render()` calcula `resumenMetas` una vez y lo pasa a `renderStats`, `renderWeekStrip` y `renderAjustes`.

- [x] T6: Fuego único del día
  - Archivos: `index.html`, `styles.css`, `app.js`, `tests/metas.test.js`
  - Cubre: RF-4, RF-5, RF-6, RF-7, RNF-3
  - Depende de: T5
  - Tests: `fechaLogroMeta` (día nº N y logro por fecha de sesión), `esPerfectaHoy` y `estadoFuegoHoy` (prioridad perfecta > meta > racha y `null` si no toca).
  - Hecha cuando: `#week-fire` vaciado en el HTML pinta el texto que toca con `clamp` desde 320 px, se oculta cuando `tipo` es `null` y `renderWeekStrip` ya no decide el fuego por su cuenta.

- [x] T7: Días posibles y concordancia
  - Archivos: `app.js`, `tests/metas.test.js`
  - Cubre: RF-8
  - Depende de: T3
  - Tests: `diasPosiblesSemana` (hoy no cuenta si ya está estudiado, domingo → 0 o 1) y `textoMetaDias`/`textoFaltanDias` en singular y plural.
  - Hecha cuando: los tests pasan y las tres funciones están exportadas.

- [x] T8: Texto de guía bajo la tira
  - Archivos: `index.html`, `styles.css`, `app.js`, `tests/metas.test.js`
  - Cubre: RF-8
  - Depende de: T5, T7
  - Tests: `textoGuiaMeta` con los 6 casos y los ejemplos literales del RF-8, incluido el usuario sin entradas y la concordancia.
  - Hecha cuando: `#week-guide` con la clase `.week-legend` muestra `resumen.guia` envuelto sin desbordar desde 320 px y la tira sigue marcando con `getFechasEstudiadas`.

- [x] T9: Tarjetas del carrusel
  - Archivos: `index.html`, `styles.css`, `app.js`, `tests/metas.test.js`
  - Cubre: RF-10, RNF-3
  - Depende de: T5
  - Tests: `textoTarjetaRacha` («4 · racha 3 · récord 6» y todo a ceros).
  - Hecha cuando: hay dos tarjetas con `aria-label` propio, valor con `.stat-value-compact` que cabe en 320 px, y `CAROUSEL_COUNT` y `CAROUSEL_LABELS` en 6 con swipe, pulsación, puntos y flechas funcionando.

- [x] T10: Recálculo al cambiar de semana
  - Archivos: `app.js`
  - Cubre: RNF-1, RF-5
  - Depende de: T5, T6
  - Tests: no aplica (temporizadores); se comprueba en el navegador.
  - Hecha cuando: un `setInterval` de 60 s y un listener `visibilitychange`/`focus` re-renderizan solo si cambió el día local cacheado, y el fuego de «Semana perfecta» desaparece el lunes sin recargar.

[NECESITA ACLARACIÓN] resuelto: `semanasAEvaluar` arranca en el lunes del primer día
estudiado (`fechas[0]`), que equivale al de la primera entrada porque las semanas
previas tienen 0 días estudiados y no alteran racha, récord ni totales (plan §3.2).
No hace parámetro nuevo.

| RF / RNF | Tareas |
|---|---|
| RF-1 | T1, T2 |
| RF-2 | T2, T3, T5 |
| RF-3 | T3, T5 |
| RF-4 | T6 |
| RF-5 | T6, T10 |
| RF-6 | T4, T6 |
| RF-7 | T6 |
| RF-8 | T7, T8 |
| RF-9 | T4, T5 |
| RF-10 | T5, T9 |
| RNF-1 | T5, T10 |
| RNF-2 | T1 |
| RNF-3 | T6, T9 |
