# Spec 003 — Libros mejorados (fichas desplegables, fuentes de estudio y borrado que no rompe rachas)

**Estado:** aprobada por el usuario (15 oct 2026). Enmienda E1: `contenido` partido en `contenido` + `origen`
(2×500); nombres duplicados bloqueados; P-1–P-5 aceptadas con la recomendación.
**Fecha:** 15 oct 2026 · **Autor:** @planner
**Nombre de carpeta:** `specs/003-better-books/` (el número 003 es el siguiente libre; se mantiene el
nombre corto en inglés de 001/002 y la carpeta ya creada en `specs/`).

## 1. Contexto y objetivo

La pestaña **Libros** hoy es una lista plana (`nombre + punto de color + nº de entradas`) con una vista
de detalle aparte: el usuario selecciona un libro y aparece, más abajo, su cabecera con «Renombrar» /
«Eliminar libro», el formulario de entrada y la lista de entradas. Un libro es solo *nombre + color*:
no hay sitio donde anotar **de dónde viene el contenido de estudio** ni enlaces a ese material.

Objetivos de esta spec:

1. **Cada libro es una ficha reconocible**: un icono de libro dibujado con *su* color, su nombre, sus
   entradas y sus minutos; la pestaña se lee como un estante.
2. **El libro se despliega** con una animación y muestra sus opciones ahí mismo: **Entradas**,
   **Fuentes de estudio** y **Editar libro**. Se acaba el patrón «lista + detalle lejos de la lista».
3. **El libro gana contenido propio**: textos de contenido y origen (2×500) y una lista de **fuentes**
   (título + enlace) que el usuario puede añadir, editar y quitar.
4. **Eliminar un libro borra su contenido, su origen, sus fuentes y sus entradas, pero *no* la huella de estudio**:
   racha actual, racha más larga, minutos de la semana, días estudiados, mapa de calor, metas semanales
   y semanas perfectas quedan **exactamente igual** antes y después de borrar.
5. Todo sigue la estética «hoja de papel», es responsive (móvil primero) y accesible por teclado, con
   animaciones medidas y respetando `prefers-reduced-motion`.

**No se rompe nada de las specs anteriores**: el mapa de calor (001) y las metas y rachas semanales
(002) siguen calculándose desde las sesiones con las mismas definiciones; esta spec solo cambia *de
dónde salen las sesiones que se les pasan* (entradas activas **más** la huella archivada, ver §6).

### Por qué ahora
El borrado de un libro es hoy el único punto de la app que destruye historial: al eliminar el libro
también desaparecen sus entradas y, con ellas, días estudiados, minutos y semanas que sostienen la
racha y las metas. El usuario pide explícitamente que eso no ocurra, así que el cambio exige decidir
primero **qué es dato del usuario y qué es huella de estudio** (ver §7, D-1).

## 2. Glosario

- **Libro**: cuaderno de estudio con `nombre`, `color`, `contenido`, `origen` y `fuentes`.
- **Entrada**: registro de estudio de un libro (título, contenido, `sesiones`). Ver specs 001 y 002.
- **Sesión**: `{fecha, minutos}` dentro de una entrada; la unidad con la que se calcula todo lo temporal.
- **Contenido de estudio del libro**: texto libre (qué se estudia: temario, capítulos, notas generales).
- **Origen del contenido**: texto libre (de dónde viene: manual, curso, apuntes de clase).
- **Fuente de estudio**: enlace con título que apunta al material (vídeo, PDF, web). Un libro tiene de
  0 a 20 fuentes.
- **Huella de estudio (archivo)**: copia mínima de las sesiones de un libro eliminado
  (`{libroId, archivadoEn, sesiones}`), sin título ni contenido ni fuentes. Es lo que mantiene intactas
  las rachas y las estadísticas.
- **Ficha**: la tarjeta desplegable de un libro en la pestaña Libros.
- **Opción**: cada uno de los tres paneles de una ficha abierta (Entradas, Fuentes de estudio, Editar).
- **Estado de ficha**: `cerrada` | `abierta`, más la opción activa de la ficha abierta.

## 3. Usuarios e historias de usuario

Usuaria única, móvil y ocasionalmente escritorio (usuarios de specs 001 y 002).

- **HU-1**: Como usuario con varios libros, quiero reconocer cada uno de un vistazo por su icono y su
  color, para no confundirlos.
- **HU-2**: Como usuario, quiero desplegar un libro y ver sus opciones sin perder de vista los demás
  libros, para no navegar entre dos pantallas.
- **HU-3**: Como usuario, quiero guardar de dónde viene el material que estudio (temario y enlaces),
  para no perder las referencias del libro.
- **HU-4**: Como usuario, quiero añadir entradas desde el propio libro desplegado, como hasta ahora.
- **HU-5**: Como usuario, quiero corregir el nombre, el contenido, el origen y los enlaces de un libro cuando me
  equivoque o cambie de material.
- **HU-6**: Como usuario, quiero eliminar un libro que ya no uso sin perder mi racha, mis días
  estudiados ni mis metas, porque el esfuerzo ya está hecho.
- **HU-7**: Como usuario de teclado o lector de pantalla, quiero desplegar, recorrer y editar un libro
  sin usar el ratón.

## 4. Requisitos funcionales (EARS)

### Ficha y estado de la pestaña Libros

**RF-1 (ubicuo)** — El sistema mostrará cada libro creado como una **ficha** con (a) un icono de libro
dibujado en el color del libro, (b) el nombre completo, (c) el número de entradas y (d) los minutos
totales del libro. Las fichas se ordenarán de más antigua a más reciente, como hoy.
> Dado un libro «Álgebra» verde con 3 entradas y 90 minutos, cuando abro la pestaña Libros, entonces veo
> una ficha con un libro verde, «Álgebra» y «3 entradas · 90 min».

**RF-2 (ubicuo)** — El sistema dibujará el icono sin imágenes ni fuentes de iconos externas: cubierta
del color del libro, cinta adhesiva translúcida del mismo color y la inicial del nombre sobre la
cubierta, en tinta oscura o blanca según el contraste (constitución P1 y P6). El icono será
decorativo para los lectores de pantalla y no sustituirá al nombre.
> Dado un libro «Yoga», entonces su icono muestra una «Y» legible sobre el color del libro.

**RF-3 (según estado)** — Mientras no exista ningún libro, el sistema mostrará el estado vacío actual
(«No hay libros todavía.» + botón «Crear primer libro»), sin fichas ni huecos de fichas.
> Dado un usuario nuevo, cuando abre Libros, entonces ve el estado vacío y ninguna cuadrícula.

**RF-4 (dirigido por evento)** — Cuando el usuario active una ficha (pulsación, `Enter` o `Espacio`), el
sistema desplegará el panel de ese libro con una animación (RNF-5) y con la opción **Entradas** activa.
Volver a activar la misma ficha lo plegará. Como máximo habrá **una ficha abierta**: al abrir otra, la
anterior se pliega (ver D-4). La ficha activa anuncia su estado con `aria-expanded` (RNF-7).
> Dado el libro A abierto, cuando activo el libro B, entonces B se despliega en Entradas y A se pliega.

**RF-5 (ubicuo)** — El panel de un libro abierto ofrecerá tres opciones excluyentes, siempre en este
orden y con estas etiquetas visibles cortas: **Entradas**, **Fuentes**, **Editar** (nombre largo solo
para lectores de pantalla: «Entradas», «Fuentes de estudio», «Editar libro»). El sistema mostrará el
contenido de la opción activa y no cambiará la altura de la ficha más de lo necesario.
> Dado un libro abierto, cuando pulso «Fuentes», entonces el panel muestra sus fuentes y Entradas deja
> de estar visible.

**RF-6 (ubicuo)** — El sistema conservará el estado de las fichas durante la sesión: al cambiar de
pestaña, al redimensionar o al girar el dispositivo se mantienen la ficha abierta y su opción activa;
al recargar la app, todas las fichas empiezan cerradas. Al abrir una ficha, su opción activa vuelve
siempre a Entradas.
> Dado un libro abierto en Fuentes, cuando voy a Hoy y vuelvo, entonces sigue abierto en Fuentes.

**RF-7 (dirigido por evento)** — Cuando se cree un libro nuevo (solo con nombre y color, ver D-5; el
nombre es único con la misma regla de RF-13 y el contenido/origen empiezan vacíos), el
sistema lo dejará **abierto en Entradas** y con el foco en el campo de título de la nueva entrada.
> Dado que guardo un libro «Física», entonces veo su ficha abierta en Entradas y puedo escribir la
> primera entrada sin tocar nada más.

### Opción 1 — Entradas

**RF-8 (ubicuo)** — La opción Entradas mostrará las entradas del libro de más reciente a más antigua,
con el mismo formato y las mismas acciones que hoy («Seguir estudiando este tema», «Corregir tiempo»,
«Eliminar»), el buscador por título o contenido, y un botón **«+ Añadir entrada»** que despliega el
formulario de nueva entrada (título obligatorio, contenido, minutos > 0) con las mismas validaciones,
mensajes de error y fecha local de hoy que hoy.
> Dado un libro sin entradas, cuando abro Entradas, entonces veo «Aún no hay entradas en este libro.»
> y el botón «+ Añadir entrada».

**RF-9 (según estado)** — Mientras la búsqueda no encuentre coincidencias, el sistema mostrará el
mensaje de «sin resultados» y el botón para limpiarla, como hoy. La búsqueda se aplica solo al libro
abierto y se limpia al abrir otro libro.
> Dado «trigo» sin coincidencias en «Álgebra», entonces veo «No se encontraron entradas con ese
> criterio de búsqueda.» y puedo limpiar la búsqueda.

**RF-10 (dirigido por evento)** — Cuando el usuario pulse una entrada del listado «Entradas de hoy» de
la pestaña Hoy, el sistema abrirá la pestaña Libros con ese libro desplegado en Entradas y su entrada
visible. Si el libro ya no existe (fue eliminado), no cambiará de pestaña y no mostrará error.
> Dado que hoy estudié «Derivadas» en «Cálculo», cuando pulso esa entrada en Hoy, entonces Libros se
> abre con «Cálculo» desplegado y «Derivadas» en la lista.

### Opción 2 — Fuentes de estudio

**RF-11 (ubicuo)** — La opción Fuentes mostrará los datos del libro —icono en tamaño mayor, nombre,
color, número de entradas, minutos totales y fecha de creación—, el **contenido de estudio**, el
**origen** (de dónde viene) y la lista
de **fuentes** con su título y su enlace. Cada enlace se abrirá en una pestaña nueva y anunciará ese
comportamiento al lector de pantalla.
> Dado un libro con contenido «Curso de JS, capítulos 1–12», origen «Manual X» y una fuente «MDN – Array», entonces veo los dos
> textos y un enlace «MDN – Array» que abre el material en una pestaña nueva.

**RF-12 (según estado)** — Mientras un libro no tenga contenido de estudio, origen o fuentes, el
sistema mostrará en su lugar mensajes de vacío que inviten a añadirlos desde Editar, en singular y
plural correctos.
> Dado un libro recién creado, cuando abro Fuentes, entonces leo «Este libro aún no tiene fuentes de
> estudio.» y «Añádelas desde la opción Editar.».

### Opción 3 — Editar libro

**RF-13 (ubicuo)** — La opción Editar permitirá modificar el **nombre** (obligatorio, máximo 40
caracteres, único: se compara sin mayúsculas ni espacios de más y si ya existe otro libro con el mismo
nombre muestra «Ya tienes un libro con ese nombre» y no guarda), el **color** (misma paleta de 8 colores de hoy), el **contenido de estudio** (opcional,
máximo 500 caracteres) y el **origen** (opcional, máximo 500 caracteres). Los cambios se guardan y se ven al instante en la ficha, en el panel y en las
demás pestañas; cancelar deja los datos como estaban.
> Dado que cambio el nombre de «Mate» a «Matemáticas» y guardo, entonces la ficha muestra
> «Matemáticas» sin recargar.

**RF-14 (ubicuo)** — La opción Editar permitirá gestionar las **fuentes** del libro: añadir (título
obligatorio de hasta 60 caracteres + enlace), editar el título o el enlace de una fuente existente y
eliminar fuentes de una en una. Un enlace se acepta solo si es `http` o `https`; si el usuario lo
escribe sin esquema (`www.x.com`), el sistema lo completará con `https://`; cualquier otro esquema
(por ejemplo `javascript:` o `mailto:`) se rechaza con un error claro. Habrá un máximo de 20 fuentes
por libro y, al alcanzarlo, el botón de añadir se desactivará con un aviso. Se admiten enlaces
repetidos.
> Dado que añado la fuente «MDN» con `www.mozilla.org`, entonces se guarda como
> `https://www.mozilla.org`. Dado que escribo `javascript:alert(1)`, entonces veo «El enlace debe
> empezar por http:// o https://» y no se guarda.

**RF-15 (dirigido por evento)** — Cuando el usuario pulse **«Eliminar libro»** (dentro de Editar, al
final y visualmente separado del resto), el sistema pedirá confirmación **en la propia ficha**, sin
diálogos del navegador, con la pregunta exacta «¿Estás seguro de eliminar el libro?» y el detalle de
lo que se borra (nº de entradas, contenido, origen y enlaces), más los botones «Sí, eliminar» y «Cancelar».
`Escape` cancela la confirmación y devuelve el foco al botón «Eliminar libro» (ver D-6).
> Dado un libro con 5 entradas, cuando pulso «Eliminar libro», entonces leo «¿Estás seguro de eliminar
> el libro?» y que se eliminarán 5 entradas, su contenido, su origen y sus enlaces.

**RF-16 (dirigido por evento)** — Cuando el usuario confirme el borrado, el sistema eliminará el libro,
su contenido, su origen, sus fuentes y sus entradas de todo lo visible y editable, y conservará sus sesiones como
huella de estudio (RF-17, §6). La ficha desaparecerá con una animación breve y el foco pasará a la
ficha siguiente (o anterior) y, si no queda ninguna, al botón «+ Nuevo libro» / estado vacío. Se
mostrará un aviso («Libro eliminado.») igual que en el resto de acciones.
> Dado que confirmo el borrado del último libro, entonces la pestaña muestra el estado vacío, el foco
> está en «Crear primer libro» y mi racha sigue igual.

### Huella de estudio: rachas intactas

**RF-17 (ubicuo)** — Al eliminar un libro, el sistema conservará sus sesiones (solo fecha y minutos) en
la huella de estudio y calculará **todas** las métricas temporales sobre las entradas activas más la
huella: racha actual, racha más larga, minutos de la semana, días estudiados, mapa de calor, metas
semanales, semanas perfectas y el fuego 🔥. Los valores serán idénticos antes y después del borrado.
> Dado racha 6 y 4 metas cumplidas, cuando elimino el libro donde estudié los últimos 3 días, entonces
> la racha sigue siendo 6 y las metas cumplidas siguen siendo 4. Dado que era el único libro, entonces
> Hoy muestra «Hoy aún no has estudiado.» pero la racha, los días estudiados y el mapa no cambian.

**RF-18 (ubicuo)** — La huella de estudio no aparecerá en ninguna parte de la interfaz: no sale en
«Entradas de hoy», ni en la lista de entradas, ni en la búsqueda, ni en los contadores de ningún libro,
y no es editable ni consultable (ver §9). Su nombre, su contenido, su origen y sus enlaces no se guardarán.
> Dado un libro eliminado cuyas sesiones sostienen el mapa, cuando busco su título, entonces no
> aparece ningún resultado.

**RF-19 (ubicuo)** — El sistema recalculará las métricas al guardar, editar, corregir o eliminar una
entrada, al crear o eliminar un libro, al editar el contenido, el origen o las fuentes de un libro y al importar
datos, sin recargar la app y sin perder el estado de las fichas (RF-6).
> Dado un libro abierto en Entradas, cuando añado una entrada, entonces la ficha sigue abierta y las
> estadísticas se actualizan.

## 5. Requisitos no funcionales

**RNF-1 — Datos derivados, huella mínima.** Las métricas de estudio no se guardan como contadores: se
derivan de las sesiones. La huella de estudio guarda sesiones (fecha y minutos), nunca totales,
rachas ni resúmenes. Es la única concesión al principio «no guardar nada aparte» de la spec 002 y se
justifica en D-1.

**RNF-2 — Invariantes (comprobables con tests).**
- **INV-1**: el conjunto de sesiones de la huella más el de las entradas activas es igual al conjunto
  de sesiones registrado desde el inicio de los datos: borrar un libro no hace desaparecer ninguna
  sesión.
- **INV-2**: ninguna métrica temporal (racha actual, racha más larga, minutos de la semana, días
  estudiados, mapa de calor, metas semanales, semanas perfectas) depende de que el libro al que
  pertenecían esas sesiones siga existiendo.
- **INV-3**: el nombre, el contenido, el origen y las fuentes de un libro eliminado no se conservan en ningún
  sitio del almacenamiento.

**RNF-3 — Compatibilidad y migración.** Ante datos guardados de versiones anteriores: los libros sin
`contenido`, sin `origen` o sin `fuentes` se normalizan con textos vacíos y sin fuentes; la ausencia de huella de
estudio se normaliza como huella vacía; las fuentes corruptas (sin título o con enlace no `http/https`)
se descartan una a una sin perder el libro ni el resto de sus fuentes; a cada fuente sin identificador
se le asigna uno. **Nunca se pierde un dato del usuario por este cambio** (constitución P5). La
exportación lleva la huella de estudio y sube a `version: 3`; la importación de un JSON de cualquier
versión anterior sigue siendo válida y reemplaza también la huella de estudio.

**RNF-4 — Lógica pura y tests.** La normalización de libros y fuentes, la validación y normalización de
enlaces, el contraste del texto sobre el color del libro, el archivado de las sesiones al eliminar un
libro y el cálculo de las métricas con la huella serán funciones puras (reciben los datos y «hoy» como
parámetros, sin tocar el DOM) con tests en `tests/` ejecutables con `node --test`, sin instalar nada
(constitución P3 y P4). Los tests existentes (64 a día de hoy) deben seguir pasando.

**RNF-5 — Animaciones.** Una sola animación por acción, sin cascadas al cargar la lista:
- desplegar el panel: 220 ms (altura + opacidad, salida suave, sin rebote); plegar: 180 ms;
- cambio de opción dentro de la ficha: 160 ms (fundido cruzado + 6 px de desplazamiento);
- despliegue del formulario de entrada y de la confirmación de borrado: 200 / 180 ms;
- cinta de la ficha y ligero realce al abrir: 200 ms;
- respuesta a puntero fino (hover/active): 120 ms, elevación máxima de 1 px;
- borrado de la ficha al confirmar: 200 ms (opacidad + 8 px).
Ninguna animación puede provocar saltos de scroll ni pérdida de foco.

**RNF-6 — Movimiento reducido.** Con `prefers-reduced-motion: reduce`, todas las animaciones de RNF-5
se vuelven instantáneas (0 ms) y sin transformaciones; el estado final debe ser idéntico y la
interfaz igual de usable.

**RNF-7 — Accesibilidad.**
- Cada ficha es un `button` con `aria-expanded` y `aria-controls` hacia su panel; el panel es una
  región etiquetada con el nombre del libro. Se abandonan los roles `listbox` / `option` que usa hoy
  la lista de libros, porque un `listbox` no admite contenido interactivo dentro de sus opciones.
- Las tres opciones se comportan como pestañas (`tab` / `tabpanel`, `aria-selected`), con `Tab` para
  entrar y salir y flechas izquierda/derecha (e Inicio/Fin) para moverse entre opciones.
- El foco nunca se mueve solo al abrir o cerrar una ficha: permanece en el botón activado. `Tab`
  recorre el panel en orden natural y `Mayús+Tab` lo devuelve a la ficha.
- La confirmación de borrado se anuncia al lector de pantalla; `Escape` cancela y devuelve el foco.
- Los mensajes de error del formulario mantienen el patrón actual (`aria-live` + `aria-describedby`),
  con el foco en el primer campo con error al guardar.
- Contraste mínimo 4.5:1 en texto y 3:1 en bordes de foco, incluido el texto sobre el color del libro.
- Todo el recorrido (abrir, cambiar de opción, añadir y editar una fuente, crear una entrada, eliminar
  un libro) se puede completar solo con teclado y con foco visible.

**RNF-8 — Responsive (móvil primero).**
- Fichas en 1 columna hasta 640 px, 2 columnas de 640 a 1019 px y 3 columnas desde 1020 px, dentro de
  la columna de contenido de siempre (760 px y 960 px desde 1020 px, con la escala tipográfica ya
  existente). Sin scroll horizontal en ningún ancho desde 320 px.
- El panel del libro abierto ocupa el ancho completo del contenedor, justo debajo de la fila de su
  ficha, sin dejar celdas vacías ni reordenar los demás libros: el orden de lectura (ficha → panel →
  resto) se mantiene intacto.
- Los formularios, la lista de entradas, los enlaces y la confirmación de borrado se leen bien a 320 px
  (sin cortar textos; los enlaces largos se abrevian visualmente y siguen siendo copiables).
- Debe verse bien en móvil (375 px), en pantallas de 320 px y en escritorio (1020 px y 1280 px).

**RNF-9 — Legibilidad y rendimiento.** Con 50 libros y 2 000 entradas, abrir o cerrar una ficha y
cambiar de opción se percibe inmediato (<100 ms), sin reconstruir ni hacer parpadear el mapa de calor,
el carrusel, la tira de la semana o «Entradas de hoy», y sin perder el scroll ni el foco.

**RNF-10 — Idioma y seguridad de la interfaz.** Todos los textos en español, con ortografía y
concordancia correctas (singular/plural). El texto del usuario (nombre, contenido, títulos y enlaces)
se inserta siempre como texto, nunca como HTML.

## 6. Modelo de datos y migración

### 6.1 Contrato de datos (clave `diarioEstudio`)

```
{
  libros:   [{ id, nombre, color, creadoEn, contenido, origen, fuentes: [{ id, titulo, url }] }],
  entradas: [{ id, libroId, titulo, contenido, fecha, minutos, sesiones: [{fecha, minutos}] }],
  metas:    [{ dias, desde }],                      // spec 002, sin cambios
  archivo:  [{ libroId, archivadoEn, sesiones: [{fecha, minutos}] }]   // nuevo (huella de estudio)
}
```

- `libros[].contenido`: texto (qué se estudia). Por defecto `''`. Máximo 500 caracteres. Puede llevar saltos de línea.
- `libros[].origen`: texto (de dónde viene). Por defecto `''`. Máximo 500 caracteres.
- `libros[].fuentes`: lista ordenada de 0 a 20 elementos. `titulo` obligatorio (1–60 caracteres);
  `url` obligatoria, `http://` o `https://` (se completa con `https://` si falta el esquema), máximo
  500 caracteres; `id` propio de la fuente, generado al crear o normalizar.
- `archivo[]`: un registro **por entrada eliminada** (así el detalle del mapa de calor conserva el
  número de entradas de cada día). `libroId` queda solo como referencia histórica; `archivadoEn` es la
  marca de tiempo local del borrado; `sesiones` es una copia de las sesiones de esa entrada
  (`fecha` + `minutos`). No guarda `titulo` ni `contenido`: el contenido se borra de verdad (INV-3).
- `fecha` y las fechas de las sesiones siguen siendo texto `"YYYY-MM-DD"` en hora local del
  dispositivo; se reutilizan las funciones de fecha existentes (skill `local-dates`).

### 6.2 Qué se calcula con qué

| Métrica (spec 001/002) | Fuente de las sesiones |
|---|---|
| Racha actual y racha más larga | entradas activas **+** huella |
| Minutos de la semana | entradas activas **+** huella |
| Días estudiados (contador) | entradas activas **+** huella |
| Mapa de calor (días, niveles, años) | entradas activas **+** huella |
| Metas semanales, semanas perfectas, fuegos, guía de la meta | entradas activas **+** huella |
| «Entradas de hoy», listas de entradas, búsqueda, contadores por libro | **solo** entradas activas |

### 6.3 Migración (sin pérdida)

| Dato encontrado | Al cargar / importar |
|---|---|
| Libro sin `contenido` | se añade `contenido: ''` |
| Libro sin `origen` | se añade `origen: ''` |
| Libro sin `fuentes` | se añade `fuentes: []` |
| Fuente sin `id` | se le genera uno |
| Fuente con título vacío o enlace no `http(s)` | se descarta solo esa fuente |
| Fuente con enlace sin esquema | se normaliza añadiendo `https://` |
| Datos sin `archivo` | `archivo: []` |
| `archivo` con registros corruptos | se descartan esos registros, no la huella entera |
| Exportación previa (`version: 2`) o anterior | se importa igual; la exportación nueva marca `version: 3` |

Al exportar, la huella de estudio viaja con el resto de los datos. Al importar se reemplaza todo,
huella incluida (coherente con el aviso actual «Al importar se reemplazan todos los datos actuales»).

## 7. Decisiones y supuestos

- **D-1 — Conservar la huella de sesiones (decisión central).** Al borrar un libro se eliminan su
  nombre, su contenido, sus fuentes y sus entradas, pero se conservan sus sesiones (fecha + minutos) en
  la huella. *Alternativa descartada 1*: no conservar nada y aceptar que las rachas cambien — contradice
  la petición. *Alternativa descartada 2*: marcar las entradas como «archivadas» manteniendo las
  entradas con su contenido y filtrarlas en todas las vistas — conserva datos que el usuario quiere
  borrar y basta olvidar un filtro para que contenido eliminado reaparezca. *Alternativa descartada 3*:
  guardar un registro de «días estudiados y minutos por día» — es un resumen duplicado y contradice el
  principio de no guardar derivados; además perdería el número de entradas por día y el detalle del
  mapa. La huella por entrada es el mínimo dato nuevo posible.
- **D-2 — Las métricas temporales incluyen la huella** (RF-17). *Consecuencia aceptada*: un día
  sostenido únicamente por un libro eliminado sigue coloreado en el mapa y cuenta para la racha y las
  metas, mientras que «Entradas de hoy» puede decir que hoy no has estudiado. Es la lectura literal de
  «no se borra nada con respecto a los datos de rachas» (ver pregunta abierta P-2).
- **D-3 — Eliminar una entrada individual no cambia**: sigue descontando sus minutos del historial
  (comportamiento actual). Solo el borrado de un libro conserva la huella. Ver pregunta abierta P-1.
- **D-4 — Una sola ficha abierta** (supuesto). *Por qué*: en móvil evita listas interminables y
  saltos de scroll, y el usuario rara vez compara dos libros a la vez. *Alternativa descartada*:
  varias fichas abiertas — más altura, más ruido y decisiones de foco innecesarias. Ver P-3.
- **D-5 — Al crear un libro solo se piden nombre y color** (supuesto); el contenido y las fuentes se
  añaden después desde Editar, dejando el libro nuevo abierto en Entradas para escribir ya. *Por qué*:
  crear el primer libro es el paso más frágil de un usuario nuevo y conviene que sea de un tirón.
  *Alternativa descartada*: pedir también contenido y fuentes al crear — más fricción y un formulario
  largo en móvil. Ver P-4.
- **D-6 — Confirmación de borrado dentro de la ficha**, no con el diálogo nativo del navegador: permite
  el mensaje exacto pedido, el detalle de lo que se borra, animación, teclado y `Escape`.
  *Alternativa descartada*: `confirm()` nativo, ya usado al eliminar entradas — es bloqueante, no se
  puede estilizar y no admite el detalle del borrado. Unificar ambas confirmaciones queda como
  extensión opcional (E-2).
- **D-7 — El icono es decorativo y dibujado con CSS**: se apoya en el color del libro ya existente y no
  añade dependencias (constitución P1) ni emojis con color dependiente del sistema operativo.
- **D-8 — Las tres opciones son pestañas dentro de la ficha** (no acordeones anidados dentro del
  acordeón). *Por qué*: evita dos niveles de desplegables y mantiene la altura estable; un solo gesto
  cambia de opción. *Alternativa descartada*: dos niveles de acordeón — en móvil provoca saltos de
  página y el usuario pierde de vista en qué nivel está.
- **D-9 — Supuesto de numeración**: 003 es el siguiente número libre tras 001-heat-map y
  002-better-streak; la carpeta `specs/003-better-books/` ya existe y estaba vacía.

## 8. Casos límite

1. **Libro sin nada**: sin entradas, sin contenido y sin fuentes → las tres opciones muestran su
   mensaje de vacío; Editar funciona igual.
2. **Eliminar un libro sin entradas**: la huella no cambia (no se añade ningún registro) y ninguna
   métrica se mueve.
3. **Eliminar el último libro**: estado vacío; racha, días, minutos y mapa intactos (RF-17).
4. **Eliminar el libro abierto**: el panel desaparece con su animación, el foco pasa al siguiente
   libro (o a «Crear primer libro») y no queda ningún foco perdido ni scroll raro.
5. **Eliminar un libro con entradas de hoy**: «Entradas de hoy» vuelve a su estado vacío, pero el
   marcado de hoy en la tira, la racha y el mapa no cambian.
6. **Nombres**: 40 caracteres, sin duplicados (comparación `trim().toLowerCase()`, error «Ya tienes un libro
   con ese nombre» al crear y al renombrar), con acentos o iniciales no latinas (la inicial del
   icono toma el primer carácter distinto de espacio, en mayúscula).
7. **Enlaces**: sin esquema, con esquema raro (rechazado), repetidos (permitidos), de más de 500
   caracteres (rechazado con error), 20 fuentes (límite con aviso), fuente con título de solo espacios
   (rechazada).
8. **Contenido y origen**: 500 caracteres cada uno, con saltos de línea y con URLs o etiquetas escritas a
   mano → se muestran como texto literal.
9. **Cambio de ancho con una ficha abierta** (rotar el móvil, cruzar 640/1020 px): la ficha sigue
   abierta en la misma opción, el foco se conserva y no se pierde la posición del scroll.
10. **Cambio de día a medianoche con una ficha abierta**: no se cierra ni se pierde lo escrito en un
    formulario a medio rellenar.
11. **Importar un JSON antiguo** (sin contenido, sin origen, sin fuentes ni huella): todo se normaliza y las métricas
    coinciden con las de antes de importar. Importar un JSON que contiene un libro eliminado
    anteriormente lo restaura tal cual (la importación reemplaza también la huella).
12. **Fuente con enlace `javascript:` en un JSON importado**: se descarta esa fuente y el libro se
    conserva.
13. **Borrar un libro mientras se edita una de sus entradas** (formulario desplegado): el formulario se
    cierra y no guarda nada después.
14. **Sesión registrada pasada la medianoche, cambio de hora y año bisiesto**: sin tratamiento
    especial; se reutilizan las funciones de fecha actuales (skill `local-dates`) y el mapa sigue sin
    duplicar ni perder días.

## 9. Fuera de alcance (esta versión)

- Ver, buscar, restaurar o borrar la huella de estudio (el «historial» de libros eliminados).
- Deshacer el borrado («Deshacer» en el aviso).
- Buscar, filtrar, ordenar o agrupar libros; etiquetas, carpetas o favoritos.
- Elegir icono o emoji por libro.
- Fuentes compartidas entre libros o una vista global de fuentes.
- Leer, previsualizar o marcar progreso del material enlazado; asociar una sesión a una fuente concreta.
- Mover entradas de un libro a otro.
- Cambiar el borrado de entradas individuales (sigue como hoy).
- Cambios en el mapa de calor, el carrusel, la tira de la semana o el modelo de metas más allá de lo
  que dice esta spec (specs 001 y 002 intactas).
- Sincronización, cuentas o backend (constitución P1).

## 10. Extensiones opcionales (propuestas, no incluidas)

- **E-1 — Deshacer el borrado**: aviso «Libro eliminado.» con «Deshacer» durante unos segundos que
  restaura libro, contenido, fuentes y entradas. *Por qué*: el borrado es destructivo e irreversible y
  el usuario ya pidió una confirmación; encaja bien con el aviso que ya existe.
- **E-2 — Unificar las confirmaciones destructivas**: aplicar el patrón en línea (con `Escape`) también
  a «Eliminar entrada», para que toda la app se comporte igual.
- **E-3 — Icono elegible**: dejar que el usuario elija un glifo para el libro manteniendo el color.
- **E-4 — Vista global de fuentes** en Ajustes: todas las fuentes agrupadas por libro, con buscador.
- **E-5 — Orden y filtro de libros**: por nombre, por uso reciente o por minutos acumulados.
- **E-6 — Historial de estudio** (huella visible) en Ajustes: solo lectura, agrupado por periodo, con
  opción de borrarlo con confirmación.
- **E-7 — Ficha más informativa**: última sesión y media por entrada en la ficha y en Fuentes.
- **E-8 — Del detalle de un día del mapa de calor, ir a las entradas de ese día**.

## 11. Impacto en lo ya escrito

- **Spec 001, RF-9**: el mapa se sigue recalculando al eliminar un libro, pero su resultado deja de
  cambiar (las sesiones permanecen en la huella). Se anotará como enmienda en `specs/001-heat-map/`.
- **Spec 002, RNF-1**: matiz a «no se guardan contadores aparte» — la huella guarda sesiones, no
  resúmenes ni contadores (RNF-1).
- **`AGENTS.md`**: hay que actualizar el modelo de datos (contenido y fuentes del libro, huella de
  estudio) y la regla de borrado de libros.
- **`MEMORY.md`**: se actualizará al cerrar la implementación (decisiones D-1 y D-2 y la regla del
  borrado).

## 12. Criterios de finalización

1. RF-1 a RF-19 verificados en navegador (Chrome DevTools, si el usuario lo aprueba) en móvil 375 px,
   320 px, escritorio 1020 px y 1280 px, sin scroll horizontal ni desbordes.
2. **Invariante de rachas comprobada con datos reales**: anotar racha actual, racha más larga, minutos
   de la semana, días estudiados, mapa, metas cumplidas, racha de metas, récord y semanas perfectas
   antes y después de eliminar un libro con entradas; deben ser idénticos (incluido el caso de eliminar
   el único libro).
3. Consola sin errores ni avisos nuevos.
4. Recorrido completo solo con teclado, con foco visible y `aria-expanded` correcto en cada ficha;
   probado `Escape` en la confirmación y las flechas entre opciones.
5. Animaciones comprobadas (RNF-5) y comprobadas también con `prefers-reduced-motion: reduce`.
6. `node --test` en verde: los 64 tests actuales más los nuevos de normalización de libros y fuentes,
   validación y normalización de enlaces, contraste del icono, archivado al eliminar y cálculo de
   métricas con huella.
7. Ida y vuelta de exportar/importar con contenido, origen, fuentes y huella; y importación de un JSON antiguo
   (`version: 2` y sin `metas`, sin `contenido`, sin `origen`, sin `fuentes`, sin `archivo`) sin perder nada.
8. Textos revisados en español, singular y plural, y contenidos largos comprobados (500 caracteres de
   contenido y de origen, 20 fuentes, URL muy larga, nombre de 40 caracteres).

## 13. Dudas abiertas (resueltas 15 oct 2026)

1. **P-1**: al eliminar una **entrada** suelta se mantiene el comportamiento actual (sus minutos salen
   del historial). Solo el borrado de libro conserva huella. Decisión del usuario: sí.
2. **P-2**: un día solo de un libro eliminado sigue contando en racha/mapa/metas aunque «Entradas de
   hoy» quede vacío y sin rastro de título/contenido. Decisión del usuario: sí.
3. **P-3**: una sola ficha abierta a la vez. Decisión del usuario: sí.
4. **P-4**: al crear basta nombre + color; contenido/origen/fuentes se rellenan en Editar. Decisión del
   usuario: sí.
5. **P-5**: extensiones E-1–E-8 fuera de alcance. Decisión del usuario: sí (se dejan para más adelante).

## 14. Enmiendas

- **E1 (15 oct 2026, aprobada)**: `contenido` partido en `contenido` (qué) + `origen` (de dónde viene),
  500 caracteres cada uno (glosario, RF-11–13, RF-15–16, RF-18–19, RNF-2/3, §6, §8, §12). Nombres
  duplicados bloqueados con «Ya tienes un libro con ese nombre» al crear y al renombrar (RF-7, RF-13,
  §8.6). Sin cambios en huella, métricas ni diseño.
