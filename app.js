// Diario de Estudio - App web vanilla (HTML, CSS, JS)
// Persistencia: localStorage con clave 'diarioEstudio'
// Fechas en formato YYYY-MM-DD (hora local), sin usar toISOString() para "hoy"

// --- PALETA DE COLORES PARA LIBROS ---
const BOOK_COLORS = [
  '#3b82f6', // azul
  '#10b981', // verde
  '#f59e0b', // amarillo/ámbar
  '#ef4444', // rojo
  '#8b5cf6', // violeta
  '#06b6d4', // cian
  '#f97316', // naranja
  '#ec4899'  // rosa
];

// --- ESTADO ---
let state = {
  libros: [],      // [{ id, nombre, color, creadoEn }]
  entradas: [],    // [{ id, libroId, titulo, contenido, fecha, creadoEn, minutos, sesiones }]
  metas: [],       // [{ dias, desde }] historial de metas semanales (spec 002)
  selectedBookId: null,
  editingBookId: null,
  editingEntryId: null,
  entryEditMode: null, // 'sumar' (seguir estudiando) | 'corregir' (reemplazar total)
  searchQuery: '',
  tab: 'hoy'       // pestaña activa: 'hoy' | 'libros' | 'ajustes'
};

// --- UTILIDADES ---
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getTodayLocalYMD() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseYMD(ymd) {
  if (typeof ymd !== 'string') return null;
  const parts = ymd.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return new Date(y, m, d);
}

function ymdToDate(ymd) {
  // Date local a medianoche para comparar días
  const p = parseYMD(ymd);
  if (!p) return null;
  p.setHours(0, 0, 0, 0);
  return p;
}

function addDaysYMD(ymd, days) {
  // setDate evita problemas con cambios de hora (DST)
  const d = ymdToDate(ymd);
  if (!d) return ymd;
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diffDaysYMD(aYmd, bYmd) {
  // Diferencia en días (a - b); Math.round tolera días de 23/25 h por DST
  const da = ymdToDate(aYmd);
  const db = ymdToDate(bYmd);
  if (!da || !db) return NaN;
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

// Normaliza una entrada antigua o importada al modelo actual con `sesiones`.
// Sesiones agrupadas por fecha: [{fecha: 'YYYY-MM-DD', minutos: number}]
function normalizarEntrada(e) {
  let sesiones = [];
  if (Array.isArray(e.sesiones)) {
    const porFecha = {};
    for (const s of e.sesiones) {
      if (s && typeof s.fecha === 'string' && typeof s.minutos === 'number' && s.minutos >= 0) {
        porFecha[s.fecha] = (porFecha[s.fecha] || 0) + s.minutos;
      }
    }
    sesiones = Object.keys(porFecha).sort().map(f => ({ fecha: f, minutos: porFecha[f] }));
  }
  // Datos antiguos sin sesiones: una sola sesión con su fecha y total
  if (sesiones.length === 0 && typeof e.fecha === 'string') {
    sesiones = [{ fecha: e.fecha, minutos: typeof e.minutos === 'number' && e.minutos >= 0 ? e.minutos : 0 }];
  }
  const minutos = sesiones.reduce((acc, s) => acc + s.minutos, 0);
  const ultimaFecha = sesiones.length > 0 ? sesiones[sesiones.length - 1].fecha : e.fecha;
  return { ...e, sesiones, minutos, fecha: ultimaFecha };
}

// Sesiones efectivas de una entrada (por si falta el array)
function getSesiones(e) {
  return Array.isArray(e.sesiones) && e.sesiones.length > 0
    ? e.sesiones
    : [{ fecha: e.fecha, minutos: e.minutos || 0 }];
}

// Conjunto de fechas únicas con al menos una sesión
function getFechasEstudiadas(entradas) {
  const dateSet = new Set();
  for (const e of entradas) {
    for (const s of getSesiones(e)) {
      if (s && typeof s.fecha === 'string') dateSet.add(s.fecha);
    }
  }
  return dateSet;
}

// --- METAS SEMANALES (spec 002) ---
// Historial de metas: [{ dias: 1..7, desde: 'YYYY-MM-DD' }], donde 'desde' es el
// lunes desde el que rige cada cambio (RF-1). Sin historial la meta vigente es 3
// (RF-2, se aplica al evaluar cada semana).
const META_POR_DEFECTO = 3;

// Fecha del último render: si el día cambia con la app abierta hay que recalcular
// (RNF-1, RF-5)
let fechaRender = null;

// Historial válido y ordenado por 'desde'. Ante datos antiguos o corruptos se
// normaliza y nunca se pierde lo guardado (P5, RNF-2): se descartan las metas
// inválidas y un 'desde' desplazado se ajusta al lunes de esa misma semana.
function normalizarMetas(valor) {
  if (!Array.isArray(valor)) return [];
  const metas = [];
  for (const m of valor) {
    if (!m || typeof m !== 'object') continue;
    const dias = m.dias;
    if (typeof dias !== 'number' || !Number.isInteger(dias) || dias < 1 || dias > 7) continue;
    if (typeof m.desde !== 'string' || !parseYMD(m.desde)) continue;
    metas.push({ dias, desde: lunesDeYMD(m.desde) });
  }
  // Orden cronológico; si dos comparten 'desde' se mantiene el orden recibido
  return metas.sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
}

// Días con minutos totales > 0, ordenados: el «día estudiado» de la spec 002
// (glosario y RF-3). Varias entradas el mismo día siguen siendo un solo día.
function diasConMinutos(dias) {
  return Object.keys(dias).filter(fecha => dias[fecha].minutos > 0).sort();
}

// Días estudiados de una semana de lunes a domingo (RF-3)
function diasEstudiadosSemana(fechas, lunes) {
  const domingo = addDaysYMD(lunes, 6);
  let estudiados = 0;
  for (const fecha of fechas) {
    if (fecha >= lunes && fecha <= domingo) estudiados++;
  }
  return estudiados;
}

// Semanas a evaluar: del lunes del primer día estudiado al lunes de la última
// semana cerrada (la anterior a la de hoy). Es equivalente a arrancar en la primera
// entrada: las semanas previas tienen 0 días estudiados y no alteran ningún
// resultado. La semana en curso nunca se evalúa (RF-9).
function semanasAEvaluar(fechas, hoy) {
  if (fechas.length === 0) return [];
  const lunesInicio = lunesDeYMD(fechas[0]);
  const lunesFin = addDaysYMD(lunesDeYMD(hoy), -7);
  if (lunesFin < lunesInicio) return [];
  const semanas = [];
  for (let lunes = lunesInicio; lunes <= lunesFin; lunes = addDaysYMD(lunes, 7)) {
    semanas.push(lunes);
  }
  return semanas;
}

// Evaluación de cada semana cerrada con la meta que regía en ella (RF-2, RF-9)
function resumenSemanas(fechas, metas, hoy) {
  return semanasAEvaluar(fechas, hoy).map(lunes => {
    const diasEstudiados = diasEstudiadosSemana(fechas, lunes);
    const meta = metaVigenteDe(metas, lunes);
    return {
      lunes,
      meta,
      diasEstudiados,
      cumplida: diasEstudiados >= meta,
      perfecta: diasEstudiados === 7
    };
  });
}

// Racha (tanda de semanas que termina en la última cerrada, 0 si esa no cuenta) y
// récord histórico de ese mismo tipo (RF-9). 'tipo': 'cumplida' | 'perfecta'.
function rachasDeSemanas(semanas, tipo) {
  let racha = 0;
  let record = 0;
  for (const semana of semanas) {
    if (semana[tipo]) {
      racha++;
      if (racha > record) record = racha;
    } else {
      if (racha > record) record = racha;
      racha = 0;
    }
  }
  if (racha > record) record = racha;
  return { racha, record };
}

// Días que aún se pueden estudiar esta semana: de hoy al domingo, contando hoy solo
// si no está estudiado (RF-8).
function diasPosiblesSemana(fechas, hoy) {
  const domingo = addDaysYMD(lunesDeYMD(hoy), 6);
  let posibles = 0;
  for (let fecha = hoy; fecha <= domingo; fecha = addDaysYMD(fecha, 1)) {
    if (!fechas.includes(fecha)) posibles++;
  }
  return posibles;
}

// Concordancia de los textos de la guía (RF-8): «1 día», «2 días»
function textoMetaDias(n) {
  return `${n} ${n === 1 ? 'día' : 'días'}`;
}

function textoFaltanDias(n) {
  return n === 1 ? 'te falta 1 día' : `te faltan ${n} días`;
}

// Texto de la tarjeta del carrusel: total, racha actual y récord (RF-10)
function textoTarjetaRacha(total, racha, record) {
  return `${total} · racha ${racha} · récord ${record}`;
}

// Texto de guía bajo la tira: los seis casos del RF-8, evaluados en ese orden
function textoGuiaMeta(datos) {
  const { meta, estudiados, diasPosibles, perfectaPosible, hayEntradasAnteriores, perfectaHoy } = datos;
  if (perfectaHoy) return '¡Completaste una semana perfecta!';
  if (estudiados === 0 && hayEntradasAnteriores) {
    return `Esta semana aún no has estudiado: tu meta es de ${textoMetaDias(meta)}.`;
  }
  if (estudiados < meta) {
    if (estudiados + diasPosibles >= meta) {
      return `Tu meta semanal es de ${textoMetaDias(meta)}, ${textoFaltanDias(meta - estudiados)}.`;
    }
    return 'Recuerda estudiar todas las semanas';
  }
  if (perfectaPosible) {
    return 'Meta semanal alcanzada, ¡esta semana puedes conseguir una semana perfecta!';
  }
  return `Meta alcanzada${diasPosibles > 0 ? ', ¿vamos a estudiar más?' : ''}`;
}

// Fecha del día estudiado nº N de la semana (N = meta vigente); null si todavía no
// se alcanza (RF-4). Cuenta la fecha de las sesiones, no cuándo se registraron.
function fechaLogroMeta(fechas, metas, lunes) {
  const meta = metaVigenteDe(metas, lunes);
  const deLaSemana = fechas.filter(fecha => fecha >= lunes && fecha <= addDaysYMD(lunes, 6));
  if (deLaSemana.length < meta) return null;
  return deLaSemana[meta - 1];
}

// Semana perfecta completada hoy: hoy es domingo y los 7 días están estudiados (RF-5)
function esPerfectaHoy(fechas, hoy) {
  const lunes = lunesDeYMD(hoy);
  if (hoy !== addDaysYMD(lunes, 6)) return false;
  return diasEstudiadosSemana(fechas, lunes) === 7;
}

// Fuego del día con la prioridad de RF-7: perfecta, meta y racha (RF-4, RF-5, RF-6)
function estadoFuegoHoy(fechas, metas, hoy, rachaMetas) {
  if (esPerfectaHoy(fechas, hoy)) {
    return { tipo: 'perfecta', texto: '🔥 ¡Semana perfecta!' };
  }
  if (fechaLogroMeta(fechas, metas, lunesDeYMD(hoy)) === hoy) {
    return { tipo: 'meta', texto: '🔥 ¡Meta semanal alcanzada!' };
  }
  if (rachaMetas > 0) {
    return { tipo: 'racha', texto: '🔥 Racha de metas semanales activa' };
  }
  return { tipo: null, texto: '' };
}

// ¿Cabe todavía una semana perfecta? Ningún día anterior a hoy sin estudiar
// (RF-8, caso 5).
function perfectaPosibleSemana(fechas, hoy) {
  for (let fecha = lunesDeYMD(hoy); fecha < hoy; fecha = addDaysYMD(fecha, 1)) {
    if (!fechas.includes(fecha)) return false;
  }
  return true;
}

// ¿Hay entradas en semanas anteriores a la de hoy? (RF-8, caso 2). Cuentan todas las
// sesiones, incluso las de 0 minutos: el caso habla de entradas, no de días.
function hayEntradasAnteriores(entradas, lunes) {
  for (const e of entradas) {
    for (const s of getSesiones(e)) {
      if (s && typeof s.fecha === 'string' && s.fecha < lunes) return true;
    }
  }
  return false;
}

// Resumen semanal (RNF-1): una sola pasada sobre las entradas alimenta la tira, la
// guía, los fuegos y las tarjetas del carrusel.
function resumenMetas(entradas, metas, hoy) {
  const dias = computeDiasEstudio(entradas, hoy);
  const fechas = diasConMinutos(dias);
  const historial = Array.isArray(metas) ? metas : [];
  const lunes = lunesDeYMD(hoy);
  const semanas = resumenSemanas(fechas, historial, hoy);
  const rachaMetas = rachasDeSemanas(semanas, 'cumplida');
  const rachaPerfectas = rachasDeSemanas(semanas, 'perfecta');
  const estudiados = diasEstudiadosSemana(fechas, lunes);
  const meta = metaVigenteDe(historial, lunes);
  const diasPosibles = diasPosiblesSemana(fechas, hoy);
  const perfectaPosible = perfectaPosibleSemana(fechas, hoy);
  const hayAnteriores = hayEntradasAnteriores(entradas, lunes);
  const perfectaHoy = esPerfectaHoy(fechas, hoy);
  return {
    lunes,
    meta,
    estudiados,
    metaCumplida: estudiados >= meta,
    perfectaPosible,
    hayEntradasAnteriores: hayAnteriores,
    perfectaHoy,
    fechaLogroMeta: fechaLogroMeta(fechas, historial, lunes),
    fuego: estadoFuegoHoy(fechas, historial, hoy, rachaMetas.racha),
    guia: textoGuiaMeta({
      meta,
      estudiados,
      diasPosibles,
      perfectaPosible,
      hayEntradasAnteriores: hayAnteriores,
      perfectaHoy
    }),
    totalMetas: semanas.filter(s => s.cumplida).length,
    rachaMetas: rachaMetas.racha,
    recordMetas: rachaMetas.record,
    totalPerfectas: semanas.filter(s => s.perfecta).length,
    rachaPerfectas: rachaPerfectas.racha,
    recordPerfectas: rachaPerfectas.record,
    diasPosibles
  };
}

// Meta vigente de una semana: el último cambio cuyo 'desde' sea igual o anterior al
// lunes de esa semana, o 3 si no hay ninguno (RF-2). Nunca reevalúa semanas vividas.
function metaVigenteDe(metas, lunes) {
  let vigente = null;
  for (const m of metas) {
    if (m.desde <= lunes) vigente = m;
  }
  return vigente ? vigente.dias : META_POR_DEFECTO;
}

// Regla de vigencia al elegir meta (RF-1, RF-2): la primera meta configurada rige
// desde el lunes de la semana en curso —aunque coincida con los 3 días por defecto,
// para que los cambios siguientes se apliquen desde el lunes siguiente—; cada cambio
// posterior rige desde el lunes siguiente y sustituye al pendiente sin sustituir a la
// meta ya vigente. Volver a la meta vigente solo deshace el cambio pendiente.
function guardarMetaSemanal(metas, dias, hoy) {
  const lunesHoy = lunesDeYMD(hoy);
  const vigentes = metas.filter(m => m.desde <= hoy);
  if (vigentes.length === 0) return [{ dias, desde: lunesHoy }];
  if (dias === metaVigenteDe(vigentes, lunesHoy)) return vigentes;
  return [...vigentes, { dias, desde: addDaysYMD(lunesHoy, 7) }];
}

// Cambio registrado que aún no rige ('desde' en el futuro). Con varios —solo posible
// con datos importados— manda el último.
function metaPendiente(metas, hoy) {
  let pendiente = null;
  for (const m of metas) {
    if (m.desde > hoy) pendiente = m;
  }
  return pendiente;
}

// Lo que muestra Ajustes: la meta elegida (la pendiente si la hay) y el aviso de
// cuándo se aplicará (RF-1).
function metaSemanaActual(metas, hoy) {
  const pendiente = metaPendiente(metas, hoy);
  return {
    dias: pendiente ? pendiente.dias : metaVigenteDe(metas, lunesDeYMD(hoy)),
    aviso: pendiente ? 'Se aplicará desde el lunes' : null
  };
}

// --- PERSISTENCIA ---
const STORAGE_KEY = 'diarioEstudio';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { libros: [], entradas: [], metas: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Datos no válidos');
    }
    // Validación básica de estructura (prevención de datos corruptos)
    const libros = Array.isArray(parsed.libros) ? parsed.libros : [];
    const entradas = Array.isArray(parsed.entradas) ? parsed.entradas : [];
    const librosValidos = libros.filter(l => l && typeof l.id === 'string' && typeof l.nombre === 'string' && typeof l.color === 'string' && typeof l.creadoEn === 'number');
    const entradasValidas = entradas
      .filter(e => e && typeof e.id === 'string' && typeof e.libroId === 'string' && typeof e.titulo === 'string' && typeof e.fecha === 'string' && typeof e.creadoEn === 'number')
      .map(e => normalizarEntrada(e));
    // El historial de metas es opcional (datos antiguos, RNF-2): se normaliza
    // sin perder nada de lo ya guardado (P5).
    return { libros: librosValidos, entradas: entradasValidas, metas: normalizarMetas(parsed.metas) };
  } catch (err) {
    console.warn('Error al cargar datos de localStorage:', err);
    return { libros: [], entradas: [], metas: [] };
  }
}

function saveState() {
  try {
    const payload = {
      libros: state.libros,
      entradas: state.entradas,
      metas: state.metas
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Error al guardar en localStorage:', err);
    showToast('No se pudo guardar. Es posible que no haya espacio en almacenamiento.');
  }
}

// Validar estructura al importar
function validateImportedData(obj) {
  if (!obj || typeof obj !== 'object') return false;
  // 'metas' no se valida aquí: puede faltar (datos antiguos) o venir corrupto y el
  // archivo sigue siendo importable; se normaliza al importar (RNF-2, P5).
  if (!Array.isArray(obj.libros)) return false;
  if (!Array.isArray(obj.entradas)) return false;
  const libroOk = obj.libros.every(l => l && typeof l.id === 'string' && typeof l.nombre === 'string' && typeof l.color === 'string' && typeof l.creadoEn === 'number');
  if (!libroOk) return false;
  const entradaOk = obj.entradas.every(e => e && typeof e.id === 'string' && typeof e.libroId === 'string' && typeof e.titulo === 'string' && typeof e.fecha === 'string' && typeof e.creadoEn === 'number' && (e.minutos === undefined || (typeof e.minutos === 'number' && e.minutos >= 0)) && (e.sesiones === undefined || Array.isArray(e.sesiones)));
  if (!entradaOk) return false;
  return true;
}

// --- TOAST ---
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    toast.hidden = true;
  }, 2500);
}

// --- CÁLCULO DE RACHA ---
// Racha actual: días consecutivos que terminan HOY (si hoy no hay sesión, es 0).
// Racha más larga: máximo histórico de días consecutivos.
// Ambas se calculan desde las fechas (YYYY-MM-DD, hora local) de las sesiones.
function computeStreak(allEntradas) {
  const dateSet = getFechasEstudiadas(allEntradas);
  if (dateSet.size === 0) {
    return { current: 0, longest: 0 };
  }

  // Orden lexicográfico == cronológico para YYYY-MM-DD
  const sorted = Array.from(dateSet).sort();
  const today = getTodayLocalYMD();

  // Racha actual: cuenta hacia atrás desde hoy (0 si hoy no hay sesión)
  let current = 0;
  if (dateSet.has(today)) {
    let cursor = today;
    while (dateSet.has(cursor)) {
      current++;
      cursor = addDaysYMD(cursor, -1);
    }
  }

  // Racha más larga histórica
  let longest = 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (diffDaysYMD(sorted[i], sorted[i - 1]) === 1) {
      run++;
    } else {
      if (run > longest) longest = run;
      run = 1;
    }
  }
  if (run > longest) longest = run;

  return { current, longest };
}

// --- MINUTOS DE ESTA SEMANA ---
// Semana = lunes a domingo en curso. Suma minutos de sesiones en ese rango.
function computeWeeklyMinutes(allEntradas) {
  const today = getTodayLocalYMD();
  const todayDate = ymdToDate(today);
  if (!todayDate) return 0;
  // Lunes de esta semana (getDay: 0=domingo ... 6=sábado)
  const offsetLunes = (todayDate.getDay() + 6) % 7;
  const lunes = addDaysYMD(today, -offsetLunes);
  const domingo = addDaysYMD(lunes, 6);
  let total = 0;
  for (const e of allEntradas) {
    for (const s of getSesiones(e)) {
      if (s && typeof s.fecha === 'string' && s.fecha >= lunes && s.fecha <= domingo) {
        total += typeof s.minutos === 'number' && s.minutos > 0 ? s.minutos : 0;
      }
    }
  }
  return total;
}

// --- DÍAS ESTUDIADOS ---
// Días únicos con al menos una sesión, total histórico, sin fechas futuras.
function computeStudyDays(allEntradas) {
  const today = getTodayLocalYMD();
  const daySet = new Set();
  for (const e of allEntradas) {
    for (const s of getSesiones(e)) {
      if (s && typeof s.fecha === 'string' && s.fecha <= today) {
        daySet.add(s.fecha);
      }
    }
  }
  return daySet.size;
}

// --- MAPA DE CALOR: LÓGICA PURA (T1) ---
// Funciones puras: reciben datos y "hoy" como parámetros, sin tocar el DOM.

// Lunes de la semana de una fecha YMD (semana L–D, como el resto de la app)
function lunesDeYMD(ymd) {
  const d = ymdToDate(ymd);
  if (!d) return ymd;
  const offsetLunes = (d.getDay() + 6) % 7;
  return addDaysYMD(ymd, -offsetLunes);
}

// Nivel de color del mapa: 0 = sin color; 1..5 por umbrales fijos (RF-2)
function nivelIntensidad(minutos) {
  if (minutos <= 0) return 0;
  if (minutos < 30) return 1;
  if (minutos < 60) return 2;
  if (minutos < 120) return 3;
  if (minutos < 240) return 4;
  return 5;
}

// Minutos totales y nº de entradas por día (RF-2).
// Las sesiones futuras o corruptas no cuentan (RF-7, constitución P5).
function computeDiasEstudio(entradas, hoy) {
  const dias = {};
  for (const e of entradas) {
    const diasDeLaEntrada = new Set(); // la entrada cuenta 1 vez por día
    for (const s of getSesiones(e)) {
      if (!s || typeof s.fecha !== 'string' || s.fecha > hoy) continue;
      const min = typeof s.minutos === 'number' && s.minutos > 0 ? s.minutos : 0;
      if (!dias[s.fecha]) dias[s.fecha] = { minutos: 0, numEntradas: 0 };
      dias[s.fecha].minutos += min;
      diasDeLaEntrada.add(s.fecha);
    }
    for (const f of diasDeLaEntrada) dias[f].numEntradas++;
  }
  return dias;
}

// Formato de minutos del detalle del día: «45 min» o «120 (2h 0m)» (RF-6)
function formatoMinutos(min) {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${min} (${h}h ${m}m)`;
  }
  return `${min} min`;
}

// Años con al menos una sesión no futura, ordenados (selector de año, RF-5)
function aniosConDatos(entradas, hoy) {
  const anios = new Set();
  for (const e of entradas) {
    for (const s of getSesiones(e)) {
      if (s && typeof s.fecha === 'string' && s.fecha <= hoy) {
        anios.add(parseInt(s.fecha.slice(0, 4), 10));
      }
    }
  }
  return Array.from(anios).sort((a, b) => a - b);
}

// Nº de columnas de la vista «Actual»: 12 en móvil, 53 en escritorio;
// las semanas extra amplían hasta 53 (RF-3, RF-4)
function rangoVistaActual(esMovil, extra) {
  const base = esMovil ? 12 : 53;
  return Math.min(base + extra, 53);
}

// Nº de columnas (semanas L–D) que ocupa un año completo (RF-5)
function numSemanasDeAnio(anio) {
  const primera = lunesDeYMD(`${anio}-01-01`);
  const ultima = lunesDeYMD(`${anio}-12-31`);
  return Math.round(diffDaysYMD(ultima, primera) / 7) + 1;
}

// Columnas de la vista de año: completo en escritorio; en móvil, bloques
// de 12 desde el final del año hasta cubrirlo (RF-4, RF-5)
function rangoVistaAnio(anio, esMovil, extra) {
  const totalAnio = numSemanasDeAnio(anio);
  if (!esMovil) return { numColumnas: totalAnio, totalAnio };
  return { numColumnas: Math.min(12 + extra, totalAnio), totalAnio };
}

// Matriz de columnas (semanas) × 7 filas (L–D) terminando en la semana de `fin` (RF-1, RF-7)
function construirModeloSemanas(dias, hoy, fin, numColumnas, esFuera) {
  const inicio = addDaysYMD(lunesDeYMD(fin), -7 * (numColumnas - 1));
  const columnas = [];
  for (let c = 0; c < numColumnas; c++) {
    const columna = [];
    for (let f = 0; f < 7; f++) {
      const fecha = addDaysYMD(inicio, c * 7 + f);
      const dia = dias[fecha];
      const minutos = dia ? dia.minutos : 0;
      const esFuturo = fecha > hoy;
      const fueraDeRango = esFuera(fecha);
      columna.push({
        fecha,
        minutos,
        numEntradas: dia ? dia.numEntradas : 0,
        nivel: (esFuturo || fueraDeRango) ? 0 : nivelIntensidad(minutos),
        esHoy: fecha === hoy,
        esFuturo,
        fueraDeRango,
        pulsable: !esFuturo && !fueraDeRango
      });
    }
    columnas.push(columna);
  }
  return columnas;
}

// Orquestadora: rango y límites según la vista, y modelo completo (RF-1, RF-3, RF-4, RF-5)
function modeloMapa(entradas, hoy, mapaState, esMovil) {
  const dias = computeDiasEstudio(entradas, hoy);
  let columnas, totalDisponible;
  if (mapaState.vista === 'anio' && mapaState.anio) {
    const r = rangoVistaAnio(mapaState.anio, esMovil, mapaState.extra);
    totalDisponible = r.totalAnio;
    const fin = `${mapaState.anio}-12-31`;
    // Fuera del año = atenuado
    columnas = construirModeloSemanas(dias, hoy, fin, r.numColumnas, (fecha) => !fecha.startsWith(`${mapaState.anio}-`));
  } else {
    const n = rangoVistaActual(esMovil, mapaState.extra);
    totalDisponible = 53;
    // RF-1: columnas de semanas completas (L–D) terminando en la semana en
    // curso; solo se atenúan los días futuros (RF-7)
    columnas = construirModeloSemanas(dias, hoy, hoy, n, () => false);
  }
  let hayDatosVisibles = false;
  for (const col of columnas) {
    for (const d of col) {
      if (d.pulsable && d.minutos > 0) { hayDatosVisibles = true; break; }
    }
    if (hayDatosVisibles) break;
  }
  return {
    columnas,
    numColumnas: columnas.length,
    totalDisponible,
    hayDatosVisibles,
    anios: aniosConDatos(entradas, hoy)
  };
}

// Reducer puro de la máquina de estados del mapa (RF-3 a RF-6)
// accion = { tipo, ...payload }; contexto = { maxExtra, diaVisible }
function transicionMapa(mapaState, accion, contexto) {
  switch (accion.tipo) {
    case 'AMPLIAR':
      return { ...mapaState, extra: Math.min(mapaState.extra + 12, contexto.maxExtra) };
    case 'VISTA_ACTUAL':
      return { vista: 'actual', anio: null, extra: 0, diaSel: null };
    case 'VISTA_ANIO':
      return { vista: 'anio', anio: accion.anio, extra: 0, diaSel: null };
    case 'SELECCIONAR_DIA':
      // Pulsar el mismo día lo cierra (toggle)
      return { ...mapaState, diaSel: mapaState.diaSel === accion.fecha ? null : accion.fecha };
    case 'CERRAR_DETALLE':
      return { ...mapaState, diaSel: null };
    case 'CAMBIO_TAMANO':
      // Rotación/redimensionado: conserva vista y extra, cierra el detalle (RF-3, RF-6)
      return { ...mapaState, diaSel: null };
    case 'RECALCULAR':
      // Datos nuevos (RF-9): vista y extra intactos; detalle solo si el día sigue visible
      return { ...mapaState, diaSel: contexto.diaVisible ? mapaState.diaSel : null };
    default:
      return mapaState;
  }
}

// --- RENDERIZADO ---
function renderBooksList() {
  const listEl = document.getElementById('books-list');
  const emptyEl = document.getElementById('books-empty');
  listEl.innerHTML = '';

  if (state.libros.length === 0) {
    listEl.hidden = true;
    emptyEl.hidden = false;
    return;
  }
  listEl.hidden = false;
  emptyEl.hidden = true;

  // Ordenar por creadoEn ascendente (más antiguo primero)
  const librosOrdenados = [...state.libros].sort((a, b) => a.creadoEn - b.creadoEn);

  for (const libro of librosOrdenados) {
    const count = state.entradas.filter(e => e.libroId === libro.id).length;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'book-item' + (state.selectedBookId === libro.id ? ' selected' : '');
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', state.selectedBookId === libro.id ? 'true' : 'false');
    btn.dataset.bookId = libro.id;

    const dot = document.createElement('span');
    dot.className = 'book-color-dot';
    dot.style.background = libro.color;
    dot.setAttribute('aria-hidden', 'true');

    const info = document.createElement('span');
    info.className = 'book-item-info';

    const nameEl = document.createElement('span');
    nameEl.className = 'book-item-name';
    nameEl.textContent = libro.nombre;

    const metaEl = document.createElement('span');
    metaEl.className = 'book-item-meta';
    metaEl.textContent = `${count} entrada${count === 1 ? '' : 's'}`;

    info.appendChild(nameEl);
    info.appendChild(metaEl);
    btn.appendChild(dot);
    btn.appendChild(info);

    btn.addEventListener('click', () => {
      selectBook(libro.id);
    });
    listEl.appendChild(btn);
  }
}

function renderColorPalette(selectedColor) {
  const paletteEl = document.getElementById('book-color-palette');
  paletteEl.innerHTML = '';
  const initial = selectedColor || BOOK_COLORS[0];
  paletteEl.dataset.selectedColor = initial;

  for (const color of BOOK_COLORS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-option' + (initial === color ? ' selected' : '');
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', initial === color ? 'true' : 'false');
    btn.setAttribute('aria-label', 'Color ' + color);
    btn.title = color;
    btn.style.backgroundColor = color;
    btn.dataset.color = color;
    btn.addEventListener('click', () => {
      paletteEl.querySelectorAll('.color-option').forEach(b => {
        b.classList.remove('selected');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-checked', 'true');
      paletteEl.dataset.selectedColor = color;
    });
    paletteEl.appendChild(btn);
  }
}

function renderBookView() {
  const viewEmpty = document.getElementById('book-view-empty');
  const viewBook = document.getElementById('book-view');

  if (!state.selectedBookId) {
    viewEmpty.hidden = false;
    viewBook.hidden = true;
    return;
  }
  const libro = state.libros.find(l => l.id === state.selectedBookId);
  if (!libro) {
    state.selectedBookId = null;
    viewEmpty.hidden = false;
    viewBook.hidden = true;
    return;
  }
  viewEmpty.hidden = true;
  viewBook.hidden = false;

  // Cabecera del libro
  document.getElementById('book-color-indicator').style.background = libro.color;
  document.getElementById('book-title-display').textContent = libro.nombre;
  const entradasLibro = state.entradas.filter(e => e.libroId === libro.id);
  const totalMin = entradasLibro.reduce((acc, e) => acc + (e.minutos || 0), 0);
  document.getElementById('book-count').textContent = `${entradasLibro.length} entrada${entradasLibro.length === 1 ? '' : 's'} · ${totalMin} min en total`;

  // Mantener valor de búsqueda
  document.getElementById('entry-search').value = state.searchQuery || '';

  renderEntries();
}

function renderEntries() {
  const libroId = state.selectedBookId;
  if (!libroId) return;
  const listEl = document.getElementById('entries-list');
  const emptyEl = document.getElementById('entries-empty');
  const noResultsEl = document.getElementById('entries-no-results');
  listEl.innerHTML = '';

  const libro = state.libros.find(l => l.id === libroId);
  let entradas = state.entradas.filter(e => e.libroId === libroId);

  // Filtrar por búsqueda (título o contenido, sin distinción de mayúsculas)
  const q = (state.searchQuery || '').trim().toLowerCase();
  if (q) {
    entradas = entradas.filter(e => {
      const titulo = (e.titulo || '').toLowerCase();
      const contenido = (e.contenido || '').toLowerCase();
      return titulo.includes(q) || contenido.includes(q);
    });
  }

  // Ordenar: más reciente primero (por fecha; si empatan, por creadoEn)
  entradas.sort((a, b) => {
    if (a.fecha !== b.fecha) {
      return b.fecha.localeCompare(a.fecha);
    }
    return b.creadoEn - a.creadoEn;
  });

  if (entradas.length === 0) {
    listEl.hidden = true;
    emptyEl.hidden = !!q;
    noResultsEl.hidden = !q;
    return;
  }
  listEl.hidden = false;
  emptyEl.hidden = true;
  noResultsEl.hidden = true;

  for (const e of entradas) {
    const card = document.createElement('article');
    card.className = 'entry-card';
    card.setAttribute('aria-label', 'Entrada: ' + e.titulo);
    // Cinta adhesiva del color del libro (hex con transparencia)
    if (libro && typeof libro.color === 'string') {
      card.style.setProperty('--tape-color', libro.color + '59');
    }

    const header = document.createElement('header');
    header.className = 'entry-card-header';

    const titleEl = document.createElement('h4');
    titleEl.className = 'entry-card-title';
    titleEl.textContent = e.titulo;

    const timeEl = document.createElement('time');
    timeEl.className = 'entry-card-meta';
    timeEl.dateTime = e.fecha;
    timeEl.textContent = `${e.fecha} · ⏱ ${e.minutos || 0} min`;

    header.appendChild(titleEl);
    header.appendChild(timeEl);

    const contentEl = document.createElement('p');
    contentEl.className = 'entry-card-content';
    contentEl.textContent = e.contenido || '';

    const actions = document.createElement('div');
    actions.className = 'entry-card-actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn btn-secondary btn-small';
    btnEdit.type = 'button';
    btnEdit.textContent = 'Seguir estudiando este tema';
    btnEdit.addEventListener('click', () => editEntry(e.id));

    const btnCorrect = document.createElement('button');
    btnCorrect.className = 'btn btn-secondary btn-small';
    btnCorrect.type = 'button';
    btnCorrect.textContent = 'Corregir tiempo';
    btnCorrect.addEventListener('click', () => correctEntryTime(e.id));

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn btn-danger btn-small';
    btnDelete.type = 'button';
    btnDelete.textContent = 'Eliminar';
    btnDelete.addEventListener('click', () => deleteEntry(e.id));

    actions.appendChild(btnEdit);
    actions.appendChild(btnCorrect);
    actions.appendChild(btnDelete);

    card.appendChild(header);
    card.appendChild(contentEl);
    card.appendChild(actions);
    listEl.appendChild(card);
  }
}

// Valores de las tarjetas del carrusel
// 'resumen' es el resumen de metas semanales (spec 002): lo calcula render() una vez.
function renderStats(resumen) {
  const res = computeStreak(state.entradas);
  document.getElementById('streak-current').textContent = String(res.current);
  document.getElementById('streak-longest').textContent = String(res.longest);

  const weekMin = computeWeeklyMinutes(state.entradas);
  let weekText = String(weekMin);
  if (weekMin >= 60) {
    const h = Math.floor(weekMin / 60);
    const m = weekMin % 60;
    weekText = `${weekMin} (${h}h ${m}m)`;
  }
  document.getElementById('week-minutes').textContent = weekText;
  document.getElementById('study-days').textContent = String(computeStudyDays(state.entradas));

  // Tarjetas de metas y semanas perfectas (RF-10)
  if (resumen) {
    document.getElementById('metas-card').textContent =
      textoTarjetaRacha(resumen.totalMetas, resumen.rachaMetas, resumen.recordMetas);
    document.getElementById('perfectas-card').textContent =
      textoTarjetaRacha(resumen.totalPerfectas, resumen.rachaPerfectas, resumen.recordPerfectas);
  }
}

// Meta semanal elegida en Ajustes: valor del selector y aviso de vigencia (RF-1)
function renderAjustes() {
  const select = document.getElementById('meta-select');
  if (!select) return;
  const { dias, aviso } = metaSemanaActual(state.metas, getTodayLocalYMD());
  select.value = String(dias);
  const avisoEl = document.getElementById('meta-aviso');
  avisoEl.textContent = aviso || '';
  avisoEl.hidden = !aviso;
}

// Tira de la semana actual (lunes a domingo) + fuego y texto de guía de la meta.
// 'resumen' es el resumen de metas semanales (spec 002): lo calcula render() una vez.
function renderWeekStrip(resumen) {
  const gridEl = document.getElementById('week-grid');
  gridEl.innerHTML = '';

  const today = getTodayLocalYMD();
  const todayDate = ymdToDate(today);
  const offsetLunes = (todayDate.getDay() + 6) % 7;
  const lunes = addDaysYMD(today, -offsetLunes);

  const dateSet = getFechasEstudiadas(state.entradas);
  const nombres = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  for (let i = 0; i < 7; i++) {
    const fecha = addDaysYMD(lunes, i);
    const dateObj = parseYMD(fecha);
    const esFuturo = fecha > today;
    const esHoy = fecha === today;
    const marcado = dateSet.has(fecha);

    const cell = document.createElement('div');
    cell.className = 'week-day' + (marcado ? ' marked' : '') + (esHoy ? ' today' : '') + (esFuturo ? ' future' : '');
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `${fecha} ${esFuturo ? '(día futuro)' : marcado ? '(día estudiado)' : '(sin entrada)'}`);

    const label = document.createElement('span');
    label.className = 'day-label';
    label.textContent = nombres[i];

    const num = document.createElement('span');
    num.className = 'day-num';
    num.textContent = String(dateObj.getDate());

    cell.appendChild(label);
    cell.appendChild(num);
    gridEl.appendChild(cell);
  }

  // Fuego único de la meta semanal (RF-4 a RF-7): un solo elemento y el texto del
  // reconocimiento que toque hoy, o nada.
  const fuego = document.getElementById('week-fire');
  const estado = resumen && resumen.fuego ? resumen.fuego : { tipo: null, texto: '' };
  fuego.textContent = estado.texto;
  fuego.hidden = estado.tipo === null;

  // Texto de guía sobre la meta, bajo la tira (RF-8)
  const guia = document.getElementById('week-guide');
  if (guia) guia.textContent = resumen && resumen.guia ? resumen.guia : '';
}

// Entradas con sesión de hoy (cualquier libro); clic lleva al libro
function renderTodayEntries() {
  const listEl = document.getElementById('today-list');
  const emptyEl = document.getElementById('today-empty');
  listEl.innerHTML = '';

  const today = getTodayLocalYMD();
  const deHoy = [];
  for (const e of state.entradas) {
    const sesionHoy = getSesiones(e).find(s => s.fecha === today);
    if (sesionHoy) {
      const libro = state.libros.find(l => l.id === e.libroId);
      deHoy.push({ entrada: e, minutosHoy: sesionHoy.minutos, libro });
    }
  }
  // Más recientes primero
  deHoy.sort((a, b) => b.entrada.creadoEn - a.entrada.creadoEn);

  if (deHoy.length === 0) {
    listEl.hidden = true;
    emptyEl.hidden = false;
    return;
  }
  listEl.hidden = false;
  emptyEl.hidden = true;

  for (const { entrada, minutosHoy, libro } of deHoy) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'today-item';
    btn.setAttribute('aria-label', `Ir a la entrada "${entrada.titulo}" del libro ${libro ? libro.nombre : ''}`);

    const dot = document.createElement('span');
    dot.className = 'book-color-dot';
    if (libro) dot.style.background = libro.color;
    dot.setAttribute('aria-hidden', 'true');

    const info = document.createElement('span');
    info.className = 'today-item-info';

    const title = document.createElement('span');
    title.className = 'today-item-title';
    title.textContent = entrada.titulo;

    const meta = document.createElement('span');
    meta.className = 'today-item-meta';
    meta.textContent = `${libro ? libro.nombre : 'Sin libro'} · ⏱ ${minutosHoy} min hoy`;

    info.appendChild(title);
    info.appendChild(meta);
    btn.appendChild(dot);
    btn.appendChild(info);

    btn.addEventListener('click', () => {
      if (libro) {
        selectBook(libro.id);
        switchTab('libros');
      }
    });
    listEl.appendChild(btn);
  }
}

// --- MAPA DE CALOR: INTERFAZ ---
// Estado de sesión del mapa (no se persiste, RNF-1)
let mapaState = { vista: 'actual', anio: null, extra: 0, diaSel: null };
let mapaModelo = null;   // último modelo calculado (teclado y detalle)
let mapaFoco = null;     // fecha de la celda enfocable (roving tabindex, RNF-3)
let mqHeatmap = null;    // media query 1020px; se crea en init (solo navegador)

function esMovilHeatmap() {
  return mqHeatmap ? !mqHeatmap.matches : true;
}

// Fecha larga en español: «8 de octubre de 2026»
function fechaLargaES(ymd) {
  const d = parseYMD(ymd);
  return d ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : ymd;
}

// Etiqueta accesible de cada celda: tres casos fijos (RNF-3)
function ariaCeldaMapa(d) {
  const f = fechaLargaES(d.fecha);
  if (!d.pulsable) return `${f} · no disponible`;
  if (d.minutos > 0) return `${f} · ${formatoMinutos(d.minutos)} · ${d.numEntradas} entrada${d.numEntradas === 1 ? '' : 's'}`;
  return `${f} · sin estudio`;
}

// Celda de aterrizaje del foco: hoy, o el último día con datos (RNF-3)
function focoInicialHeatmap(plano, hoy) {
  const pulsables = plano.filter(d => d.pulsable);
  if (pulsables.length === 0) return plano.length > 0 ? plano[0].fecha : null;
  const celdaHoy = pulsables.find(d => d.fecha === hoy);
  if (celdaHoy) return celdaHoy.fecha;
  const conDatos = pulsables.filter(d => d.minutos > 0);
  return (conDatos.length > 0 ? conDatos[conDatos.length - 1] : pulsables[pulsables.length - 1]).fecha;
}

// Selector de año: <select> en móvil, botones en escritorio (RF-5)
function renderHeatmapYears(anios, hoy) {
  const cont = document.getElementById('heatmap-years');
  // Los botones se recrean en cada render: conservar el foco del teclado
  const btnActivo = document.activeElement
    && document.activeElement.classList
    && document.activeElement.classList.contains('year-btn')
    ? document.activeElement.textContent
    : null;
  cont.innerHTML = '';
  const anioActual = parseInt(hoy.slice(0, 4), 10);
  const pasados = anios.filter(a => a < anioActual); // el año en curso solo con «Actual»
  if (pasados.length === 0) { cont.hidden = true; return; }
  cont.hidden = false;
  const irA = (anio) => {
    mapaState = anio === null
      ? transicionMapa(mapaState, { tipo: 'VISTA_ACTUAL' }, {})
      : transicionMapa(mapaState, { tipo: 'VISTA_ANIO', anio }, {});
    renderHeatMap();
  };

  if (esMovilHeatmap()) {
    const select = document.createElement('select');
    select.className = 'form-input heatmap-select';
    select.setAttribute('aria-label', 'Elegir año del mapa de calor');
    const optActual = document.createElement('option');
    optActual.value = 'actual';
    optActual.textContent = 'Actual';
    select.appendChild(optActual);
    for (const a of [...pasados].sort((x, y) => y - x)) {
      const opt = document.createElement('option');
      opt.value = String(a);
      opt.textContent = String(a);
      select.appendChild(opt);
    }
    select.value = mapaState.vista === 'anio' ? String(mapaState.anio) : 'actual';
    select.addEventListener('change', () => {
      irA(select.value === 'actual' ? null : parseInt(select.value, 10));
    });
    cont.appendChild(select);
  } else {
    const btnActual = document.createElement('button');
    btnActual.type = 'button';
    btnActual.className = 'year-btn' + (mapaState.vista === 'actual' ? ' active' : '');
    btnActual.textContent = 'Actual';
    btnActual.addEventListener('click', () => irA(null));
    cont.appendChild(btnActual);
    for (const a of [...pasados].sort((x, y) => y - x)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'year-btn' + (mapaState.vista === 'anio' && mapaState.anio === a ? ' active' : '');
      btn.textContent = String(a);
      btn.addEventListener('click', () => irA(a));
      cont.appendChild(btn);
    }
  }

  // Devolver el foco al botón de año equivalente tras el redibujado
  if (btnActivo) {
    const btn = Array.from(cont.querySelectorAll('.year-btn'))
      .find(b => b.textContent === btnActivo);
    if (btn) btn.focus();
  }
}

function renderHeatmapGrid(modelo, hoy) {
  const grid = document.getElementById('heatmap-grid');
  // El redibujado recrea las celdas: sin guardar el foco caería al <body> y el
  // teclado dejaría de funcionar tras cualquier recálculo (RNF-3)
  const celdaActiva = document.activeElement
    && document.activeElement.classList
    && document.activeElement.classList.contains('heat-cell')
    ? document.activeElement.dataset.fecha
    : null;
  // Con scroll horizontal, el redibujado reiniciaría la posición: guardarla
  const scrollIzq = grid.scrollLeft;
  grid.innerHTML = '';
  const plano = modelo.columnas.flat();
  // Foco de aterrizaje si el actual ya no es válido
  if (!mapaFoco || !plano.some(d => d.fecha === mapaFoco && d.pulsable)) {
    mapaFoco = focoInicialHeatmap(plano, hoy);
  }
  for (const d of plano) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'heat-cell'
      + (d.nivel > 0 ? ` lvl-${d.nivel}` : '')
      + (d.esHoy ? ' today' : '')
      + ((d.esFuturo || d.fueraDeRango) ? ' dimmed' : '')
      + (mapaState.diaSel === d.fecha ? ' selected' : '');
    cell.dataset.fecha = d.fecha;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', ariaCeldaMapa(d));
    cell.tabIndex = d.pulsable && d.fecha === mapaFoco ? 0 : -1;
    if (!d.pulsable) cell.setAttribute('aria-disabled', 'true');
    grid.appendChild(cell);
  }
  // Devolver el foco a la misma celda (o a la de aterrizaje si salió del rango)
  // sin arrastrar el scroll: enfocar con scroll rompería la posición del usuario
  if (celdaActiva) {
    const destino = plano.find(d => d.fecha === celdaActiva && d.pulsable)
      || plano.find(d => d.fecha === mapaFoco && d.pulsable);
    if (destino) {
      const cell = grid.querySelector(`.heat-cell[data-fecha="${destino.fecha}"]`);
      if (cell) cell.focus({ preventScroll: true });
    }
  }
  // Reconstruir las celdas reinicia el scroll horizontal: devolver la posición
  // (ampliar la semana la cambia a propósito en ampliarHeatmap)
  grid.scrollLeft = scrollIzq;
}

function renderHeatmapDetail() {
  const det = document.getElementById('heatmap-detail');
  if (!mapaState.diaSel || !mapaModelo) {
    det.hidden = true;
    det.textContent = '';
    return;
  }
  const d = mapaModelo.columnas.flat().find(x => x.fecha === mapaState.diaSel);
  if (!d) {
    det.hidden = true;
    det.textContent = '';
    return;
  }
  det.hidden = false;
  det.textContent = d.minutos > 0
    ? `${fechaLargaES(d.fecha)} · ${formatoMinutos(d.minutos)} · ${d.numEntradas} entrada${d.numEntradas === 1 ? '' : 's'}`
    : `${fechaLargaES(d.fecha)} · sin estudio`;
}

// Render completo del mapa (se llama desde render(): RF-9)
function renderHeatMap() {
  const hoy = getTodayLocalYMD();
  let modelo = modeloMapa(state.entradas, hoy, mapaState, esMovilHeatmap());
  // Si el año visualizado se quedó sin datos, volver a «Actual» (RF-5)
  if (mapaState.vista === 'anio' && !modelo.anios.includes(mapaState.anio)) {
    mapaState = transicionMapa(mapaState, { tipo: 'VISTA_ACTUAL' }, {});
    modelo = modeloMapa(state.entradas, hoy, mapaState, esMovilHeatmap());
  }
  mapaModelo = modelo;
  // El detalle solo sobrevive si su día sigue visible (RF-6/RF-9)
  const diaVisible = mapaState.diaSel
    ? modelo.columnas.flat().some(d => d.fecha === mapaState.diaSel && d.pulsable)
    : false;
  mapaState = transicionMapa(mapaState, { tipo: 'RECALCULAR' }, { diaVisible });

  renderHeatmapYears(modelo.anios, hoy);
  renderHeatmapGrid(modelo, hoy);

  // Botón «Ver más semanas» (RF-4): visible si no se llegó al máximo del contexto
  document.getElementById('heatmap-more').hidden = modelo.numColumnas >= modelo.totalDisponible;

  // Mensajes de vacío (RF-8)
  const msg = document.getElementById('heatmap-message');
  if (state.entradas.length === 0) {
    msg.textContent = 'Tu mapa se llenará al registrar tu primera entrada.';
    msg.hidden = false;
  } else if (!modelo.hayDatosVisibles) {
    msg.textContent = 'No hay días que mostrar en este periodo.';
    msg.hidden = false;
  } else {
    msg.hidden = true;
    msg.textContent = '';
  }

  renderHeatmapDetail();
}

function seleccionarDiaMapa(fecha) {
  mapaState = transicionMapa(mapaState, { tipo: 'SELECCIONAR_DIA', fecha }, {});
  mapaFoco = fecha;
  renderHeatMap();
}

function ampliarHeatmap() {
  const esMovil = esMovilHeatmap();
  const base = esMovil ? 12 : (mapaState.vista === 'anio' ? mapaModelo.totalDisponible : 53);
  const maxExtra = Math.max(0, mapaModelo.totalDisponible - base);
  mapaState = transicionMapa(mapaState, { tipo: 'AMPLIAR' }, { maxExtra });
  renderHeatMap();
  // Las semanas nuevas se añaden a la izquierda: llevar el scroll al final
  // mantiene «hoy» a la vista (solo si el grid no cabe y hay scroll)
  const grid = document.getElementById('heatmap-grid');
  if (grid.scrollWidth > grid.clientWidth) grid.scrollLeft = grid.scrollWidth;
}

// Navegación por flechas dentro del mapa (patrón grid, RNF-3)
function moverFocoHeatmap(fechaActual, delta) {
  const pulsables = mapaModelo.columnas.flat().filter(d => d.pulsable);
  const i = pulsables.findIndex(d => d.fecha === fechaActual);
  if (i < 0) return;
  const j = Math.min(Math.max(i + delta, 0), pulsables.length - 1);
  if (j === i) return;
  mapaFoco = pulsables[j].fecha;
  renderHeatMap();
  const cell = document.querySelector(`.heat-cell[data-fecha="${mapaFoco}"]`);
  if (cell) {
    cell.focus();
    // Con scroll horizontal, el foco no siempre trae la celda a la vista
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function setupHeatmapListeners() {
  mqHeatmap = window.matchMedia('(min-width: 1020px)');
  // Recalcular el rango al cruzar el breakpoint (RF-3)
  mqHeatmap.addEventListener('change', () => {
    mapaState = transicionMapa(mapaState, { tipo: 'CAMBIO_TAMANO' }, {});
    renderHeatMap();
  });
  // Cerrar el detalle ante cualquier rotación/redimensionado (RF-6)
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (mapaState.diaSel) {
        mapaState = transicionMapa(mapaState, { tipo: 'CERRAR_DETALLE' }, {});
        renderHeatMap();
      }
    }, 150);
  });

  document.getElementById('heatmap-more').addEventListener('click', ampliarHeatmap);

  const grid = document.getElementById('heatmap-grid');
  grid.addEventListener('click', (ev) => {
    const cell = ev.target.closest('.heat-cell');
    if (!cell || cell.classList.contains('dimmed')) return;
    seleccionarDiaMapa(cell.dataset.fecha);
  });
  grid.addEventListener('keydown', (ev) => {
    const fecha = ev.target.dataset ? ev.target.dataset.fecha : null;
    if (!fecha) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      seleccionarDiaMapa(fecha);
      return;
    }
    // Orden column-major: +7 = semana siguiente, +1 = día siguiente
    const deltas = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
    if (!(ev.key in deltas)) return;
    ev.preventDefault();
    moverFocoHeatmap(fecha, deltas[ev.key]);
  });
}

// Función central: redibuja toda la interfaz a partir del estado
function render() {
  // Resumen semanal calculado una sola vez (spec 002, RNF-1)
  const resumen = resumenMetas(state.entradas, state.metas, getTodayLocalYMD());
  // Fecha usada en este render: si cambia el día con la app abierta, hay que
  // recalcular (RNF-1)
  fechaRender = getTodayLocalYMD();
  renderBooksList();
  renderBookView();
  renderStats(resumen);
  renderAjustes();
  renderWeekStrip(resumen);
  renderTodayEntries();
  renderHeatMap();
}

// --- NAVEGACIÓN POR PESTAÑAS ---
function switchTab(tab) {
  state.tab = tab;
  // El detalle del mapa se cierra al cambiar de pestaña (RF-6)
  if (mapaState.diaSel) {
    mapaState = transicionMapa(mapaState, { tipo: 'CERRAR_DETALLE' }, {});
    renderHeatmapDetail();
  }
  for (const name of ['hoy', 'libros', 'ajustes']) {
    document.getElementById('panel-' + name).hidden = name !== tab;
    const btn = document.getElementById('tab-' + name);
    const activo = name === tab;
    btn.classList.toggle('active', activo);
    btn.setAttribute('aria-selected', activo ? 'true' : 'false');
  }
}

// --- CARRUSEL DE ESTADÍSTICAS ---
// Swipe (táctil/ratón), pulsación sostenida para avance automático,
// puntos indicadores y flechas de teclado.
const CAROUSEL_COUNT = 6;
const CAROUSEL_LABELS = ['Racha actual', 'Racha más larga', 'Minutos esta semana', 'Días estudiados', 'Metas semanales', 'Semanas perfectas'];
let carouselIndex = 0;
let pressTimer = null;
let autoTimer = null;
let longPressActive = false;
let pointerStartX = null;

function setCarouselIndex(i) {
  carouselIndex = (i + CAROUSEL_COUNT) % CAROUSEL_COUNT;
  document.getElementById('carousel-track').style.transform = `translateX(-${carouselIndex * 100}%)`;
  const dots = document.getElementById('carousel-dots').children;
  for (let d = 0; d < dots.length; d++) {
    dots[d].classList.toggle('active', d === carouselIndex);
    dots[d].setAttribute('aria-selected', d === carouselIndex ? 'true' : 'false');
  }
}

function stopCarouselPress() {
  clearTimeout(pressTimer);
  clearInterval(autoTimer);
  pressTimer = null;
  autoTimer = null;
}

function setupCarousel() {
  const carousel = document.getElementById('carousel');
  const dotsEl = document.getElementById('carousel-dots');

  // Puntos indicadores
  CAROUSEL_LABELS.forEach((label, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', label);
    // Que el punto no dispare el swipe/pulsación del carrusel
    dot.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    dot.addEventListener('click', () => setCarouselIndex(i));
    dotsEl.appendChild(dot);
  });
  setCarouselIndex(0);

  carousel.addEventListener('pointerdown', (ev) => {
    pointerStartX = ev.clientX;
    longPressActive = false;
    stopCarouselPress();
    // Pulsación sostenida (500 ms): avanza sola cada 1,2 s hasta soltar
    pressTimer = setTimeout(() => {
      longPressActive = true;
      setCarouselIndex(carouselIndex + 1);
      autoTimer = setInterval(() => setCarouselIndex(carouselIndex + 1), 1200);
    }, 500);
  });

  const endPress = (ev) => {
    stopCarouselPress();
    if (pointerStartX !== null && !longPressActive && typeof ev.clientX === 'number') {
      const dx = ev.clientX - pointerStartX;
      if (dx <= -40) setCarouselIndex(carouselIndex + 1);
      else if (dx >= 40) setCarouselIndex(carouselIndex - 1);
    }
    pointerStartX = null;
  };
  carousel.addEventListener('pointerup', endPress);
  carousel.addEventListener('pointercancel', endPress);
  carousel.addEventListener('pointerleave', endPress);

  // Flechas de teclado
  carousel.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowRight') {
      setCarouselIndex(carouselIndex + 1);
      ev.preventDefault();
    } else if (ev.key === 'ArrowLeft') {
      setCarouselIndex(carouselIndex - 1);
      ev.preventDefault();
    }
  });
}

// --- ACCIONES LIBROS ---
function selectBook(bookId) {
  state.selectedBookId = bookId;
  state.editingEntryId = null;
  state.searchQuery = '';
  state.entryEditMode = null;
  // Reset formulario de entrada
  document.getElementById('form-entry').reset();
  document.getElementById('entry-id-edit').value = '';
  document.getElementById('entry-time').value = '25';
  document.getElementById('entry-form-title').textContent = 'Nueva entrada';
  document.getElementById('btn-cancel-entry').hidden = true;
  clearEntryErrors();
  render();
  // Mover foco al título del libro (accesibilidad)
  document.getElementById('book-title-display').focus();
}

function startNewBook() {
  state.editingBookId = null;
  document.getElementById('book-id-edit').value = '';
  document.getElementById('form-book').reset();
  document.getElementById('book-name').value = '';
  clearBookErrors();
  renderColorPalette(BOOK_COLORS[0]);
  document.getElementById('form-book').hidden = false;
  document.getElementById('book-name').focus();
}

function editBook(bookId) {
  const libro = state.libros.find(l => l.id === bookId);
  if (!libro) return;
  state.editingBookId = bookId;
  document.getElementById('book-id-edit').value = libro.id;
  document.getElementById('book-name').value = libro.nombre;
  clearBookErrors();
  renderColorPalette(libro.color);
  document.getElementById('form-book').hidden = false;
  document.getElementById('book-name').focus();
}

function hideBookForm() {
  state.editingBookId = null;
  document.getElementById('book-id-edit').value = '';
  document.getElementById('form-book').reset();
  clearBookErrors();
  renderColorPalette(BOOK_COLORS[0]);
  document.getElementById('form-book').hidden = true;
}

function clearBookErrors() {
  document.getElementById('book-name-error').textContent = '';
  document.getElementById('book-color-error').textContent = '';
}

function clearEntryErrors() {
  document.getElementById('entry-title-error').textContent = '';
  document.getElementById('entry-content-error').textContent = '';
  document.getElementById('entry-time-error').textContent = '';
}

// --- ACCIONES ENTRADAS ---
function editEntry(entryId) {
  const e = state.entradas.find(x => x.id === entryId);
  if (!e) return;
  state.editingEntryId = entryId;
  state.entryEditMode = 'sumar';
  document.getElementById('entry-id-edit').value = e.id;
  document.getElementById('entry-title').value = e.titulo;
  document.getElementById('entry-content').value = e.contenido || '';
  document.getElementById('entry-time').value = '25';
  // Al seguir estudiando, la sesión cuenta como de hoy (marca el día en la racha).
  document.getElementById('entry-form-title').textContent = 'Seguir estudiando este tema';
  document.getElementById('btn-cancel-entry').hidden = false;
  clearEntryErrors();
  document.getElementById('form-entry').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('entry-title').focus();
}

// Corregir el tiempo total acumulado de una entrada (reemplaza, no suma)
function correctEntryTime(entryId) {
  const e = state.entradas.find(x => x.id === entryId);
  if (!e) return;
  state.editingEntryId = entryId;
  state.entryEditMode = 'corregir';
  document.getElementById('entry-id-edit').value = e.id;
  document.getElementById('entry-title').value = e.titulo;
  document.getElementById('entry-content').value = e.contenido || '';
  document.getElementById('entry-time').value = String(e.minutos || 0);
  document.getElementById('entry-form-title').textContent = 'Corregir tiempo de estudio';
  document.getElementById('btn-cancel-entry').hidden = false;
  clearEntryErrors();
  document.getElementById('form-entry').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('entry-time').focus();
}

function deleteEntry(entryId) {
  const e = state.entradas.find(x => x.id === entryId);
  if (!e) return;
  if (!confirm(`¿Eliminar esta entrada "${e.titulo}"? Esta acción no se puede deshacer.`)) return;
  state.entradas = state.entradas.filter(x => x.id !== entryId);
  if (state.editingEntryId === entryId) {
    resetEntryForm();
  }
  saveState();
  render();
}

// Dejar el formulario de entrada en modo "nueva entrada"
function resetEntryForm() {
  state.editingEntryId = null;
  state.entryEditMode = null;
  document.getElementById('form-entry').reset();
  document.getElementById('entry-id-edit').value = '';
  document.getElementById('entry-time').value = '25';
  document.getElementById('entry-form-title').textContent = 'Nueva entrada';
  document.getElementById('btn-cancel-entry').hidden = true;
  clearEntryErrors();
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Navegación por pestañas
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Nuevo libro
  document.getElementById('btn-new-book').addEventListener('click', startNewBook);
  document.getElementById('btn-create-first-book').addEventListener('click', startNewBook);

  // Recalcular al cambiar de semana con la app abierta (RNF-1, RF-5): el intervalo
  // cubre el uso normal y 'visibilitychange'/'focus' el caso de la pestaña suspendida
  setInterval(() => {
    if (getTodayLocalYMD() !== fechaRender) render();
  }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && getTodayLocalYMD() !== fechaRender) render();
  });
  window.addEventListener('focus', () => {
    if (getTodayLocalYMD() !== fechaRender) render();
  });

  // Formulario de libro (crear / renombrar)
  document.getElementById('form-book').addEventListener('submit', (e) => {
    e.preventDefault();
    clearBookErrors();
    const nameInput = document.getElementById('book-name');
    const name = nameInput.value.trim();
    const paletteEl = document.getElementById('book-color-palette');
    let color = paletteEl.dataset.selectedColor;
    if (!BOOK_COLORS.includes(color)) color = BOOK_COLORS[0];

    let valid = true;
    if (name.length === 0) {
      document.getElementById('book-name-error').textContent = 'El nombre del libro es obligatorio.';
      valid = false;
    } else if (name.length > 40) {
      document.getElementById('book-name-error').textContent = 'El nombre no puede superar 40 caracteres.';
      valid = false;
    }
    if (!valid) return;

    const editingId = document.getElementById('book-id-edit').value;
    if (editingId) {
      // Renombrar / cambiar color
      const idx = state.libros.findIndex(l => l.id === editingId);
      if (idx >= 0) {
        state.libros[idx] = { ...state.libros[idx], nombre: name, color };
      }
      hideBookForm();
    } else {
      // Crear nuevo libro y seleccionarlo
      const nuevo = {
        id: generateId(),
        nombre: name,
        color,
        creadoEn: Date.now()
      };
      state.libros.push(nuevo);
      state.selectedBookId = nuevo.id;
      state.editingEntryId = null;
      state.searchQuery = '';
      hideBookForm();
      resetEntryForm();
    }

    saveState();
    render();
  });

  // Cancelar edición de libro
  document.getElementById('btn-cancel-book').addEventListener('click', hideBookForm);

  // Renombrar libro desde la vista del libro
  document.getElementById('btn-rename-book').addEventListener('click', () => {
    if (state.selectedBookId) {
      editBook(state.selectedBookId);
      document.getElementById('form-book').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  // Eliminar libro (con confirmación; borra también sus entradas)
  document.getElementById('btn-delete-book').addEventListener('click', () => {
    const libro = state.libros.find(l => l.id === state.selectedBookId);
    if (!libro) return;
    const count = state.entradas.filter(e => e.libroId === libro.id).length;
    if (!confirm(`¿Eliminar el libro "${libro.nombre}"? Se eliminarán también ${count} entrada${count === 1 ? '' : 's'}. Esta acción no se puede deshacer.`)) return;
    state.libros = state.libros.filter(l => l.id !== libro.id);
    state.entradas = state.entradas.filter(e => e.libroId !== libro.id);
    if (state.selectedBookId === libro.id) {
      state.selectedBookId = null;
      state.editingEntryId = null;
    }
    saveState();
    render();
  });

  // Formulario de entrada (crear / editar)
  document.getElementById('form-entry').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.selectedBookId) {
      showToast('Selecciona un libro para añadir entradas.');
      return;
    }
    clearEntryErrors();
    const titleInput = document.getElementById('entry-title');
    const contentInput = document.getElementById('entry-content');
    const timeInput = document.getElementById('entry-time');
    const title = titleInput.value.trim();
    const content = contentInput.value;
    const date = getTodayLocalYMD();
    const minutos = parseInt(timeInput.value, 10);

    let valid = true;
    if (title.length === 0) {
      document.getElementById('entry-title-error').textContent = 'El título es obligatorio.';
      valid = false;
    }
    if (timeInput.value.trim() === '' || Number.isNaN(minutos)) {
      document.getElementById('entry-time-error').textContent = 'El tiempo de estudio es obligatorio.';
      valid = false;
    } else if (minutos <= 0) {
      document.getElementById('entry-time-error').textContent = 'No puedes estudiar sin asignar tiempo.';
      valid = false;
    }
    if (!valid) return;

    const editingId = document.getElementById('entry-id-edit').value;
    if (editingId) {
      const idx = state.entradas.findIndex(x => x.id === editingId);
      if (idx >= 0) {
        const actuales = state.entradas[idx];
        let sesiones;
        if (state.entryEditMode === 'corregir') {
          // Reemplaza el historial por una única sesión con el total corregido.
          // Conserva la fecha de la entrada: corregir no marca el día de hoy.
          sesiones = [{ fecha: actuales.fecha, minutos: minutos }];
        } else {
          // 'sumar': añade la sesión de hoy; si ya hay ese día, se agrupan los minutos
          sesiones = getSesiones(actuales).map(s => ({ ...s }));
          const existente = sesiones.find(s => s.fecha === date);
          if (existente) {
            existente.minutos += minutos;
          } else {
            sesiones.push({ fecha: date, minutos: minutos });
          }
          sesiones.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
        }
        const minutosTotal = sesiones.reduce((acc, s) => acc + s.minutos, 0);
        state.entradas[idx] = {
          ...actuales,
          titulo: title,
          contenido: content,
          fecha: sesiones.length > 0 ? sesiones[sesiones.length - 1].fecha : date,
          minutos: minutosTotal,
          sesiones: sesiones
        };
      }
      resetEntryForm();
    } else {
      const nuevo = {
        id: generateId(),
        libroId: state.selectedBookId,
        titulo: title,
        contenido: content,
        fecha: date,
        creadoEn: Date.now(),
        minutos: minutos,
        sesiones: [{ fecha: date, minutos: minutos }]
      };
      state.entradas.push(nuevo);
      resetEntryForm();
    }

    saveState();
    render();
  });

  // Cancelar edición de entrada
  document.getElementById('btn-cancel-entry').addEventListener('click', resetEntryForm);

  // Meta semanal: cada cambio se guarda en el historial con su fecha de vigencia
  // (spec 002, RF-1)
  document.getElementById('meta-select').addEventListener('change', (e) => {
    state.metas = guardarMetaSemanal(state.metas, Number(e.target.value), getTodayLocalYMD());
    saveState();
    render();
  });

  // Búsqueda
  document.getElementById('entry-search').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderEntries();
  });
  document.getElementById('btn-clear-search').addEventListener('click', () => {
    state.searchQuery = '';
    document.getElementById('entry-search').value = '';
    renderEntries();
    document.getElementById('entry-search').focus();
  });

  // Exportar datos a JSON
  document.getElementById('btn-export').addEventListener('click', () => {
    try {
      const payload = {
        libros: state.libros,
        entradas: state.entradas,
        metas: state.metas,
        exportadoEn: new Date().toISOString(),
        version: 2
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diario-estudio-${getTodayLocalYMD()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Datos exportados correctamente.');
    } catch (err) {
      console.warn(err);
      showToast('Error al exportar los datos.');
    }
  });

  // Importar datos desde JSON (validando estructura antes de reemplazar)
  document.getElementById('input-import').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const parsed = JSON.parse(text);
        if (!validateImportedData(parsed)) {
          showToast('Archivo JSON inválido. No coincide con la estructura esperada.');
          e.target.value = '';
          return;
        }
        const ok = confirm('Esto reemplazará TODOS los datos actuales (libros y entradas). ¿Continuar?');
        if (!ok) {
          e.target.value = '';
          return;
        }
        // Reemplazar estado con copias de los datos importados
        state.libros = parsed.libros.map(l => ({ ...l }));
        state.entradas = parsed.entradas.map(x => normalizarEntrada(x));
        state.metas = normalizarMetas(parsed.metas);
        state.selectedBookId = null;
        state.editingBookId = null;
        state.editingEntryId = null;
        state.entryEditMode = null;
        state.searchQuery = '';
        saveState();
        render();
        e.target.value = '';
        showToast('Datos importados correctamente.');
      } catch (err) {
        console.warn(err);
        showToast('Error al leer o procesar el archivo JSON.');
        e.target.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  });
}

// --- INICIALIZACIÓN ---
function init() {
  const loaded = loadState();
  state.libros = loaded.libros;
  state.entradas = loaded.entradas;
  state.metas = loaded.metas;
  state.selectedBookId = null;
  state.editingBookId = null;
  state.editingEntryId = null;
  state.entryEditMode = null;
  state.searchQuery = '';
  state.tab = 'hoy';

  setupEventListeners();
  setupCarousel();
  setupHeatmapListeners();

  // Inicializar UI
  clearBookErrors();
  clearEntryErrors();
  document.getElementById('btn-cancel-entry').hidden = true;
  renderColorPalette(BOOK_COLORS[0]);
  document.getElementById('entry-time').value = '25';
  switchTab('hoy');
  render();
}

// Ejecutar al cargar el DOM (solo en navegador; en Node solo se usa la lógica)
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

// Exportar lógica pura para tests con node --test (constitución P4)
if (typeof module !== 'undefined') {
  module.exports = {
    lunesDeYMD,
    nivelIntensidad,
    computeDiasEstudio,
    formatoMinutos,
    aniosConDatos,
    rangoVistaActual,
    numSemanasDeAnio,
    rangoVistaAnio,
    construirModeloSemanas,
    modeloMapa,
    transicionMapa,
    // Persistencia del historial de metas (spec 002): 'normalizarMetas' es pura;
    // 'validateImportedData' y 'loadState' se exportan para probar la carga y la
    // importación de datos antiguos sin historial (RNF-2).
    normalizarMetas,
    validateImportedData,
    loadState,
    // Vigencia de la meta semanal (RF-1, RF-2)
    metaVigenteDe,
    guardarMetaSemanal,
    metaPendiente,
    metaSemanaActual,
    computeDiasEstudio,
    diasConMinutos,
    diasEstudiadosSemana,
    semanasAEvaluar,
    resumenSemanas,
    rachasDeSemanas,
    resumenMetas,
    fechaLogroMeta,
    esPerfectaHoy,
    estadoFuegoHoy,
    diasPosiblesSemana,
    textoMetaDias,
    textoFaltanDias,
    textoGuiaMeta,
    textoTarjetaRacha
  };
}
