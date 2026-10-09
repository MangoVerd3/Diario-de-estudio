# AGENTS.md — Diario de Estudio

App web para llevar un diario de estudio: varios libros de estudio, entradas en
cada uno y una racha de días consecutivos.

## Reglas
- Principios innegociables (stack, pruebas, datos, idioma): `docs/constitution.md`.
  Archivos de la app: `index.html`, `styles.css`, `app.js`; la documentación vive
  en `docs/`, las especificaciones en `specs/` y los tests de lógica pura
  (`node --test`, sin instalar nada) en `tests/`.
- Guarda todo en `localStorage` con la clave `diarioEstudio`.
- Datos: `{ libros: [{id, nombre, color}], entradas: [{id, libroId, titulo, contenido, fecha, minutos, sesiones}] }`.
  La fecha es un texto `"YYYY-MM-DD"` en hora local. `minutos` es el total de tiempo de
  estudio de la entrada. `sesiones` es un array `[{fecha, minutos}]` agrupado por fecha
  (al seguir estudiando se suma a la sesión de ese día). La `fecha` visible es la de la
  última sesión. Al corregir tiempo, `sesiones` se reemplaza por una única sesión con
  la fecha de la entrada (corregir no marca el día de hoy). No hay campo de fecha en
  el formulario: toda sesión nueva se registra con la fecha local de hoy (`getTodayLocalYMD()`).
  Racha, días estudiados y minutos/semana se calculan desde `sesiones`.
- Usa `textContent` en vez de `innerHTML` para mostrar texto del usuario.
- Manten actualizado @MEMORY.md.

## Convenciones
- Nombres descriptivos y comentarios breves solo donde aporten (idioma: constitución, principio 6).
- Diseño limpio y responsive; cualquier pantalla nueva debe verse bien en el móvil.
- Diseño "hoja de papel": fondo liso blanco cálido de libro viejo (#f6f0df), acento
  verde bambú (#15803d), entradas como notas adhesivas con cinta del color del libro.
  Mobile-first con barra de navegación inferior (Hoy / Libros / Ajustes);
  en desktop son pestañas bajo el título.
- Las estadísticas (racha actual, racha más larga, minutos/semana, días estudiados)
  van en un carrusel: swipe o pulsación sostenida para avanzar, puntos y teclado.
- La pestaña Hoy termina con un mapa de calor de días estudiados
  (spec completa en `specs/001-heat-map/spec.md`): vista «Actual» (12 semanas en
  móvil, 53 en escritorio, botón «Ver más semanas») y selector de años pasados;
  5 niveles de color por minutos del día; detalle al pulsar un día. Su lógica
  pura tiene tests en `tests/` (`node --test`).

## Racha
- Un día cuenta si se usa la opcion de "Seguir estudiando este tema" y se guarda la entrada o si se crea una entrada nueva en un libro (en cualquier libro).
- Racha actual: días seguidos que terminan hoy. Si hoy no hay sesión, la racha actual es 0.
- Calcúlala siempre desde las fechas de las entradas.
- La tira de la semana muestra lunes a domingo de la semana en curso (los días
  futuros se ven atenuados). El fuego 🔥 de "semana perfecta" aparece cuando todos
  los días de lunes a hoy tienen sesión, y desaparece si se rompe.

## Semana
- La semana va de lunes a domingo. "Minutos esta semana" suma los `minutos` de
  todas las entradas (todos los libros) cuya `fecha` cae en ese rango.

## Días estudiados
- Días únicos (en cualquier libro) con al menos una entrada, total histórico.
- No cuentan las fechas futuras. Calcúlalo siempre desde las entradas.

## Cómo trabajar
- Pregunta siempre si deberias usar el MCP de Chrome DevTools para probar cambios. si se acepta su uso; prueba la funcionalidad implementada, revisa la consola y comprueba la vista móvil.
- No dejes código incompleto.
- Si algo no está claro, pregunta.
