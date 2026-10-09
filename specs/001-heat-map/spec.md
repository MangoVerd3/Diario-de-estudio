# Especificación 001 — Mapa de calor de días estudiados

## 1. Contexto y objetivo
El Diario de Estudio muestra hoy un resumen inmediato (carrusel de estadísticas y
tira de la semana actual), pero no ofrece una vista del esfuerzo a lo largo del
tiempo. El objetivo es añadir un **mapa de calor tipo GitHub**: una cuadrícula de
semanas × días donde cada día estudiado se colorea con más intensidad cuantos más
minutos se hayan acumulado ese día. Así el usuario ve de un vistazo su constancia
histórica y se motiva a no dejar huecos.

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

**RF-1 (ubicuo)** — El sistema mostrará un mapa de calor organizado en columnas de
semanas (lunes a domingo) cuya vista predeterminada («Actual») termina en la
semana en curso. La primera columna muestra la semana completa; los días
anteriores al inicio del rango se ven atenuados y no son pulsables.
> Dado que estoy en la pestaña Hoy, cuando se muestra el mapa, entonces veo una
> cuadrícula de semanas × días cuya última columna es la semana en curso, y los
> días fuera de rango de la primera semana aparecen atenuados.

**RF-2 (ubicuo)** — El sistema coloreará cada día según los minutos totales
acumulados ese día (suma de todas las sesiones de todos los libros), con cinco
niveles de color más un estado sin color: 0 min = sin color; 1–29 = nivel 1
(verde bambú claro); 30–59 = nivel 2 (verde bambú medio); 60–119 = nivel 3
(verde bambú intenso); 120–239 = nivel 4 (amarillo bambú); 240 o más = nivel 5
(rojo bambú).
> Dado un día con 45 minutos, cuando se muestra el mapa, entonces ese día aparece
> en verde bambú medio. Dado un día con 300 minutos, aparece en rojo bambú. Dado
> un día sin sesiones, aparece sin color.

**RF-3 (según estado)** — Mientras el ancho de pantalla sea menor de 768 px, el
sistema mostrará las últimas 12 semanas; mientras sea de 768 px o más, mostrará
las últimas 53 semanas. Si el ancho cambia (rotación, redimensionar), el rango se
recalcula en caliente conservando las semanas extra ampliadas con «Ver más
semanas» (RF-4): en escritorio se muestran 53; al volver a móvil, 12 + extra.
> Dado un móvil de 375 px, cuando abro el mapa, entonces veo 12 semanas completas
> sin scroll horizontal. Dado que giro el móvil a 812 px de ancho, entonces el
> mapa pasa a mostrar 53 semanas sin recargar; si había ampliado 12 semanas
> extra, al volver a vertical veo 24.

**RF-4 (dirigido por evento)** — Cuando el usuario pulse «Ver más semanas», el
sistema ampliará el mapa con 12 semanas más: en la vista «Actual», hasta un
máximo de 53; en la vista de un año pasado en móvil, hasta cubrir ese año
completo (el último bloque puede añadir menos de 12 semanas). La opción no
aparece cuando ya se muestra el máximo ni en la vista de año en escritorio (año
completo visible). La ampliación se guarda como semanas extra sobre el rango
predeterminado móvil y dura la sesión: se conserva al cambiar de pestaña y al
recalcular datos (RF-9); se pierde al recargar la app o al volver a «Actual».
> Dado un móvil con el mapa de 12 semanas, cuando pulso «Ver más semanas» dos
> veces, entonces veo 36 semanas; cuando llego a 53, la opción desaparece. Dado
> un escritorio con 53 semanas visibles, la opción nunca aparece.

**RF-5 (dirigido por evento)** — Cuando el usuario use el selector de año, el
sistema mostrará el mapa de cualquier año pasado que tenga entradas (un año solo
cuenta como con datos si tiene al menos una sesión no futura; los años sin
entradas no aparecen; el año en curso solo se ve con la opción «Actual»). En
escritorio la vista de año muestra el año completo (enero a diciembre); en móvil
se recorre en bloques de 12 semanas desde el final del año con «Ver más semanas»
(RF-4). Los días fuera del año se ven atenuados y no son pulsables. Si solo hay
un año con datos, el selector no se muestra. La vista elegida se conserva al
cambiar de pestaña durante la sesión; si el año visualizado se queda sin
entradas, desaparece del selector y la vista vuelve a «Actual».
> Dado un usuario con datos desde 2024, cuando elige «2024» en el selector,
> entonces ve el mapa de ese año; cuando elige «Actual», vuelve a las últimas
> 12/53 semanas. Dado un móvil viendo 2024, entonces primero ve las últimas 12
> semanas de 2024 y puede retroceder con «Ver más semanas».

**RF-6 (dirigido por evento)** — Cuando el usuario pulse un día del mapa (pasado
o presente), el sistema mostrará debajo del mapa un detalle con: la fecha, los
minutos totales (formato «120 (2h 0m)» si son 60 o más) y el número de entradas
con sesión ese día; si el día no tiene sesiones, el detalle indicará que no se
estudió. Pulsar otro día reemplaza el detalle; pulsar el mismo día lo cierra; si
el mapa se recalcula (RF-9), el detalle del día seleccionado se actualiza. El
detalle se cierra al cambiar de pestaña, al rotar o redimensionar la pantalla, o
cuando su día deja de ser visible. Los días futuros y los atenuados fuera de
rango no son pulsables.
> Dado un día con 2 entradas y 45 minutos, cuando lo pulso, entonces veo
> «8 de octubre de 2026 · 45 min · 2 entradas»; cuando lo pulso de nuevo, el
> detalle se cierra.

**RF-7 (ubicuo)** — El sistema realzará el día de hoy con un borde identificativo
(además de su color según RF-2) y mostrará los días futuros atenuados y sin
color. Las sesiones con fecha futura (posibles vía importación) no colorean el
mapa ni suman minutos.
> Dado que hoy es jueves, cuando veo la semana actual, entonces viernes, sábado y
> domingo aparecen atenuados y hoy tiene un borde.

**RF-8 (según estado)** — Mientras no exista ninguna entrada, el sistema mostrará
el mapa vacío con un mensaje que invite a crear la primera entrada. Mientras
existan entradas pero ninguna tenga sesiones visibles en el rango mostrado (por
ser anteriores al periodo o futuras), el sistema mostrará el mensaje «No hay días
que mostrar en este periodo».
> Dado un usuario nuevo, cuando abre la pestaña Hoy, entonces ve la cuadrícula
> sin colores y un mensaje del tipo «Tu mapa se llenará al registrar tu primera
> entrada». Dado un usuario con datos solo de 2024, entonces ve «No hay días que
> mostrar en este periodo» y puede usar el selector de año.

**RF-9 (ubicuo)** — El sistema recalculará el mapa desde las sesiones registradas
cada vez que se guarde, edite, corrija o elimine una entrada, se elimine un
libro, o se importen datos. El recálculo no altera la vista ni la ampliación
activas.
> Dado que añado 25 minutos a una entrada, cuando se guarda, entonces el día de
> hoy sube de intensidad en el mapa sin recargar la app y sin perder las semanas
> ampliadas.

**RF-10 (ubicuo)** — En la pestaña Hoy el orden de las secciones será: carrusel
de estadísticas, Entradas de hoy, tira de la semana, mapa de calor.
> Dado un móvil, cuando abro Hoy, entonces puedo ver mi última entrada del día y
> saltar a su libro sin hacer scroll por encima de la tira de la semana.

**RF-11 (ubicuo)** — El sistema mostrará junto al mapa una leyenda con los cinco
cuadrados de tono, de «Menos» a «Más», sin cifras.
> Dado el mapa visible, cuando busco la leyenda, entonces entiendo qué significa
> cada tono sin leer ninguna ayuda externa.

## 5. Requisitos no funcionales
- **RNF-1**: El mapa se calcula siempre desde los datos de sesiones existentes; no
  se guarda ningún dato nuevo ni duplicado.
- **RNF-2**: El mapa se dibuja en menos de 100 ms con 2 años de datos generados,
  medido en el navegador de pruebas del proyecto (Brave/Chromium) en el equipo
  del desarrollador, previa aprobación del usuario.
- **RNF-3**: Accesibilidad: el mapa es una sola parada de Tab; dentro se navega
  con flechas de teclado y solo el día seleccionado es enfocable; al entrar, el
  foco cae en el día de hoy —enfocable incluso sin datos, su detalle indica que
  no se estudió— (o en el último día con datos en la vista de un año
  pasado); cada día tiene etiqueta legible por lector de pantalla (fecha,
  minutos); la escala se distingue sobre el fondo de papel; se respeta
  `prefers-reduced-motion`.
- **RNF-4**: Todos los textos en español.
- **RNF-5**: Debe verse bien desde 320 px de ancho hasta escritorio.
- **RNF-6**: Las fechas se manejan en la hora local del dispositivo al cargar la
  app; un cambio de zona horaria no recibe tratamiento especial.

## 6. Casos límite
- Sesión registrada pasada medianoche (00:30): cuenta para el día local que empieza.
- Cambio de hora (DST): ningún día se duplica ni se pierde en la cuadrícula.
- Año bisiesto: el 29 de febrero se dibuja como un día más, sin trato especial.
- La vista de año completo tiene 52 o 53 columnas según el año; el máximo de
  «Ver más semanas» en esa vista es el año completo, sea cual sea su tamaño.
- Entrada corregida: sus minutos quedan en la fecha original de la entrada, no en hoy.
- Datos importados muy antiguos: no aparecen en la vista «Actual», pero son
  accesibles con el selector de año (RF-5) y no se alteran.
- Día con 0 minutos exactos (solo posible vía importación o datos antiguos; la
  interfaz exige ≥ 1 min): se muestra como día sin color.
- La app abierta al cambiar de día (medianoche): el mapa refleja el día en que se
  cargó; se actualiza en la siguiente acción del usuario o recarga.
- Rotación del móvil o redimensionado: el rango se recalcula conservando la
  ampliación de «Ver más semanas» (RF-3).
- Borrar todas las entradas del año visualizado: el año desaparece del selector y
  la vista vuelve a «Actual» (RF-5).
- Cambio de zona horaria del dispositivo: sin tratamiento especial (RNF-6).

## 7. Fuera de alcance (esta versión)
- Tooltips flotantes al pasar el ratón.
- Filtros del mapa por libro.
- Exportar o compartir el mapa como imagen.
- Nuevas estadísticas agregadas por semana o año (totales, medias).
- Animaciones de transición de color.
- Editar o crear entradas desde el detalle del día.

## 8. Criterios de finalización
1. Todos los RF-1 a RF-11 verificados en navegador con Chrome DevTools, previa
   aprobación del usuario, en móvil (375 px) y escritorio.
2. Consola sin errores ni avisos nuevos.
3. Probado con: usuario sin datos, datos solo de hoy, semana perfecta activa,
   días en los 5 niveles de color y el estado sin color, datos de años anteriores
   (selector de año, bloques de 12 semanas en móvil, año que se queda sin
   entradas) y navegación por teclado.
4. Medida de RNF-2 cumplida en las condiciones especificadas.
5. `AGENTS.md` y `MEMORY.md` actualizados con la nueva funcionalidad.

## 9. Dudas abiertas
- Ninguna.
