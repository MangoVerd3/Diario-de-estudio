# Tareas — Spec 003: Libros mejorados (fichas, fuentes y huella)

Derivadas de `plan.md`. Base: `specs/003-better-books/spec.md` (RF-1 a RF-19, con
enmienda E1) y `docs/constitution.md`. En cada tarea se escriben primero los tests y
luego el código; lo visual se verifica en el navegador con Chrome DevTools, previa
aprobación del usuario (P4). Comando de tests: `node --test` desde la raíz.
Los 64 tests actuales (19 mapa + 45 metas) deben seguir en verde sin cambios: las
métricas ganan el parámetro opcional `archivo = []`.

- [x] T1: Normalizar libros, fuentes y urls (migración sin pérdida)
  - Archivos: `app.js`, `tests/libros.test.js` (crear)
  - Cubre: RNF-3, RF-13, RF-14
  - Depende de: ninguna
  - Tests: `normalizarLibro` (sin `contenido`/`origen`/`fuentes` → `''`/`''`/`[]`, >500 recortado, color raro, libro sin `id` → `null`); `normalizarFuente` (título vacío/espacios/>60 y enlace `javascript:` → `null` sin perder el resto); `normalizarUrlFuente` (`www.x.com` → `https://…`, otros esquemas → `null`, >500 → `null`).
  - Hecha cuando: `loadState` normaliza libros/fuentes, el import de un JSON `version: 2` (sin `contenido`/`origen`/`fuentes`) carga sin perder nada y las funciones están exportadas en `module.exports`.

- [x] T2: Nombres únicos, icono y contraste
  - Archivos: `app.js`, `tests/libros.test.js`
  - Cubre: RF-1, RF-2, RF-7, RF-13
  - Depende de: T1
  - Tests: `validarNombreLibro` (vacío, >40, duplicado `trim().toLowerCase()` → «Ya tienes un libro con ese nombre» al crear y al renombrar, el propio libro excluido); `inicialLibro` (espacios, acentos, no-latina); `colorTextoLibro` (tinta legible sobre los 8 colores, ≥4.5:1).
  - Hecha cuando: los tests pasan y el formulario de crear/renombrar usa `validarNombreLibro` con el mensaje exacto.

- [x] T3: Huella de estudio al eliminar (INV-1–INV-3)
  - Archivos: `app.js`, `tests/libros.test.js`
  - Cubre: RF-16, RF-17, RF-18, RNF-1, RNF-2
  - Depende de: T1
  - Tests: `normalizarArchivo` (ausente → `[]`, registro corrupto descartado sin perder el resto); `archivarLibro` (2 entradas → 2 registros solo `{libroId, archivadoEn, sesiones}`, sin título/contenido; sin entradas → huella intacta; no muta originales); invariantes INV-1 (sesiones antes == después), INV-2 (métricas idénticas exista o no el libro), INV-3 (ningún nombre/contenido/url sobrevive).
  - Hecha cuando: los tests pasan y `archivarLibro` + `normalizarArchivo` están exportadas.

- [x] T4: Métricas con entradas + huella (001/002 intactas)
  - Archivos: `app.js`, `tests/libros.test.js`
  - Cubre: RF-17, RF-18, RF-19
  - Depende de: T3
  - Tests: `sesionesTodas`/`combinarParaMetricas` con `computeStreak`, `computeWeeklyMinutes`, `computeStudyDays`, `computeDiasEstudio`, `modeloMapa` y `resumenMetas` (metas/perfectas/fuegos/guía): racha 6 + 4 metas intactas tras borrar; día solo-de-huella sigue coloreado y contando; «Entradas de hoy», listas y `resumenLibro` ignoran la huella.
  - Hecha cuando: las métricas aceptan `archivo = []` por defecto, los 64 tests antiguos pasan sin cambios y `render()` pasa `state.archivo` a cada métrica.

- [x] T5: Persistencia version 3 + export/import con huella
  - Archivos: `app.js`, `tests/libros.test.js`
  - Cubre: RNF-3, RF-19
  - Depende de: T1, T3
  - Tests: `validateImportedData` acepta JSON sin `archivo`/`fuentes`/`metas`; `loadState` lo normaliza; export marca `version: 3` e incluye `archivo`; importar reemplaza también la huella.
  - Hecha cuando: ida y vuelta exportar/importar con contenido, origen, fuentes y huella, e importación de JSON antiguo sin perder nada (criterio 7).

- [x] T6: Rejilla de fichas + panel con tabs (acordeón 1/2/3)
  - Archivos: `index.html`, `styles.css`, `app.js`
  - Cubre: RF-1, RF-2, RF-3, RF-4, RF-5, RF-6, RNF-5, RNF-6, RNF-7, RNF-8
  - Depende de: T2, T4
  - Tests: `transicionFicha` (alternar, una sola abierta, abrir resetea a Entradas, cambiar de opción limpia `confirmando`); resto visual en navegador.
  - Hecha cuando: fichas en 1/2/3 columnas con icono CSS + «N entradas · M min», panel a ancho completo bajo su fila, tabs Entradas/Fuentes/Editar con flechas e `aria-selected`, animaciones 220/180/160 ms (0 ms con `reduced-motion`), estado conservado al cambiar de pestaña y todo cerrado al recargar, sin scroll horizontal desde 320 px.

- [x] T7: Entradas dentro de la ficha + deep-link desde Hoy
  - Archivos: `index.html`, `styles.css`, `app.js`
  - Cubre: RF-7, RF-8, RF-9, RF-10, RNF-7
  - Depende de: T6
  - Tests: no aplica (DOM); se comprueba en el navegador.
  - Hecha cuando: Entradas muestra el mismo formato/acciones/buscador/validaciones que hoy con «+ Añadir entrada» (formulario 200 ms); la búsqueda es por libro y se limpia al abrir otro; libro nuevo queda abierto en Entradas con foco en el título; pulsar una entrada de Hoy abre su ficha y libro eliminado no cambia de pestaña ni da error.

- [x] T8: Fuentes + Editar (contenido/origen, límite 20)
  - Archivos: `index.html`, `styles.css`, `app.js`, `tests/libros.test.js`
  - Cubre: RF-11, RF-12, RF-13, RF-14
  - Depende de: T2, T6
  - Tests: `puedeAnadirFuente` (19 → `true`, 20 → `false`); validaciones de T1–T2 reutilizadas.
  - Hecha cuando: Fuentes muestra icono grande, contenido/origen como texto literal y enlaces en pestaña nueva con aviso al lector (vacíos en singular/plural); Editar guarda nombre único + color + 2×500 con contador y el CRUD de fuentes (título 60, url con autocompletado `https://`, repetidas OK, 20 con botón desactivado + aviso), todo visible al instante y con `textContent`.

- [x] T9: Eliminar libro con confirmación inline y huella
  - Archivos: `index.html`, `styles.css`, `app.js`, `tests/libros.test.js`
  - Cubre: RF-15, RF-16, RF-17
  - Depende de: T3, T6
  - Tests: `archivarLibro` integrado (borrar deja métricas idénticas, incluido el único libro).
  - Hecha cuando: «Eliminar libro» pide confirmación en la ficha con la frase exacta «¿Estás seguro de eliminar el libro?» + detalle (N entradas, contenido, origen, enlaces) + «Sí, eliminar»/«Cancelar» (180 ms, `Escape` cancela y devuelve el foco); al confirmar la ficha sale (200 ms), aviso «Libro eliminado.», foco a la ficha siguiente/anterior o al estado vacío, y racha/días/minutos/mapa/metas idénticos antes y después (criterio 2).

- [x] T10: Docs, rendimiento y verificación final
  - Archivos: `AGENTS.md`, `MEMORY.md`, `specs/001-heat-map/` (enmienda), `styles.css`, `app.js`
  - Cubre: RNF-8, RNF-9, RNF-10, §11
  - Depende de: T5, T7, T8, T9
  - Tests: `node --test` en verde (64 + nuevos); rendimiento con 50 libros/2000 entradas (<100 ms, sin reconstruir mapa/carrusel/tira ni perder scroll/foco).
  - Hecha cuando: `AGENTS.md` documenta el modelo nuevo, el borrado con huella y `version: 3`; `MEMORY.md` recoge D-1/D-2; spec 001 anotada; textos en español revisados (500/500/20/40/URL larga) y 320/375/1020/1280 sin desbordes ni consola con errores nuevos.

| RF / RNF | Tareas |
|---|---|
| RF-1 | T2, T6 |
| RF-2 | T2, T6 |
| RF-3 | T6 |
| RF-4 | T6 |
| RF-5 | T6 |
| RF-6 | T6 |
| RF-7 | T2, T7 |
| RF-8 | T7 |
| RF-9 | T7 |
| RF-10 | T7 |
| RF-11 | T8 |
| RF-12 | T8 |
| RF-13 | T1, T2, T8 |
| RF-14 | T1, T8 |
| RF-15 | T9 |
| RF-16 | T3, T9 |
| RF-17 | T3, T4, T9 |
| RF-18 | T3, T4 |
| RF-19 | T4, T5 |
| RNF-1 | T3 |
| RNF-2 | T3 |
| RNF-3 | T1, T5 |
| RNF-4 | T1–T5, T8 (tests `node --test`) |
| RNF-5 | T6 |
| RNF-6 | T6 |
| RNF-7 | T2, T6, T7 |
| RNF-8 | T6, T10 |
| RNF-9 | T10 |
| RNF-10 | T8, T10 |
