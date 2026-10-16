# Especificación 001 — Mapa de calor de días estudiados

## 1. Contexto y objetivo
El Diario de Estudio muestra hoy un resumen inmediato (carrusel de estadísticas y
tira de la semana actual), pero no ofrece una vista del esfuerzo a lo largo del
tiempo. El objetivo es añadir un **mapa de calor tipo GitHub**: una cuadrícula de
semanas × días donde cada día estudiado se colorea según los minutos acumulados
ese día. Así el usuario ve de un vistazo su constancia histórica y se motiva a no
dejar huecos.

**Glosario**
- **Entrada**: registro de estudio de un libro. Contiene `sesiones`
  `[{fecha, minutos}]` agrupadas por fecha: al seguir estudiando el tema se suma a
  la sesión de ese día. Su `fecha` y `minutos` visibles son los de la última sesión.
- **Minutos de un día**: suma de las sesiones con esa fecha de todas las entradas
  de todos los libros. El mapa se calcula siempre desde ellas.
- **Semana**: de lunes a domingo.
- **Vista «Actual»**: las últimas semanas completas, terminando en la semana en curso.

## 2. Usuarios
- Persona única que usa la app en su móvil y, ocasionalmente, en el ordenador.
- Perfil: estudiante autodidacta; puede llevar desde 0 días hasta más de un año de datos.

## 3. Historias de usuario
- **HU-1**: Como usuario, quiero ver mis días estudiados de las últimas semanas en
  una cuadrícula para comprobar mi constancia de un vistazo.
- **HU-2**: Como usuario, quiero que el color de cada día refleje cuánto estudié
  para distinguir los días fuertes de los flojos.
- **HU-3**: Como usuario, quiero pulsar un día para ver su fecha, los minutos y
  cuántas entradas hice, sin salir de la pantalla.
- **HU-4**: Como usuario del móvil, quiero ver el mapa sin hacer zoom ni scroll
  horizontal incómodo.
- **HU-5**: Como usuario nuevo, quiero entender qué es el mapa aunque aún no tenga
  ningún dato.
- **HU-6**: Como usuario con meses o años de historial, quiero retroceder a
  periodos anteriores para revisar mi constancia pasada.

## 4. Requisitos funcionales (EARS)

**RF-1 (ubicuo)** — El sistema mostrará un mapa de calor en columnas de semanas
completas (lunes a domingo). La vista «Actual» termina en la semana en curso y
solo atenúa los días futuros (RF-7).
> Dado que estoy en la pestaña Hoy, cuando se muestra el mapa, entonces veo una
> cuadrícula de semanas × días cuya última columna es la semana en curso.

**RF-2 (ubicuo)** — El sistema coloreará cada día según los minutos totales de
ese día, con cinco niveles de color más un estado sin color: 0 min = sin color;
1–29 = nivel 1 (verde bambú claro); 30–59 = nivel 2 (verde bambú medio);
60–119 = nivel 3 (verde bambú intenso); 120–239 = nivel 4 (amarillo bambú);
240 o más = nivel 5 (rojo bambú).
> Dado un día con 45 minutos, entonces aparece en verde bambú medio. Dado un día
> con 300 minutos, aparece en rojo bambú. Dado un día sin entradas, aparece sin color.

**RF-3 (según estado)** — Mientras el ancho de pantalla sea menor de 1020 px, el
sistema mostrará las últimas 12 semanas; mientras sea de 1020 px o más, mostrará
las últimas 53. Si el ancho cambia (rotación, redimensionar), el rango se
recalcula sin recargar conservando las semanas extra de RF-4: en escritorio se
muestran 53; al volver a móvil, 12 + extra.
> Dado un móvil de 375 px, entonces veo 12 semanas sin scroll horizontal. Dado
> que giro el móvil a 1080 px, entonces veo 53 semanas; si había ampliado 12
> semanas extra, al volver a vertical veo 24.

**RF-4 (dirigido por evento)** — Cuando el usuario pulse «Ver más semanas»:
- a) El sistema ampliará el mapa con 12 semanas más: en «Actual», hasta un máximo
  de 53; en la vista de un año pasado en móvil, hasta cubrir ese año completo (el
  último bloque puede añadir menos de 12).
- b) La opción no aparece cuando ya se muestra el máximo, ni en escritorio.
- c) Las semanas extra son un único contador por sesión: se conserva al cambiar de
  pestaña, al recalcular (RF-9) y al rotar (RF-3); se reinicia a 0 al recargar la
  app y al cambiar de vista («Actual» ↔ año, o de un año a otro).
> Dado un móvil con 12 semanas, cuando pulso «Ver más semanas» dos veces, entonces
> veo 36; al llegar a 53 la opción desaparece. En escritorio nunca aparece.

**RF-5 (dirigido por evento)** — Cuando el usuario use el selector de año:
- a) El selector ofrece «Actual» y cada año pasado con al menos una entrada no
  futura. No se muestra si no existe ningún año pasado con datos. El año en curso
  solo se ve con «Actual».
- b) En escritorio, la vista de año muestra el año completo (enero a diciembre);
  en móvil, las últimas 12 semanas de ese año, ampliables con RF-4. Los días
  fuera del año se ven atenuados y no son pulsables.
- c) La vista elegida se conserva al cambiar de pestaña durante la sesión.
- d) Si el año visualizado se queda sin entradas, desaparece del selector y la
  vista vuelve a «Actual».
> Dado un usuario con datos de 2024, cuando elige «2024», ve ese año; cuando elige
> «Actual», vuelve a las últimas 12/53 semanas. Dado un móvil viendo 2024, ve
> primero las últimas 12 semanas de 2024 y puede retroceder con «Ver más semanas».

**RF-6 (dirigido por evento)** — Cuando el usuario pulse un día (o lo active con
Enter o Espacio):
- a) El sistema mostrará debajo del mapa la fecha, los minutos totales (formato
  «120 (2h 0m)» si son 60 o más) y el número de entradas de ese día; si no hay
  entradas, indicará que no se estudió.
- b) Pulsar otro día reemplaza el detalle; pulsar el mismo día lo cierra.
- c) Si el mapa se recalcula (RF-9), el detalle se actualiza; se cierra al cambiar
  de pestaña, al rotar o redimensionar, o cuando su día deja de ser visible.
- d) Los días futuros y los atenuados fuera de rango no son pulsables.
> Dado un día con 2 entradas y 45 minutos, cuando lo pulso, veo
> «8 de octubre de 2026 · 45 min · 2 entradas»; al pulsarlo de nuevo, se cierra.

**RF-7 (ubicuo)** — El sistema realzará el día de hoy con un borde identificativo
(además de su color según RF-2) y mostrará los días futuros atenuados y sin color.
Las entradas con fecha futura (posibles vía importación) no colorean el mapa ni
suman minutos.
> Dado que hoy es jueves, cuando veo la semana actual, entonces viernes, sábado y
> domingo aparecen atenuados y hoy tiene un borde.

**RF-8 (según estado)** — Mientras no exista ninguna entrada, el sistema mostrará
el mapa vacío con un mensaje que invite a crear la primera entrada. Mientras
existan entradas pero ninguna visible en el rango mostrado, mostrará la
cuadrícula sin colores y el mensaje «No hay días que mostrar en este periodo».
> Dado un usuario nuevo, entonces ve la cuadrícula sin colores y un mensaje como
> «Tu mapa se llenará al registrar tu primera entrada». Dado un usuario con datos
> solo de 2024, ve «No hay días que mostrar en este periodo» y el selector de año.

**RF-9 (ubicuo)** — El sistema recalculará el mapa desde las entradas registradas
cada vez que se guarde, edite, corrija o elimine una entrada, se elimine un libro
o se importen datos. El recálculo no altera la vista ni la ampliación activas,
salvo lo indicado en RF-5d.
> Dado que añado 25 minutos a una entrada de hoy, cuando se guarda, entonces hoy
> sube de intensidad sin recargar la app y sin perder las semanas ampliadas.

**RF-10 (ubicuo)** — El sistema mostrará junto al mapa una leyenda con los cinco
cuadrados de tono, de «Menos» a «Más», sin cifras.
> Dado el mapa visible, cuando busco la leyenda, entiendo qué significa cada tono
> sin leer ninguna ayuda externa.

## 5. Requisitos no funcionales
- **RNF-1**: El mapa se calcula siempre desde las entradas existentes; no se guarda
  ningún dato nuevo ni duplicado.
- **RNF-2**: El mapa se dibuja en menos de 100 ms con 2 años de datos generados.
- **RNF-3**: Accesibilidad. El mapa es una sola parada de Tab; dentro se navega con
  las flechas entre días pulsables y solo el día enfocado es enfocable. Al entrar,
  el foco cae en el día de hoy (enfocable aunque no tenga datos) o, en la vista de
  un año pasado, en el último día con datos. Cada día tiene etiqueta para lector
  de pantalla (fecha y minutos). Los cinco niveles contrastan al menos 3:1 con el
  fondo de papel.
- **RNF-4**: Todos los textos en español.
- **RNF-5**: Debe verse bien desde 320 px de ancho hasta escritorio.
- **RNF-6**: Las fechas se manejan en la hora local del dispositivo al cargar la
  app; un cambio de zona horaria no recibe tratamiento especial.

## 6. Casos límite
- Entrada registrada pasada medianoche (00:30): cuenta para el día local que empieza.
- Cambio de hora (DST): ningún día se duplica ni se pierde en la cuadrícula.
- Año bisiesto: el 29 de febrero se dibuja como un día más, sin trato especial.
- Entrada corregida: sus minutos quedan en la fecha original de la entrada, no en hoy.
- App abierta al cambiar de día (medianoche): el mapa refleja el día en que se
  cargó; se actualiza en la siguiente acción del usuario o al recargar.
- Rotación, año que se vacía, datos importados muy antiguos y cambio de zona
  horaria: cubiertos en RF-3, RF-5 y RNF-6.

## 7. Fuera de alcance (esta versión)
- Tooltips flotantes al pasar el ratón.
- Filtros del mapa por libro.
- Exportar o compartir el mapa como imagen.
- Nuevas estadísticas agregadas por semana o año (totales, medias).
- Animaciones de transición de color.
- Editar o crear entradas desde el detalle del día.
- Reordenar las secciones de la pestaña Hoy (se tratará en una spec aparte).

## 8. Criterios de finalización
1. RF-1 a RF-10 verificados en navegador con Chrome DevTools, en móvil (375 px) y
   escritorio.
2. Consola sin errores ni avisos nuevos.
3. Probado con: usuario sin datos, datos solo de hoy, días en los 5 niveles de
   color y el estado sin color, datos de años anteriores (selector de año,
   bloques de 12 semanas en móvil, año que se queda sin entradas) y navegación
   por teclado.
4. RNF-2 cumplido.

## 9. Dudas abiertas
- [NECESITA ACLARACIÓN] ¿El mapa debe relacionarse con la «semana perfecta»? Se
  retiró de los criterios porque ningún RF la mencionaba.

## 10. Enmiendas

**13 oct 2026 — Presentación del mapa (CSS/scroll)**
- Cuando la cuadrícula no cabe en la sección del mapa, muestra scroll horizontal
  en lugar de desbordarla; la barra solo existe si hace falta. Compatible con
  RF-3/RF-4/RF-5 y con HU-4 (la vista por defecto sigue sin scroll).
- Las celdas miden 13×13 px o más (`min-width`/`min-height`); cuando sobra sitio
  siguen estirándose proporcionalmente.
- El padding interior evita que los `outline` de hoy/selección/foco se recorten en
  los bordes del scroll. Al pulsar «Ver más semanas» el scroll se coloca al final
  para que «hoy» siga visible.

**15 oct 2026 — Borrado de libros con huella (spec 003)**
- El mapa se sigue recalculando al eliminar un libro, pero su resultado deja de
  cambiar: las sesiones del libro eliminado permanecen en la huella de estudio
  (`archivo`, un registro por entrada con solo fecha y minutos) y el mapa se calcula
  sobre entradas activas más huella (spec 003 §6.2). Un día sostenido únicamente por
  la huella sigue coloreado y contando; «Entradas de hoy», listas y búsquedas no
  muestran ningún rastro del libro eliminado (sin títulos ni contenidos). Solo texto,
  sin cambios de código en esta spec.