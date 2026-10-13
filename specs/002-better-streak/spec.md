# Spec 002 — Better streak (metas semanales y rachas semanales)

## 1. Contexto y objetivo

Hoy la app solo premia la constancia **diaria**: una racha de días seguidos y un
fuego de «semana perfecta» de lunes a hoy. Quien estudia 4 o 5 días por semana de
forma estable tiene racha 0 y nunca ve un reconocimiento.

El objetivo es añadir **metas semanales**: el usuario elige cuántos días por
semana quiere estudiar (1 a 7), ve cuánto le falta, celebra al cumplirla,
acumula semanas consecutivas (con su récord) y conserva la semana perfecta como
escalón máximo.

Esta spec **sustituye** el fuego de «semana perfecta» de lunes a hoy (ahora exige
los 7 días) y el texto «Estudia cada día de lunes a hoy para encender el fuego»
(ahora es una guía ligada a la meta).

### Glosario
- **Entrada**: registro de estudio con fecha y minutos.
- **Día estudiado**: día con al menos una entrada de más de 0 minutos (varias
  entradas el mismo día cuentan como un solo día).
- **Semana**: de lunes a domingo, por la fecha local. **Semana cerrada**: aquella
  cuyo domingo ya pasó; la semana en curso nunca está cerrada.
- **Meta vigente** de una semana: la que regía en ella según el historial (RF-2).
- **Semana cumplida**: semana cerrada con tantos días estudiados como su meta
  vigente o más. **Semana perfecta**: semana con los 7 días estudiados.
- **Racha de metas** (o **de semanas perfectas**): semanas cumplidas (o
  perfectas) consecutivas que terminan en la última semana cerrada; es 0 si la
  última semana cerrada no cuenta.
- **Récord**: la mayor racha de ese tipo en todo el historial.
- Las semanas anteriores a la primera entrada no cuentan ni rompen rachas.

## 2. Usuarios

- **Constante pero no diario**: estudia varios días a la semana y quiere un
  objetivo realista.
- **Diario**: busca la semana perfecta y la racha más larga.
- **Que ajusta su rutina**: sube o baja su exigencia según la época sin alterar
  su historial.

## 3. Historias de usuario

- **HU-1**: Como usuario, quiero elegir en Ajustes cuántos días por semana
  quiero estudiar (1 a 7) y que se recuerde.
- **HU-2**: Como usuario, quiero ver cuántos días me faltan para mi meta de esta
  semana, para saber si aún estoy a tiempo.
- **HU-3**: Como usuario, quiero un fuego 🔥 el día que cumplo la meta semanal,
  para sentir el logro.
- **HU-4**: Como usuario, quiero aspirar a la semana perfecta (7 días) y ver el
  fuego el día que la consigo.
- **HU-5**: Como usuario, quiero ver cuántas semanas seguidas llevo cumpliendo la
  meta y cuántas semanas perfectas seguidas, para no romper la cadena.
- **HU-6**: Como usuario, quiero ver mis totales y mi racha más larga de metas y
  de semanas perfectas, para tener perspectiva y un récord que superar.

## 4. Requisitos funcionales

**RF-1 (ubicuo)** — El sistema permitirá elegir en Ajustes una meta semanal de 1
a 7 días y la guardará en un historial de metas, donde cada cambio queda
registrado con la fecha desde la que rige. Ajustes mostrará la meta elegida y,
si aún no rige, desde qué lunes se aplicará.
> Dado que no tenía meta y elijo 5 días un miércoles, entonces Ajustes muestra
> «5 días» sin aviso. Dado que luego la cambio a 4, entonces muestra «4 días» y
> «Se aplicará desde el lunes».

**RF-2 (ubicuo)** — La meta vigente de una semana será la del último cambio del
historial cuya fecha de inicio sea igual o anterior al lunes de esa semana, o 3
si no hay ninguno. La primera meta configurada rige desde el lunes de la semana
en curso; cada cambio posterior, desde el lunes siguiente (un nuevo cambio antes
de ese lunes reemplaza al pendiente, sin sustituir a una primera meta ya
vigente). Las semanas vividas nunca se reevalúan con una meta posterior.
> Dado que configuro mi primera meta de 5 un miércoles, entonces esta semana la
> meta es 5 y las anteriores siguen evaluadas con 3. Dado que cambio de 6 a 3 un
> miércoles, entonces esta semana sigo con 6 y desde el lunes con 3; las semanas
> cerradas conservan su resultado.

**RF-3 (ubicuo)** — El sistema contará los días estudiados de la semana según el
glosario. Las entradas con fecha futura no cuentan; una entrada registrada pasada
la medianoche cuenta para el día local que empieza.
> Dada una semana con entradas el lunes, el martes y dos veces el jueves,
> entonces cuenta 3 días. Dado un día cuya única entrada es de 0 minutos,
> entonces ese día no suma.

**RF-4 (dirigido por evento)** — Cuando el usuario alcance su meta semanal, el
sistema mostrará el fuego 🔥 «Meta semanal alcanzada» solo ese día. El día del
logro es la fecha del día estudiado número N de la semana (N = meta vigente),
contando por la fecha de las entradas y no por cuándo se registraron.
> Dado que me faltaba 1 día y hoy estudié, entonces el fuego dice «Meta semanal
> alcanzada»; mañana ya no. Dado que hoy registro una entrada con fecha del
> lunes que completa la meta, entonces hoy no hay fuego (el logro fue el lunes).

**RF-5 (dirigido por evento)** — Cuando los 7 días de una semana estén
estudiados, el sistema mostrará el fuego 🔥 «Semana perfecta» solo el domingo de
esa semana.
> Dado que he estudiado los 7 días, cuando se muestra Hoy el domingo, entonces el
> fuego dice «Semana perfecta»; el lunes ya no.

**RF-6 (según estado)** — Mientras la racha de metas sea mayor que 0, el sistema
mostrará el fuego 🔥 «Racha de metas semanales activa».
> Dado que cumplí la meta la última semana cerrada, cuando llega el lunes,
> entonces el fuego dice «Racha de metas semanales activa». Dado que cumplo la
> meta por primera vez esta semana, entonces solo veo «Meta semanal alcanzada»
> ese día; el fuego de racha aparece al cerrar la semana.

**RF-7 (ubicuo)** — Los fuegos se mostrarán en la misma zona de estado que hoy
ocupa el de «semana perfecta» (junto a la tira de la semana), en un único
elemento. Si coinciden varios el mismo día, se mostrará el primero de este
orden: 1. «Semana perfecta». 2. «Meta semanal alcanzada». 3. «Racha de metas
semanales activa».
> Dado que hoy completo los 7 días y además la meta, entonces el fuego dice
> «Semana perfecta». Dado que hoy cumplo la meta con racha activa, entonces dice
> «Meta semanal alcanzada».

**RF-8 (ubicuo)** — El sistema mostrará bajo la tira de la semana un texto de
guía sobre la meta. **Días posibles** son los días desde hoy hasta el domingo que
aún no están estudiados (hoy cuenta solo si no tiene estudio); la meta es
**alcanzable** si días estudiados + días posibles ≥ meta. Se evalúan los casos en
este orden (un usuario sin entradas pasa directamente al 3 o al 4):
1. Semana perfecta completada hoy: «¡Completaste una semana perfecta!».
2. Semana sin empezar (hay entradas en semanas anteriores, ningún día estudiado
   esta semana): «Esta semana aún no has estudiado: tu meta es de N día(s).».
3. Meta no cumplida y alcanzable: «Tu meta semanal es de N día(s), te falta(n) M
   día(s)».
4. Meta no cumplida e inalcanzable: «Recuerda estudiar todas las semanas».
5. Meta cumplida y semana perfecta aún posible (ningún día anterior a hoy sin
   estudiar): «Meta semanal alcanzada, ¡esta semana puedes conseguir una semana
   perfecta!».
6. Meta cumplida en los demás casos: «Meta alcanzada»; si quedan días
   posibles se añade «, ¿vamos a estudiar más?».

Concordancia: «1 día», «2 días»; «te falta 1 día», «te faltan 2 días».
> Dado meta 5, 3 días estudiados y miércoles, entonces dice «Tu meta semanal es
> de 5 días, te faltan 2 días». Dado meta 2 y 1 día estudiado, entonces dice «Tu
> meta semanal es de 2 días, te falta 1 día». Dado meta 6, lunes y martes
> estudiados y viernes sin estudiar aún (2 + 3 días posibles = 5), entonces dice
> «Recuerda estudiar todas las semanas». Dado que cumplí la meta el jueves
> habiendo estudiado de lunes a jueves, entonces dice «Meta semanal alcanzada,
> ¡esta semana puedes conseguir una semana perfecta!».

**RF-9 (ubicuo)** — El sistema calculará, con las definiciones del glosario y la
meta vigente de cada semana: (a) el total de semanas cumplidas y de semanas
perfectas; (b) la racha de metas y la racha de semanas perfectas; (c) el récord
de cada racha. La semana en curso no se suma hasta cerrar; una semana cerrada que
no cuenta (incluida una sin entradas) pone la racha a 0; el récord se conserva y
se iguala o supera cuando la racha lo alcanza.
> Dado que cumplí la meta las 3 últimas semanas cerradas y mi mejor racha fue 6,
> entonces la racha es 3 y el récord 6. Dado que la semana siguiente cierra sin
> cumplir, entonces la racha es 0 y el récord sigue en 6.

**RF-10 (ubicuo)** — El sistema añadirá al carrusel de estadísticas dos tarjetas
a las cuatro existentes: «Metas semanales» y «Semanas perfectas». Cada una
muestra el total de semanas, la racha actual y el récord.
> Dado que he cumplido la meta en 4 semanas, mi racha es 3 y mi récord 6,
> entonces la tarjeta dice «Metas semanales: 4 · racha 3 · récord 6».

## 5. Requisitos no funcionales

- **RNF-1**: Metas, rachas, récords, totales y fuegos se derivan de las entradas
  y del historial de metas; no se guardan contadores aparte. Se recalculan al
  registrar, editar, corregir o eliminar una entrada, al importar datos y al
  cambiar de semana (en el siguiente render, sin recargar la app).
- **RNF-2**: El historial de metas se exporta e importa con el resto de los
  datos. Datos antiguos sin historial, o con una meta fuera de 1–7, se
  normalizan sin perder entradas: sin historial vale la meta de 3.
- **RNF-3**: Los reconocimientos son texto con el fuego 🔥 (no solo color), en
  español con ortografía correcta, y caben desde 320 px hasta escritorio.

## 6. Casos límite

- **Primer uso a mitad de semana**: la primera entrada es un jueves con meta 3; la
  semana se evalúa completa y puede cumplirse el sábado.
- **Meta de 1 y meta de 7**: con 1, cualquier día estudiado cumple la meta y la
  semana perfecta sigue exigiendo 7; con 7, meta y semana perfecta coinciden y
  prevalece «Semana perfecta» (RF-7).
- **Entrada corregida o eliminada en una semana cerrada**: el resultado de esa
  semana, las rachas y los récords se recalculan con las entradas actuales.

## 7. Fuera de alcance (esta versión)

- Recordatorios o notificaciones para empujar a cumplir la meta.
- Metas mensuales, anuales o por libro.
- Ver o editar el historial de metas, ni cambiar la meta de semanas pasadas.
- Pausas o vacaciones que no rompan la racha.
- Fuego propio para la racha de semanas perfectas (solo aparece en su tarjeta).
- Insignias, niveles o recompensas más allá de los tres fuegos de texto.
- Cambios en la racha diaria existente (sigue igual).

## 8. Criterios de finalización

1. RF-1 a RF-10 verificados en navegador, en móvil (375 px) y escritorio, y los
   textos se leen bien en 320 px (incluido el singular).
2. Consola sin errores ni avisos nuevos.
3. Probado cada caso límite y el ejemplo de cada RF, más: importación de JSON
   antiguo sin historial, exportación e importación del historial de metas y
   cruce de domingo a lunes con la app abierta.
4. Los totales y rachas cuadran con los días estudiados y el mapa de calor (misma
   fuente: las entradas).

## 9. Dudas abiertas

Ninguna. Decisiones cerradas con el usuario: los días con entradas de 0 minutos no
cuentan; los totales abarcan todo el historial; se guarda el historial de metas
y el pasado no se recalcula; la racha solo continúa si se cumple semana tras
semana y, si no, vuelve a 0; hay récord de racha de metas y de semanas perfectas;
la primera meta configurada rige en la semana en curso y los cambios posteriores
desde el lunes siguiente.