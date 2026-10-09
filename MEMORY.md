# Memoria del proyecto — Diario de Estudio

Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual
- V2 "cuaderno de estudio": rediseño mobile-first con barra de navegación inferior
  (Hoy / Libros / Ajustes); en desktop son pestañas bajo el título centrado.
- Mapa de calor (spec 001) implementado en Hoy y VERIFICADO en navegador (T1–T5 todas
  completas): vista «Actual» (12 semanas móvil / 53 escritorio, «Ver más semanas»),
  selector de años pasados (select en móvil, botones en desktop), 5 niveles bambú,
  detalle al pulsar un día, teclado grid (1 Tab + flechas), mensajes de vacío.
  Tests 19/19 (`node --test`). RNF-2 cumplido: 19,4 ms con 2 años de datos (<100 ms).
  Bug encontrado en verificación: el detalle no se cerraba al cambiar de pestaña
  (faltaba re-render); corregido. Capturas en Temp/opencode/diario-heatmap-*.png.
- Hoy: carrusel de estadísticas (racha actual, más larga, minutos/semana, días estudiados)
  con swipe, pulsación sostenida, puntos y teclado; tira de la semana (L–D) con fuego 🔥
  de semana perfecta; lista de entradas de hoy que enlazan a su libro.
- Libros: crear/renombrar/eliminar libros y entradas, búsqueda por título o contenido.
- Ajustes: exportar e importar JSON (con validación al importar).
- Tiempo de estudio en minutos por entrada: se acumula por sesiones (una entrada puede
  sumar minutos en varios días). "Corregir tiempo" reemplaza el historial por una única
  sesión con la fecha de la entrada (no marca hoy).
- Racha, "Días estudiados" y "Minutos esta semana" se calculan desde las sesiones.
- Datos en localStorage, clave `diarioEstudio`.
- Estilo: papel liso blanco cálido de libro viejo (#f6f0df), acento verde bambú
  (#15803d, recuperado de la V1), entradas como notas adhesivas con cinta del color
  del libro; fuego naranja con animación "pop" (respeta prefers-reduced-motion).

## Decisiones tomadas (y por qué)
- Sin backend ni dependencias: cualquiera puede abrirlo con doble click.
- Toda sesión se registra con la fecha de hoy: simplifica el modelo y refleja el uso real (se estudia "ahora").
- Racha calculada siempre desde las fechas de las entradas, sin contador guardado: evita datos desincronizados.
- Fechas como texto `"YYYY-MM-DD"` en hora local, sin `toISOString()` para "hoy".
- Racha actual estricta: días seguidos que terminan hoy; si hoy no hay sesión, es 0 (sin día de gracia ni aviso).
- "Corregir tiempo" reemplaza las sesiones por una única sesión con la fecha de la entrada: no marca el día de hoy.
- Sin aviso de "nuevo record": no se pidió.
- No hay campo de fecha: toda sesión nueva se registra con la fecha local de hoy; "Corregir tiempo" deja una única sesión con fecha de hoy.
- Semana = lunes a domingo; los minutos se atribuyen por la fecha de cada sesión de entrada (sin registro editable de fecha).
- "Seguir estudiando este tema" añade una sesión con la fecha de hoy: marca ese día en racha/calendario sin borrar las sesiones anteriores.
- Cada entrada tiene `sesiones: [{fecha, minutos}]` agrupado por día; los días anteriores se conservan al estudiar de nuevo.
- "Días estudiados" = días únicos con entrada, sin fechas futuras.

## Aprendizajes y errores a evitar
- Mantener `memory.md` alineado con el código real (estuvo desincronizado).

## Proximos pasos
- (opcional) Asociar el `<label>Color</label>` del formulario de libro al radiogroup de la paleta
  (Chrome reporta el aviso de accesibilidad "No label associated with a form field").

## Notas de la última sesión
- Mapa de calor COMPLETO (T1–T5): verificación E2E con Chrome DevTools aprobada por el
  usuario. Todo correcto salvo un bug (detalle no se cerraba al cambiar de pestaña) que
  se corrigió en el momento. Datos de prueba limpiados al terminar.
- T1–T4 del mapa de calor implementadas: lógica pura completa (modelo + reducer
  transicionMapa), interfaz (sección en Hoy tras reordenar "Entradas de hoy" sobre la
  tira), tests 19/19 en verde. Corrección respecto al plan: el límite de la ventana
  rodante es `hoy - 7*(N-1)` (la fórmula del plan nunca generaba atenuados); plan.md
  ya corregido. Pendiente T5: verificación en navegador con Chrome DevTools (pedir
  aprobación), medida RNF-2, capturas móvil/escritorio.
- T1 implementada (mapa de calor): lógica pura base en app.js (lunesDeYMD, nivelIntensidad,
  computeDiasEstudio, formatoMinutos, aniosConDatos) + doble guard document/module +
  tests/heatmap.test.js (Node 24, `node --test` con auto-descubrimiento; la forma
  `node --test tests/` falla por el espacio en la ruta). AGENTS.md ya permite tests/.
  tasks.md creado con T1..T5.
- Plan `specs/001-heat-map/plan.md` creado y corregido tras revisión QA: `modeloMapa`
  orquestadora + `transicionMapa` (reducer puro con tests); mapaState en memoria;
  matchMedia para rango + resize con debounce para cerrar detalle; grid DOM + roving
  tabindex; selector de año = <select> en móvil y botones en desktop.
- Spec `specs/001-heat-map/spec.md` cerrada tras 3 pasadas QA (RF-1 a RF-11, sin dudas).
  Ajustes de la 3ª pasada: ampliación = semanas extra sobre el predeterminado móvil
  (conservada al rotar, cambiar de pestaña y al guardar; se pierde al recargar o volver
  a «Actual»); último bloque de año puede ser parcial; año "con datos" = al menos una
  sesión no futura; mensaje genérico «No hay días que mostrar en este periodo»; detalle
  se cierra también al rotar; RF-9 incluye eliminar libro; hoy siempre enfocable.
  NOTA: el usuario va a enmendar la constitución (P6) para aceptar código más complejo.
- Spec `specs/001-heat-map/spec.md` cerrada tras 2 pasadas QA (RF-1 a RF-11, sin dudas):
  5 niveles bambú (240+ = rojo), 12 semanas <768px / 53 en desktop conservando ampliación
  al rotar, «Ver más semanas» (+12; en Actual hasta 53; en vista de año móvil hasta
  cubrir el año), selector de año (solo años pasados CON datos; año actual solo vía
  «Actual»; oculto si hay un solo año; en móvil por bloques de 12), detalle al pulsar
  (toggle, se cierra al cambiar de pestaña o si el día sale de vista), futuros no
  pulsables ni colorean, teclado grid (foco en hoy/último con datos), RNF-2 <100ms
  en Brave del equipo con aprobación del usuario. Constitución P2 enmendada: las
  specs de `specs/` también definen el comportamiento. Pendiente: plan de implementación.
- Eliminada redundancia AGENTS.md ↔ constitución: el stack y el idioma solo están en la
  constitución; AGENTS.md remite a ella y conserva lo operativo (clave localStorage,
  textContent, procedimiento de pruebas con Chrome DevTools, spec funcional).
- Creada `docs/constitution.md` con los 6 principios innegociables del proyecto
  (stack mínimo, la spec manda, lógica separada de UI, pruebas sin dependencias,
  datos del usuario intocables, español y para principiantes). AGENTS.md ya la enlaza
  y permite `docs/`.
- Tema cambiado a "hoja de papel": fondo liso #f6f0df (libro viejo, sin rejilla) y
  paleta verde bambú recuperada de la V1. Solo se tocó styles.css (tokens y sombras
  cálidas). Sin verificación en navegador, a petición del usuario.
- Rediseño V2 "cuaderno de estudio" implementado y probado con Chrome DevTools:
  pestañas OK, carrusel OK (swipe, pulsación sostenida, puntos, teclado), fuego de
  semana perfecta aparece y desaparece correctamente, consola sin errores,
  capturas móvil 375px y desktop correctas.
- Bug encontrado en pruebas: `display:flex` en clases anulaba el atributo `hidden`
  (se veían todos los paneles). Solución: regla global `[hidden] { display: none !important; }`.
- El formulario de libro ahora se muestra/oculta (hidden) en vez de estar siempre visible.
- Entorno de pruebas: no hay Chrome instalado; shim en `AppData\Local\Google\Chrome\Application\chrome.exe`
  (hardlinks a Brave 154.1.96.61). Si Brave se actualiza, re-enlazar la carpeta de versión.
- Las pruebas usan un contexto aislado del navegador: no tocan los datos reales del usuario.
  Datos de prueba limpiados al terminar.
