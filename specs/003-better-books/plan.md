# Plan de implementación — Spec 003: Libros mejorados (fichas, fuentes y huella)

Base: `specs/003-better-books/spec.md` (RF-1 a RF-19, RNF-1 a RNF-10, con enmienda E1:
`contenido` + `origen` 2×500, duplicados bloqueados, P-1–P-5 resueltas).
Respeta `docs/constitution.md`: 3 archivos de app (`index.html`, `styles.css`, `app.js`),
lógica pura separada del DOM (P3), `node --test` sin instalar nada (P4), datos del
usuario intactos y normalizados (P5), todo en español (P6).
No se rompe nada de 001 (mapa) ni 002 (metas): solo cambia *de dónde salen las
sesiones* que se les pasan (entradas activas **más** huella archivada, §3.3).

Decisiones ya tomadas en la spec (§7, E1): huella por entrada (`{libroId, archivadoEn,
sesiones}`) como mínimo dato nuevo (D-1); las métricas incluyen la huella con la
consecuencia aceptada de D-2; borrar entrada suelta no cambia (D-3); una sola ficha
abierta (D-4); al crear solo nombre + color (D-5); confirmación inline con frase exacta
(D-6); icono CSS decorativo (D-7); tres opciones como pestañas, no acordeón anidado (D-8).

## 1. Archivos que se crean o modifican

| Archivo | Acción | Responsabilidad | RF |
|---|---|---|---|
| `app.js` | Modificar | (a) Modelo: `state.libros` con `contenido`, `origen`, `fuentes: [{id,titulo,url}]`; `state.archivo = [{libroId, archivadoEn, sesiones}]`; `state.fichaAbierta` (id o null, solo sesión, no persiste) + `state.opcionFicha` (`'entradas' \| 'fuentes' \| 'editar'`) + `state.confirmandoBorrado` (bool de sesión). (b) Sección nueva de lógica pura «LIBROS Y HUELLA» (§2). (c) Métricas existentes con 2.º parámetro opcional `archivo = []`: `computeStreak`, `computeWeeklyMinutes`, `computeStudyDays`, `getFechasEstudiadas`, `computeDiasEstudio`, `aniosConDatos`, `modeloMapa`, `resumenMetas`, `hayEntradasAnteriores` — todas combinan entradas + huella (§3.3) y mantienen su firma para los 64 tests actuales. (d) Persistencia `version: 3`: `loadState` normaliza libros/fuentes/archivo, `saveState` + export incluyen `archivo`, `validateImportedData` acepta ausencias (datos antiguos) y `import` normaliza y reemplaza también la huella. (e) Render de fichas: `renderBooksGrid` (fichas + panel inline), `renderFichaPanel` con tabs, `renderFuentes`, `renderEditarLibro` (incluida confirmación inline), foco y `aria-expanded`/`tablist`. (f) `module.exports` con las funciones nuevas. | Todos |
| `index.html` | Modificar | (a) `#books-list`: de `role="listbox"` a rejilla de fichas (botones con `aria-expanded` + `aria-controls` hacia su panel; se abandona `listbox/option`, RNF-7). (b) Eliminar la vista de detalle separada (`#book-view`, `#book-view-empty`, `#btn-rename-book`, `#btn-delete-book`, `#form-book` global): el formulario de crear queda solo para «+ Nuevo libro», y todo lo demás vive dentro del panel de cada ficha. (c) Dentro del panel: `role="tablist"` con tres tabs **Entradas / Fuentes / Editar** (`aria-selected`, `aria-controls`) y tres `tabpanel`; confirmación inline con la frase exacta «¿Estás seguro de eliminar el libro?» + detalle + «Sí, eliminar» / «Cancelar». (d) Formularios de contenido/origen (2×500) y de fuentes (título 60 + url 500, límite 20) con `aria-live` + `aria-describedby` como los actuales. | RF-1, RF-4–RF-7, RF-11–RF-16, RNF-7, RNF-8 |
| `styles.css` | Modificar | (a) Rejilla de fichas: 1 col <640 px, 2 col 640–1019 px, 3 col ≥1020 px, dentro de `--content-max` (760/960 px); sin scroll horizontal desde 320 px. (b) Ficha: icono-libro CSS (cubierta del color + cinta translúcida + inicial con contraste), cinta de 200 ms al abrir y realce hover/active 120 ms (elevación máx. 1 px). (c) Animaciones RNF-5 con duraciones exactas (220/180/160/200/180/200/120/200 ms) y bloque `@media (prefers-reduced-motion: reduce)` que las deja en 0 ms sin transformaciones. (d) Panel a ancho completo del contenedor bajo la fila de su ficha (sin celdas vacías ni reordenar); formularios, enlaces (abreviados visualmente, copiables) y confirmación legibles a 320 px. | RF-1–RF-2, RF-4–RF-5, RF-15–RF-16, RNF-5, RNF-6, RNF-8 |
| `tests/libros.test.js` | **Crear** | Tests de la lógica pura nueva con `node --test` (auto-descubrimiento; no instala nada, P4). | RF-11–RF-19, RNF-1–RNF-4 |
| `AGENTS.md` | Modificar | Modelo de datos nuevo (libro con `contenido`/`origen`/`fuentes`, `archivo[]` por entrada), regla de borrado (visible fuera, huella dentro), frase de confirmación, `version: 3`, y nota de que las métricas 001/002 ahora combinan entradas + huella (P2: spec y código en el mismo paso). | §11, RNF-3 |
| `MEMORY.md` | Modificar | Estado actual y notas de sesión (decisiones D-1 y D-2, regla del borrado). | §11 |
| `specs/001-heat-map/` | Anotar | Enmienda: el mapa se sigue recalculando al eliminar un libro pero su resultado deja de cambiar (las sesiones permanecen en la huella). Solo texto, sin código. | §11 |

## 2. Funciones puras de lógica

Todas en `app.js`, junto a la lógica 001/002; reciben datos y `hoy` (`'YYYY-MM-DD'`
local) como parámetros; ninguna toca el DOM (P3). Reutilizan `parseYMD`, `lunesDeYMD`,
`addDaysYMD`, `getSesiones` y `computeDiasEstudio` (001).

Modelo nuevo: `libro = { id, nombre, color, creadoEn, contenido: '' , origen: '' ,
fuentes: [{ id, titulo, url }] }`; `archivo = [{ libroId, archivadoEn, sesiones:
[{fecha, minutos}] }]` — un registro **por entrada eliminada** (el detalle del mapa
conserva el nº de entradas por día), sin título ni contenido (INV-3).

| Función | Firma | Qué devuelve | RF |
|---|---|---|---|
| `normalizarFuente` | `(f) → {id,titulo,url} \| null` | Fuente válida o `null` (se descarta solo ella): título 1–60 tras `trim` (solo-espacios = inválida); url normalizada con `normalizarUrlFuente`, 1–500 chars, `http(s)`; sin `id` → `generateId()`. | RNF-3, RF-14 |
| `normalizarFuentes` | `(valor) → [{id,titulo,url}]` | Lista válida, en orden, recortada a 20. Tolera `null`/no-array → `[]`. | RNF-3 |
| `normalizarUrlFuente` | `(texto) → url \| null` | `trim`; si falta esquema y parece dominio/`www.` → añade `https://`; acepta solo `http://`/`https://` (otro esquema → `null`); rechaza >500 chars y espacios internos. | RF-14 |
| `validarNombreLibro` | `(nombre, libros, excluirId) → {ok} \| {ok:false, error}` | Obligatorio, ≤40, único con `trim().toLowerCase()` excluyendo el propio libro; duplicado → error exacto «Ya tienes un libro con ese nombre». | RF-7, RF-13, E1 |
| `normalizarLibro` | `(l) → libro \| null` | Libro completo: `contenido`/`origen` ausentes → `''`, recortados a 500; `fuentes` via `normalizarFuentes`; color fuera de paleta → primer color; inválido sin `id`/`nombre` → `null` (nunca se pierde el resto, P5). | RNF-3 |
| `normalizarArchivo` | `(valor) → archivo` | Registros con `sesiones` válidas (`fecha` string + `minutos` ≥ 0, agrupadas por fecha como en `normalizarEntrada`); corruptos → se descartan esos registros, no la huella entera; `archivadoEn` ausente → se conserva como `0`. | RNF-3 |
| `inicialLibro` | `(nombre) → char` | Primer carácter distinto de espacio, en mayúscula (incluye acentos/no-latino). | RF-2, §8.6 |
| `colorTextoLibro` | `(colorHex) → '#1c1917' \| '#ffffff'` | Tinta oscura o blanca según contraste (luminancia relativa, umbral para 4.5:1; constitución P6). | RF-2, RNF-7 |
| `archivarLibro` | `(libros, entradas, archivo, libroId, ahora) → {libros, entradas, archivo}` | Borra libro + sus entradas de lo visible y añade **un registro por entrada** con copia de sus `sesiones` (normalizadas); libro sin entradas → huella intacta. No muta los arrays de entrada. | RF-16, RF-17, RNF-1 |
| `sesionesTodas` | `(entradas, archivo) → [{fecha, minutos}]` | Todas las sesiones (activas + huella), sin fechas futuras corruptas. Puente único hacia las métricas. | RF-17, RNF-1 |
| `combinarParaMetricas` | `(entradas, archivo) → pseudo-entradas` | `entradas` + una pseudo-entrada por registro de huella (`{sesiones}` copiadas): reutiliza sin cambios `getSesiones`, `computeStreak`, `computeDiasEstudio`, `resumenMetas` y el mapa. | RF-17, §6.2 |
| `resumenLibro` | `(libro, entradasDeLibro) → {numEntradas, minutos}` | Contador de la ficha (solo entradas activas: la huella no sale en contadores, RF-18). | RF-1, RF-18 |
| `transicionFicha` | `(ficha, accion) → ficha'` | Máquina de estado de sesión: `ficha = {abierta: id\|null, opcion, confirmando}`; acciones `ABRIR/CERRAR/ALTERNAR/OPCION/CONFIRMAR/CANCELAR_CONFIRMAR/BORRADA`; abrir resetea a `Entradas` y limpia la confirmación; una sola abierta (D-4). | RF-4–RF-6, RF-15 |
| `puedeAnadirFuente` | `(fuentes) → bool` | `fuentes.length < 20` (botón desactivado + aviso al llegar, RF-14). | RF-14 |

Las métricas existentes ganan un 2.º parámetro opcional `archivo = []` (por defecto
huella vacía: los 64 tests actuales siguen pasando sin cambios): `getFechasEstudiadas`,
`computeStreak`, `computeWeeklyMinutes`, `computeStudyDays`, `computeDiasEstudio`,
`aniosConDatos`, `modeloMapa`, `hayEntradasAnteriores`, `resumenMetas`. Por dentro
llaman a `combinarParaMetricas` y conservan sus definiciones (racha diaria: basta una
sesión; metas 002: además minutos > 0). «Entradas de hoy», listas, búsqueda y
contadores por libro siguen con **solo** entradas activas (§6.2).

## 3. Algoritmos no triviales (pseudocódigo)

### 3.1 Normalizar libro y fuentes (RNF-3, RF-13–RF-14)

```
función normalizarUrlFuente(texto):
    u = texto.trim()
    si u == '' o u.length > 500: devolver null
    si u contiene espacios internos: devolver null
    si no empieza por esquema:
        u = 'https://' + u            // www.x.com → https://www.x.com
    si no empieza por 'http://' ni 'https://': devolver null   // javascript:, mailto:, …
    resto = u tras el esquema
    si resto == '' o resto contiene espacios: devolver null
    devolver u

función normalizarFuente(f):
    si !f o typeof f.titulo != 'string': devolver null
    titulo = f.titulo.trim()
    si titulo == '' o titulo.length > 60: devolver null
    url = normalizarUrlFuente(f.url ?? '')
    si url == null: devolver null
    devolver { id: f.id ?? generateId(), titulo, url }

función normalizarLibro(l):
    si !l o typeof l.id != 'string' o typeof l.nombre != 'string': devolver null
    devolver {
      ...l,
      contenido: typeof l.contenido == 'string' ? l.contenido.slice(0,500) : '',
      origen:    typeof l.origen == 'string' ? l.origen.slice(0,500) : '',
      fuentes:   normalizarFuentes(l.fuentes).slice(0,20),
      color:     BOOK_COLORS.includes(l.color) ? l.color : BOOK_COLORS[0]
    }
    // fuente corrupta (sin título o enlace no http(s)) → solo se descarta ella (RNF-3)
```

Duplicados (E1): `validarNombreLibro` compara `nombre.trim().toLowerCase()` contra
todos los libros salvo `excluirId`; se aplica **al crear y al renombrar** con el mismo
mensaje. Contraste: `colorTextoLibro` calcula luminancia del hex y elige tinta con
contraste ≥ 4.5:1 (texto) — el icono es decorativo (`aria-hidden`), nunca sustituye al
nombre (RF-2).

### 3.2 Archivar al eliminar (RF-16–RF-18, INV-1–INV-3)

```
función archivarLibro(libros, entradas, archivo, libroId, ahora):
    libro = libros.find(id == libroId); si !libro: devolver {libros, entradas, archivo}
    delLibro = entradas.filter(e.libroId == libroId)
    nuevosRegistros = delLibro.map(e => ({
        libroId,                                   // solo referencia histórica
        archivadoEn: ahora,                        // marca local del borrado
        sesiones: normalizarSesiones(getSesiones(e))  // solo fecha+minutos; sin título
    }))
    devolver {
      libros:   libros.filter(id != libroId),
      entradas: entradas.filter(e.libroId != libroId),
      archivo:  [...archivo, ...nuevosRegistros]   // INV-1: ninguna sesión desaparece
    }
    // INV-2: las métricas leen entradas+huella, nunca el libro (ver 3.3).
    // INV-3: nombre/contenido/origen/fuentes no se copian a ningún sitio.
```

Eliminar entrada suelta no toca `archivo` (D-3, P-1). La importación reemplaza
libros + entradas + metas + huella a la vez (aviso actual intacto).

### 3.3 Métricas con huella, specs 001/002 intactas (RF-17, RNF-1)

```
función combinarParaMetricas(entradas, archivo = []):
    seudo = (archivo ?? []).flatMap(r => [{ id: 'huella:' + r.libroId + ':' + r.archivadoEn,
                                            sesiones: r.sesiones }])
    devolver [...entradas, ...seudo]

 // Cada métrica existente hace, como primera línea:
entradasEfectivas = combinarParaMetricas(entradas, archivo)
 // …y sigue con su algoritmo actual sin tocarlo (racha, minutos semana, días,
 // computeDiasEstudio → mapa 001, resumenMetas → metas/perfectas/fuegos 002).
 // «Entradas de hoy», listas, búsqueda y resumenLibro NO usan esta combinación (RF-18).
```

Verificación del invariante (criterio 2): con datos reales, anotar las 8 métricas
antes y después de borrar un libro con entradas — deben ser idénticas; con el único
libro borrado, Hoy dice «Hoy aún no has estudiado.» pero racha/días/mapa no cambian.

### 3.4 Estado de fichas, tabs y confirmación (RF-4–RF-7, RF-15–RF-16)

```
ficha = { abierta: null, opcion: 'entradas', confirmando: false, busqueda: '' }
ALTERNAR(id): abierta==id ? {abierta:null,…} : {abierta:id, opcion:'entradas', confirmando:false}
OPCION(t):    {…ficha, opcion:t, confirmando:false}            // cambiar de tab limpia el borrado
CONFIRMAR:    {…ficha, confirmando:true}                       // frase exacta + detalle + Sí/Cancelar
Escape/CANCELAR: {…ficha, confirmando:false} + foco a «Eliminar libro»
BORRADA:      {abierta:null, opcion:'entradas', confirmando:false} // + foco a ficha siguiente/anterior o «+ Nuevo libro»
```

Foco: abrir/cerrar no mueve el foco (queda en el botón); `Tab` entra al panel en orden
natural; tabs con flechas ←/→ e Inicio/Fin (`tab`/`tabpanel`, `aria-selected`);
errores de formulario con `aria-live` + foco al primer campo erróneo; RF-10 (ir desde
Hoy): abre Libros con esa ficha en Entradas y la entrada visible; libro inexistente →
no cambia de pestaña, sin error. RF-7 (libro nuevo): ficha abierta en Entradas + foco
en el título de la entrada.

## 4. Cómo se pinta en la interfaz

- **Rejilla de fichas (RF-1–RF-3)**: `#books-list` pasa a `grid` (1 col <640, 2 col
  640–1019, 3 col ≥1020). Cada ficha es un `button` con icono-libro CSS (cubierta del
  color + cinta translúcida del mismo color + inicial en tinta de contraste),
  nombre completo, «N entradas · M min» (solo activas). Orden de más antigua a más
  reciente. Vacío: solo «No hay libros todavía.» + «Crear primer libro» (RF-3).
- **Panel inline (RF-4–RF-6, RNF-8)**: al desplegar, el panel ocupa el ancho completo
  del contenedor justo bajo la fila de su ficha (técnica: el panel es un hermano en
  la rejilla con `grid-column: 1 / -1`, o reordenación por filas en JS — sin celdas
  vacías ni reordenar libros; el orden ficha→panel→resto se mantiene para el lector).
  Animación 220 ms abrir / 180 ms cerrar (altura + opacidad, sin rebote); una sola
  animación por acción, sin cascadas al cargar. Estado de sesión: se conserva al
  cambiar de pestaña/redimensionar; recarga → todo cerrado; abrir resetea a Entradas.
- **Tabs (RF-5, RNF-7)**: `tablist` con etiquetas cortas **Entradas / Fuentes /
  Editar** (nombres largos solo para lector: «Fuentes de estudio», «Editar libro»);
  cambio con fundido 160 ms + 6 px; `Tab` entra/sale, flechas se mueven entre tabs.
- **Entradas (RF-8–RF-10)**: mismo formato/acciones/buscador/validaciones que hoy;
  «+ Añadir entrada» despliega el formulario (200 ms). Búsqueda solo del libro abierto
  y se limpia al abrir otro. Desde Hoy: deep-link a la ficha + entrada (RF-10).
- **Fuentes (RF-11–RF-12)**: icono grande + nombre + color + nº entradas + minutos +
  fecha de creación; `contenido` y `origen` como texto literal (con saltos, sin HTML);
  lista de fuentes con enlace en pestaña nueva (`target="_blank" rel="noopener"` +
  aviso al lector). Vacíos en singular/plural que invitan a Editar.
- **Editar (RF-13–RF-16)**: nombre (40, único), color (paleta de 8), contenido/origen
  (2×500 con contador), fuentes (añadir/editar/quitar una a una, límite 20 con botón
  desactivado + aviso; enlaces repetidos OK). «Eliminar libro» al final, separado
  visualmente → confirmación inline (180 ms) con frase exacta
  «¿Estás seguro de eliminar el libro?» + «Se eliminarán N entradas, su contenido,
  su origen y sus enlaces.» + «Sí, eliminar»/«Cancelar»; `Escape` cancela y devuelve
  el foco. Al confirmar: la ficha sale (200 ms, opacidad + 8 px), aviso
  «Libro eliminado.», foco a la ficha siguiente/anterior o al estado vacío.
- **Rótulos y anchos (RNF-8, RNF-10)**: todo en español con singular/plural; texto de
  usuario siempre con `textContent`; URLs largas abreviadas visualmente
  (`ellipsis`, copiables); sin scroll horizontal desde 320 px; 320/375/1020/1280
  verificados en navegador. RNF-9: con 50 libros/2000 entradas, abrir/cerrar/cambiar
  de opción <100 ms percibidos, sin reconstruir mapa/carrusel/tira/Hoy ni perder
  scroll/foco (render parcial de la pestaña Libros).

## 5. Decisiones técnicas (y alternativa descartada)

1. **Huella por entrada, no por día ni por libro** (D-1 de la spec). *Descartado*:
   un resumen «minutos por día» — sería un derivado guardado (rompe RNF-1 y el
   principio de no guardar contadores de 002) y perdería el `numEntradas` por día
   que necesita el detalle del mapa; y *descartado* marcar entradas como
   «archivadas» — conserva contenido que el usuario quiere borrar y basta olvidar
   un filtro para que reaparezca.
2. **Combinar con pseudo-entradas** (`combinarParaMetricas`) en vez de reescribir
   cada métrica. *Descartado*: añadir lógica de huella dentro de `computeStreak`,
   `computeDiasEstudio`, `resumenMetas`… — duplicaría el mismo bucle en 8 sitios y
   cualquier métrica futura nacería sin huella; con un único puente, 001/002 quedan
   intactos y los 64 tests actuales pasan sin cambios.
3. **2.º parámetro opcional `archivo = []`** en las métricas. *Descartado*: romper
   las firmas — obligaría a reescribir los 64 tests y todo llamador; con defecto
   `[]`, lo antiguo sigue funcionando y lo nuevo pasa la huella.
4. **Una sola ficha abierta** (D-4). *Descartado*: varias abiertas — en móvil, lista
   interminable con saltos de scroll y decisiones de foco innecesarias.
5. **Panel a ancho completo bajo su fila** con `grid-column: 1 / -1`. *Descartado*:
   detalle en columna lateral o página aparte — rompe el móvil y devuelve el patrón
   «lista + detalle lejos» que la spec quiere eliminar; *descartado* modal — pierde
   el contexto del estante.
6. **Confirmación inline con frase exacta** (D-6, RF-15). *Descartado*: `confirm()`
   nativo — bloqueante, sin estilos, sin detalle ni animación ni `Escape` gestionado;
   unificar «Eliminar entrada» queda como E-2, fuera de alcance.
7. **Crear solo con nombre + color** (D-5). *Descartado*: pedir contenido/fuentes al
   crear — fricción en el paso más frágil (primer libro) y formulario largo en móvil.
8. **Tabs dentro de la ficha** (D-8), no acordeón anidado. *Descartado*: dos niveles
   de desplegable — saltos de página en móvil y pérdida del nivel actual.
9. **Icono CSS decorativo + inicial con contraste calculado** (D-7). *Descartado*:
   emoji o imagen — color dependiente del SO / nueva dependencia (P1); *descartado*
   texto siempre blanco — falla 4.5:1 sobre amarillos claros.
10. **Estado de ficha solo en sesión** (no persiste). *Descartado*: guardarlo en
    `localStorage` — al recargar, el usuario espera el estante cerrado (RF-6) y se
    evita migrar otro campo.
11. **Migración normalizando, nunca perdiendo** (P5, RNF-3): libros sin
    `contenido`/`origen`/`fuentes` → `''`/`''`/`[]`; fuente sin `id` → se genera;
    fuente corrupta → solo ella se descarta; sin `archivo` → `[]`; export `version: 3`;
    import de `version: 2` o anterior sigue válido y reemplaza también la huella.
    *Descartado*: rechazar el JSON antiguo — perdería datos del usuario.

## 6. Estrategia de tests (`node --test`)

Comando: `node --test` desde la raíz (Node 24; auto-descubre `tests/`; la ruta con
espacios rompe `node --test tests/`). Solo funciones puras; lo visual se verifica en
el navegador con Chrome DevTools, previa aprobación del usuario (P4, criterio 1).
Archivo nuevo `tests/libros.test.js` (los 64 actuales —19 mapa + 45 metas— deben
seguir en verde sin cambios). Helper `mkLibro()` + `mkEntrada(sesiones)` como en
`tests/metas.test.js`.

| Bloque | Casos | RF |
|---|---|---|
| `normalizarLibro` / `normalizarFuentes` | Sin `contenido`/`origen`/`fuentes` → `''`/`''`/`[]`; textos >500 recortados; color raro → primer color; libro sin `id` → `null` sin perder el resto; fuente sin `id` → se genera; `null`/no-array → `[]`. | RNF-3 |
| `normalizarFuente` (descarte fino) | Título vacío/solo-espacios/>60 → `null`; enlace `javascript:`/`mailto:` → `null`; sin esquema `www.x.com` → `https://…`; >500 → `null`; el resto de fuentes del libro sobrevive. | RF-14, RNF-3 |
| `normalizarUrlFuente` | Completa esquema ausente; acepta `http/https`; rechaza otros esquemas con el mensaje «El enlace debe empezar por http:// o https://»; rechaza >500 y espacios internos. | RF-14 |
| `validarNombreLibro` | Vacío y >40 → error; duplicado `trim().toLowerCase()` (incl. « mate » vs «Mate») → «Ya tienes un libro con ese nombre» al crear y al renombrar; el propio libro excluido al renombrar sin cambios. | RF-7, RF-13, E1 |
| `inicialLibro` / `colorTextoLibro` | Inicial: espacios, acentos («Álgebra»→«Á»), no-latina; contraste: tinta legible sobre los 8 colores (≥4.5:1), amarillos claros → tinta oscura. | RF-2, RNF-7 |
| `normalizarArchivo` | Sin campo → `[]`; registro corrupto (sesiones no-array, fecha no-string) se descarta sin perder el resto; sesiones agrupadas por fecha. | RNF-3 |
| `archivarLibro` | Libro con 2 entradas (varias sesiones) → visible vacío + 2 registros solo `{libroId, archivadoEn, sesiones}` (sin título/contenido); sin entradas → huella intacta; no muta los arrays originales. | RF-16–RF-18, RNF-1 |
| Invariantes INV-1/INV-2/INV-3 | Sesiones(entradas)+sesiones(huella) antes == después (INV-1); métricas con `combinarParaMetricas` idénticas exista o no el libro (INV-2); ningún nombre/contenido/origen/url sobrevive en `archivo` (INV-3). | RNF-2 |
| Métricas con huella | `computeStreak`, `computeWeeklyMinutes`, `computeStudyDays`, `computeDiasEstudio`, `modeloMapa`, `resumenMetas` (metas/perfectas/fuegos/guía) con `archivo`: racha 6 + 4 metas intactas tras borrar; día solo-de-huella sigue coloreado y contando; «Entradas de hoy» y `resumenLibro` ignoran la huella. | RF-17, §6.2 |
| `transicionFicha` | Alternar abre/cierra; abrir otra pliega la anterior y resetea a Entradas; cambiar de opción limpia `confirmando`; `Escape`/cancelar cierra la confirmación. | RF-4–RF-6, RF-15 |
| `puedeAnadirFuente` / `resumenLibro` | 19 → `true`, 20 → `false` (botón desactivado); contador solo con activas. | RF-1, RF-14, RF-18 |
| Migración version 3 | `loadState`/`validateImportedData` con JSON `version: 2` y sin `metas`/`contenido`/`origen`/`fuentes`/`archivo` → todo normalizado, métricas iguales; export marca `version: 3` e incluye la huella. | RNF-3 |

Verificación manual adicional (con aprobación): invariante de rachas con datos reales
antes/después de borrar (incluido el único libro); recorrido solo-teclado
(`aria-expanded`, tabs con flechas, `Escape`, foco a ficha siguiente/estado vacío);
frase exacta de confirmación; animaciones RNF-5 + `reduced-motion`; 320/375/1020/1280
sin scroll horizontal; export/import con huella; consola sin errores nuevos.

## 7. Cobertura de requisitos

| RF | Función pura (§2) | Algoritmo (§3) | Interfaz (§4) | Tests (§6) |
|---|---|---|---|---|
| RF-1 Ficha | `resumenLibro`, `inicialLibro` | — | rejilla + icono + «N entradas · M min» | ✔ |
| RF-2 Icono CSS + contraste | `inicialLibro`, `colorTextoLibro` | §3.1 | icono decorativo `aria-hidden` | ✔ |
| RF-3 Vacío sin libros | — | — | solo estado vacío | navegador* |
| RF-4 Abrir/plegar, una abierta | `transicionFicha` | §3.4 | botón + `aria-expanded`, 220/180 ms | ✔ + navegador* |
| RF-5 Tres tabs Entradas/Fuentes/Editar | `transicionFicha` | §3.4 | `tablist`, fundido 160 ms | ✔ + navegador* |
| RF-6 Estado de sesión | `transicionFicha` | §3.4 | conserva al cambiar de pestaña; recarga cierra | navegador* |
| RF-7 Libro nuevo abierto en Entradas | `validarNombreLibro` | §3.4 | foco en título de entrada | ✔ + navegador* |
| RF-8 Entradas como hoy | — (reutiliza actual) | — | mismo formato + «+ Añadir entrada» | navegador* |
| RF-9 Búsqueda por libro | — | — | mensaje + limpiar; se limpia al cambiar | navegador* |
| RF-10 Ir desde Hoy | — | §3.4 | deep-link; libro inexistente sin error | navegador* |
| RF-11 Fuentes + contenido/origen | `normalizarFuente` | — | panel Fuentes, enlace en pestaña nueva | ✔ + navegador* |
| RF-12 Vacíos de Fuentes | — | — | mensajes singular/plural | navegador* |
| RF-13 Editar (nombre único, 2×500) | `validarNombreLibro`, `normalizarLibro` | §3.1 | form Editar, guardado instantáneo | ✔ + navegador* |
| RF-14 Fuentes (url, 20) | `normalizarUrlFuente`, `normalizarFuente`, `puedeAnadirFuente` | §3.1 | CRUD inline + aviso de límite | ✔ + navegador* |
| RF-15 Confirmación exacta | `transicionFicha` | §3.4 | frase exacta + detalle + `Escape` | ✔ + navegador* |
| RF-16 Borrado + foco + aviso | `archivarLibro` | §3.2, §3.4 | salida 200 ms, «Libro eliminado.» | ✔ + navegador* |
| RF-17 Métricas intactas | `sesionesTodas`, `combinarParaMetricas` | §3.3 | Hoy vacío pero racha/mapa iguales | ✔ + navegador* |
| RF-18 Huella invisible | `combinarParaMetricas` (solo métricas), `resumenLibro` | §3.3 | fuera de listas/búsqueda/contadores | ✔ |
| RF-19 Recálculo sin perder fichas | — (usa `render()` parcial) | — | render parcial Libros | navegador* |
| RNF-1 Derivados + huella mínima | `archivarLibro`, `sesionesTodas` | §3.2–§3.3 | recálculo en cada acción + cambio de semana | ✔ |
| RNF-2 Invariantes | — | §3.2 | — | ✔ |
| RNF-3 Migración + v3 | `normalizarLibro`, `normalizarArchivo` | §5.11 | export/import con huella | ✔ + navegador* |
| RNF-4 Puras + tests | todas (§2) | — | `module.exports` | ✔ |
| RNF-5 Animaciones | — | — | duraciones exactas, 1 por acción | navegador* |
| RNF-6 Reduced-motion | — | — | 0 ms sin transformaciones | navegador* |
| RNF-7 A11y | `colorTextoLibro` | §3.4 | button+tabs, foco, 4.5:1/3:1 | ✔ + navegador* |
| RNF-8 Responsive 1/2/3 | — | — | grid + panel `1/-1`, 320 sin scroll | navegador* |
| RNF-9 Rendimiento | — | — | render parcial, <100 ms | navegador* |
| RNF-10 Español + textContent | — | — | textos + `ellipsis` en URLs | navegador* |

\* navegador = verificación con Chrome DevTools, previa aprobación del usuario
(constitución P4, criterio de finalización 1 de la spec).
