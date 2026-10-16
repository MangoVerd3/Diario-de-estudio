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
  archivo: [],     // [{ libroId, archivadoEn, sesiones }] huella de estudio (spec 003)
  selectedBookId: null,
  ficha: { abierta: null, opcion: 'entradas', confirmando: false, busqueda: '' }, // sesión (spec 003, RF-6: no persiste)
  editingBookId: null,
  editingEntryId: null,
  entryEditMode: null, // 'sumar' (seguir estudiando) | 'corregir' (reemplazar total)
  entryFormOpen: false, // formulario de entrada desplegado (sesión, RF-8)
  resaltarEntradaId: null, // destino del deep-link desde Hoy (sesión, RF-10)
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

// --- LIBROS Y FUENTES (spec 003) ---
// Normalización de libros y fuentes (RNF-3): ante datos antiguos o corruptos se
// normaliza sin perder nada del usuario (P5). Funciones puras, sin DOM.

// Enlace válido (RF-14): solo http:// o https://; sin esquema se completa con
// https://; cualquier otro esquema, vacío, >500 caracteres o espacios → null.
function normalizarUrlFuente(texto) {
  if (typeof texto !== 'string') return null;
  let u = texto.trim();
  if (u === '' || u.length > 500) return null;
  if (/\s/.test(u)) return null;
  const minusculas = u.toLowerCase();
  const tieneEsquema = /^[a-z][a-z0-9+.-]*:/.test(minusculas);
  if (!tieneEsquema) {
    u = 'https://' + u;
  }
  const esquema = u.toLowerCase();
  if (!esquema.startsWith('http://') && !esquema.startsWith('https://')) return null;
  const resto = u.slice(esquema.startsWith('https://') ? 8 : 7);
  if (resto === '' || /\s/.test(resto)) return null;
  return u;
}

// Fuente válida o null (solo se descarta ella, RNF-3): título 1–60 tras trim,
// url http(s), id propio (se genera si falta).
function normalizarFuente(f) {
  if (!f || typeof f !== 'object') return null;
  if (typeof f.titulo !== 'string') return null;
  const titulo = f.titulo.trim();
  if (titulo === '' || titulo.length > 60) return null;
  const url = normalizarUrlFuente(f.url ?? '');
  if (url === null) return null;
  const id = typeof f.id === 'string' && f.id !== '' ? f.id : generateId();
  return { id, titulo, url };
}

// Lista de fuentes válida, en orden y recortada a 20 (RF-14). Tolera no-array.
function normalizarFuentes(valor) {
  if (!Array.isArray(valor)) return [];
  return valor.map(f => normalizarFuente(f)).filter(f => f !== null).slice(0, 20);
}

// Libro completo (RNF-3, RF-13, RF-14): contenido/origen ausentes → '', recorte
// a 500; fuentes normalizadas; color fuera de paleta → primer color; sin
// id/nombre válidos → null (el resto de libros no se pierde, P5).
function normalizarLibro(l) {
  if (!l || typeof l !== 'object') return null;
  if (typeof l.id !== 'string' || typeof l.nombre !== 'string') return null;
  return {
    ...l,
    contenido: typeof l.contenido === 'string' ? l.contenido.slice(0, 500) : '',
    origen: typeof l.origen === 'string' ? l.origen.slice(0, 500) : '',
    fuentes: normalizarFuentes(l.fuentes),
    color: BOOK_COLORS.includes(l.color) ? l.color : BOOK_COLORS[0]
  };
}

// Nombre único de libro (RF-7, RF-13, E1): obligatorio, ≤40, único con
// trim().toLowerCase() excluyendo el propio libro (excluirId). Se aplica igual
// al crear (excluirId null) y al renombrar. Pura, sin DOM.
function validarNombreLibro(nombre, libros, excluirId) {
  const texto = typeof nombre === 'string' ? nombre.trim() : '';
  if (texto === '') return { ok: false, error: 'El nombre del libro es obligatorio.' };
  if (texto.length > 40) return { ok: false, error: 'El nombre no puede superar 40 caracteres.' };
  const clave = texto.toLowerCase();
  const lista = Array.isArray(libros) ? libros : [];
  for (const l of lista) {
    if (!l || l.id === excluirId) continue;
    if (typeof l.nombre === 'string' && l.nombre.trim().toLowerCase() === clave) {
      return { ok: false, error: 'Ya tienes un libro con ese nombre' };
    }
  }
  return { ok: true };
}

// Inicial del icono-libro (RF-2, §8.6): primer carácter distinto de espacio, en
// mayúscula (conserva acentos y caracteres no latinos). Sin letra → ''.
function inicialLibro(nombre) {
  if (typeof nombre !== 'string') return '';
  for (const ch of nombre) {
    if (!/\s/.test(ch)) return ch.toUpperCase();
  }
  return '';
}

// Luminancia relativa WCAG 2.x de un hex '#rrggbb' (0..1).
function luminanciaHex(hex) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const canales = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const lin = canales.map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

// Tinta del icono sobre el color del libro (RF-2, RNF-7): oscura '#1c1917' o
// blanca '#ffffff', la de mayor contraste (umbral de texto 4.5:1). El icono es
// decorativo (aria-hidden) y nunca sustituye al nombre. Pura, sin DOM.
function colorTextoLibro(colorHex) {
  const lumFondo = luminanciaHex(colorHex);
  if (lumFondo === null) return '#1c1917';
  const contraste = (lum) => {
    const claro = Math.max(lum, lumFondo);
    const oscuro = Math.min(lum, lumFondo);
    return (claro + 0.05) / (oscuro + 0.05);
  };
  const lumOscura = luminanciaHex('#1c1917');
  const lumBlanca = luminanciaHex('#ffffff');
  return contraste(lumOscura) >= contraste(lumBlanca) ? '#1c1917' : '#ffffff';
}

// Huella de estudio (spec 003, RF-16–RF-18, RNF-1–RNF-3): al eliminar un libro
// se conservan solo las sesiones (fecha + minutos) de sus entradas, un registro
// por entrada `{libroId, archivadoEn, sesiones}`, sin título ni contenido
// (INV-3). Las métricas leen entradas + huella (INV-2, T4). Puras, sin DOM.

// Agrupa sesiones por fecha sumando minutos (como normalizarEntrada): solo
// `{fecha: string, minutos: number >= 0}`, ordenadas por fecha.
function agruparSesionesHuella(sesiones) {
  const porFecha = {};
  for (const s of sesiones) {
    if (s && typeof s.fecha === 'string' && typeof s.minutos === 'number' && s.minutos >= 0) {
      porFecha[s.fecha] = (porFecha[s.fecha] || 0) + s.minutos;
    }
  }
  return Object.keys(porFecha).sort().map(f => ({ fecha: f, minutos: porFecha[f] }));
}

// Huella válida (RNF-3): no-array → []; registros corruptos (sin libroId string
// o sin sesiones válidas) se descartan sin perder el resto; `archivadoEn`
// ausente → 0.
function normalizarArchivo(valor) {
  if (!Array.isArray(valor)) return [];
  const huella = [];
  for (const r of valor) {
    if (!r || typeof r !== 'object') continue;
    if (typeof r.libroId !== 'string') continue;
    if (!Array.isArray(r.sesiones)) continue;
    const sesiones = agruparSesionesHuella(r.sesiones);
    if (sesiones.length === 0) continue;
    const archivadoEn = (typeof r.archivadoEn === 'number' || typeof r.archivadoEn === 'string')
      ? r.archivadoEn
      : 0;
    huella.push({ libroId: r.libroId, archivadoEn, sesiones });
  }
  return huella;
}

// Archiva un libro (RF-16, RNF-1): lo borra de lo visible junto a sus entradas
// y añade un registro por entrada con copia de sus sesiones. Sin entradas →
// huella intacta. No muta los arrays ni las entradas de entrada.
function archivarLibro(libros, entradas, archivo, libroId, ahora) {
  const listaLibros = Array.isArray(libros) ? libros : [];
  const listaEntradas = Array.isArray(entradas) ? entradas : [];
  const huella = Array.isArray(archivo) ? archivo : [];
  const existe = listaLibros.some(l => l && l.id === libroId);
  if (!existe) {
    return { libros: [...listaLibros], entradas: [...listaEntradas], archivo: [...huella] };
  }
  const delLibro = listaEntradas.filter(e => e && e.libroId === libroId);
  const nuevos = delLibro.map(e => {
    let sesiones = agruparSesionesHuella(getSesiones(e));
    // Entrada antigua sin sesiones válidas: una sesión con su fecha y total
    // (igual que normalizarEntrada) para no perder la huella.
    if (sesiones.length === 0 && e && typeof e.fecha === 'string') {
      const min = typeof e.minutos === 'number' && e.minutos >= 0 ? e.minutos : 0;
      sesiones = [{ fecha: e.fecha, minutos: min }];
    }
    return { libroId, archivadoEn: ahora, sesiones };
  }).filter(r => r.sesiones.length > 0);
  return {
    libros: listaLibros.filter(l => !(l && l.id === libroId)),
    entradas: listaEntradas.filter(e => !(e && e.libroId === libroId)),
    archivo: [...huella, ...nuevos]
  };
}

// Puente único de las métricas hacia entradas + huella (spec 003, RF-17,
// §3.3): las métricas 001/002 conservan su algoritmo intacto y solo cambia de
// dónde salen las sesiones que se les pasan. Puras, sin DOM.

// Todas las sesiones válidas (activas + huella) como `{fecha, minutos}`.
function sesionesTodas(entradas, archivo = []) {
  const lista = [];
  const listaEntradas = Array.isArray(entradas) ? entradas : [];
  for (const e of listaEntradas) {
    if (!e || typeof e !== 'object') continue;
    for (const s of getSesiones(e)) {
      if (s && typeof s.fecha === 'string' && typeof s.minutos === 'number' && s.minutos >= 0) {
        lista.push({ fecha: s.fecha, minutos: s.minutos });
      }
    }
  }
  const huella = Array.isArray(archivo) ? archivo : [];
  for (const r of huella) {
    if (!r || !Array.isArray(r.sesiones)) continue;
    for (const s of r.sesiones) {
      if (s && typeof s.fecha === 'string' && typeof s.minutos === 'number' && s.minutos >= 0) {
        lista.push({ fecha: s.fecha, minutos: s.minutos });
      }
    }
  }
  return lista;
}

// Entradas activas más una pseudo-entrada por registro de huella (con copia de
// sus sesiones): reutiliza sin cambios getSesiones, las métricas y el mapa.
// «Entradas de hoy», listas, búsqueda y resumenLibro NO usan esta combinación
// (RF-18).
function combinarParaMetricas(entradas, archivo = []) {
  const lista = Array.isArray(entradas) ? [...entradas] : [];
  const huella = Array.isArray(archivo) ? archivo : [];
  huella.forEach((r, i) => {
    if (!r || !Array.isArray(r.sesiones)) return;
    lista.push({
      id: 'huella:' + (typeof r.libroId === 'string' ? r.libroId : i) + ':' + (r.archivadoEn ?? i),
      sesiones: r.sesiones.map(s => ({ ...s }))
    });
  });
  return lista;
}

// Límite de fuentes por libro (RF-14, T8): con 20 el botón de añadir se
// desactiva y se muestra un aviso. Pura, sin DOM.
function puedeAnadirFuente(fuentes) {
  if (!Array.isArray(fuentes)) return true;
  return fuentes.length < 20;
}

// Detalle de la confirmación de borrado (RF-15, T9): frase que acompaña a la
// pregunta exacta «¿Estás seguro de eliminar el libro?», con singular/plural
// (RNF-10). Pura, sin DOM.
function textoDetalleBorrado(numEntradas) {
  const n = Number.isInteger(numEntradas) && numEntradas >= 0 ? numEntradas : 0;
  if (n === 1) return 'Se eliminará 1 entrada, su contenido, su origen y sus enlaces.';
  return `Se eliminarán ${n} entradas, su contenido, su origen y sus enlaces.`;
}

// Contador de la ficha (RF-1, RF-18): solo entradas activas; la huella no sale
// en contadores ni en listas. Pura, sin DOM.
function resumenLibro(libro, entradasDeLibro) {
  const lista = Array.isArray(entradasDeLibro) ? entradasDeLibro : [];
  return {
    numEntradas: lista.length,
    minutos: lista.reduce((acc, e) => acc + (e && typeof e.minutos === 'number' && e.minutos > 0 ? e.minutos : 0), 0)
  };
}

// Máquina de estado de sesión de las fichas (spec 003, RF-4–RF-6, RF-15, §3.4):
// `ficha = {abierta: id|null, opcion: 'entradas'|'fuentes'|'editar',
// confirmando: bool, busqueda: string}`. Solo vive en sesión (no persiste:
// al recargar todo empieza cerrado, RF-6). Una sola ficha abierta (D-4);
// abrir resetea a Entradas y limpia la confirmación y la búsqueda (RF-9);
// cambiar de opción limpia `confirmando` pero conserva la búsqueda.
// Pura, sin DOM.
const OPCIONES_FICHA = ['entradas', 'fuentes', 'editar'];

function transicionFicha(ficha, accion) {
  const base = ficha && typeof ficha === 'object' ? ficha : {};
  const actual = {
    abierta: typeof base.abierta === 'string' ? base.abierta : null,
    opcion: OPCIONES_FICHA.includes(base.opcion) ? base.opcion : 'entradas',
    confirmando: base.confirmando === true,
    busqueda: typeof base.busqueda === 'string' ? base.busqueda : ''
  };
  const tipo = accion && typeof accion === 'object' ? accion.tipo : null;
  switch (tipo) {
    case 'ABRIR':
      if (typeof accion.id !== 'string') return { ...actual };
      return { abierta: accion.id, opcion: 'entradas', confirmando: false, busqueda: '' };
    case 'CERRAR':
      return { abierta: null, opcion: 'entradas', confirmando: false, busqueda: '' };
    case 'ALTERNAR':
      if (typeof accion.id !== 'string') return { ...actual };
      if (actual.abierta === accion.id) {
        return { abierta: null, opcion: 'entradas', confirmando: false, busqueda: '' };
      }
      return { abierta: accion.id, opcion: 'entradas', confirmando: false, busqueda: '' };
    case 'OPCION':
      if (!OPCIONES_FICHA.includes(accion.opcion)) return { ...actual };
      return { ...actual, opcion: accion.opcion, confirmando: false };
    case 'CONFIRMAR':
      return { ...actual, confirmando: true };
    case 'CANCELAR_CONFIRMAR':
      return { ...actual, confirmando: false };
    case 'BORRADA':
      return { abierta: null, opcion: 'entradas', confirmando: false, busqueda: '' };
    default:
      return { ...actual };
  }
}

// Conjunto de fechas únicas con al menos una sesión
function getFechasEstudiadas(entradas, archivo = []) {
  const efectivas = combinarParaMetricas(entradas, archivo);
  const dateSet = new Set();
  for (const e of efectivas) {
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
function hayEntradasAnteriores(entradas, lunes, archivo = []) {
  const efectivas = combinarParaMetricas(entradas, archivo);
  for (const e of efectivas) {
    for (const s of getSesiones(e)) {
      if (s && typeof s.fecha === 'string' && s.fecha < lunes) return true;
    }
  }
  return false;
}

// Resumen semanal (RNF-1): una sola pasada sobre las entradas alimenta la tira, la
// guía, los fuegos y las tarjetas del carrusel.
function resumenMetas(entradas, metas, hoy, archivo = []) {
  const efectivas = combinarParaMetricas(entradas, archivo);
  const dias = computeDiasEstudio(efectivas, hoy);
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
  const hayAnteriores = hayEntradasAnteriores(efectivas, lunes);
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
    if (!raw) return { libros: [], entradas: [], metas: [], archivo: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Datos no válidos');
    }
    // Validación básica de estructura (prevención de datos corruptos).
    // Los libros antiguos (sin contenido/origen/fuentes) se normalizan sin
    // perder nada (spec 003, RNF-3); los inválidos sin id/nombre se descartan
    // uno a uno sin perder el resto (P5).
    const libros = Array.isArray(parsed.libros) ? parsed.libros : [];
    const entradas = Array.isArray(parsed.entradas) ? parsed.entradas : [];
    const librosValidos = libros
      .filter(l => l && typeof l.creadoEn === 'number')
      .map(l => normalizarLibro(l))
      .filter(l => l !== null);
    const entradasValidas = entradas
      .filter(e => e && typeof e.id === 'string' && typeof e.libroId === 'string' && typeof e.titulo === 'string' && typeof e.fecha === 'string' && typeof e.creadoEn === 'number')
      .map(e => normalizarEntrada(e));
    // El historial de metas es opcional (datos antiguos, RNF-2): se normaliza
    // sin perder nada de lo ya guardado (P5). La huella inexistente equivale a
    // huella vacía (spec 003, RNF-3).
    return { libros: librosValidos, entradas: entradasValidas, metas: normalizarMetas(parsed.metas), archivo: normalizarArchivo(parsed.archivo) };
  } catch (err) {
    console.warn('Error al cargar datos de localStorage:', err);
    return { libros: [], entradas: [], metas: [], archivo: [] };
  }
}

function saveState() {
  try {
    const payload = {
      libros: state.libros,
      entradas: state.entradas,
      metas: state.metas,
      archivo: state.archivo,
      version: 3
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
  // 'metas' y 'archivo' no se validan aquí: pueden faltar (datos antiguos) o
  // venir corruptos y el archivo sigue siendo importable; se normalizan al
  // importar (RNF-2, RNF-3, P5). Las 'fuentes' viven dentro de cada libro y
  // tampoco bloquean la importación: la fuente corrupta se descarta una a una.
  if (!Array.isArray(obj.libros)) return false;
  if (!Array.isArray(obj.entradas)) return false;
  const libroOk = obj.libros.every(l => l && typeof l.id === 'string' && typeof l.nombre === 'string' && typeof l.color === 'string' && typeof l.creadoEn === 'number');
  if (!libroOk) return false;
  const entradaOk = obj.entradas.every(e => e && typeof e.id === 'string' && typeof e.libroId === 'string' && typeof e.titulo === 'string' && typeof e.fecha === 'string' && typeof e.creadoEn === 'number' && (e.minutos === undefined || (typeof e.minutos === 'number' && e.minutos >= 0)) && (e.sesiones === undefined || Array.isArray(e.sesiones)));
  if (!entradaOk) return false;
  return true;
}

// Exportación version 3 (spec 003, RNF-3): incluye libros (con contenido,
// origen y fuentes), entradas, metas y huella (archivo). Pura, sin DOM: el
// handler solo la serializa y descarga.
function construirExportacion(estado) {
  const e = estado && typeof estado === 'object' ? estado : {};
  return {
    libros: Array.isArray(e.libros) ? e.libros.map(l => ({ ...l })) : [],
    entradas: Array.isArray(e.entradas) ? e.entradas.map(x => ({ ...x })) : [],
    metas: Array.isArray(e.metas) ? e.metas.map(m => ({ ...m })) : [],
    archivo: Array.isArray(e.archivo)
      ? e.archivo.map(r => ({
        ...r,
        sesiones: Array.isArray(r.sesiones) ? r.sesiones.map(s => ({ ...s })) : []
      }))
      : [],
    exportadoEn: new Date().toISOString(),
    version: 3
  };
}

// Normaliza un JSON importado de cualquier versión (RNF-3, criterio 7): misma
// normalización que loadState; lo antiguo sin contenido/origen/fuentes/archivo
// queda en ''/''/[]/[] sin perder nada. La importación reemplaza todo a la
// vez, huella incluida. Pura, sin DOM.
function normalizarDatosImportados(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { libros: [], entradas: [], metas: [], archivo: [] };
  }
  const libros = Array.isArray(parsed.libros) ? parsed.libros : [];
  const entradas = Array.isArray(parsed.entradas) ? parsed.entradas : [];
  return {
    libros: libros
      .filter(l => l && typeof l.creadoEn === 'number')
      .map(l => normalizarLibro(l))
      .filter(l => l !== null),
    entradas: entradas
      .filter(e => e && typeof e.id === 'string' && typeof e.libroId === 'string' && typeof e.titulo === 'string' && typeof e.fecha === 'string' && typeof e.creadoEn === 'number')
      .map(e => normalizarEntrada(e)),
    metas: normalizarMetas(parsed.metas),
    archivo: normalizarArchivo(parsed.archivo)
  };
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
function computeStreak(allEntradas, archivo = []) {
  const dateSet = getFechasEstudiadas(allEntradas, archivo);
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
function computeWeeklyMinutes(allEntradas, archivo = []) {
  const today = getTodayLocalYMD();
  const todayDate = ymdToDate(today);
  if (!todayDate) return 0;
  // Lunes de esta semana (getDay: 0=domingo ... 6=sábado)
  const offsetLunes = (todayDate.getDay() + 6) % 7;
  const lunes = addDaysYMD(today, -offsetLunes);
  const domingo = addDaysYMD(lunes, 6);
  let total = 0;
  for (const e of combinarParaMetricas(allEntradas, archivo)) {
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
function computeStudyDays(allEntradas, archivo = []) {
  const today = getTodayLocalYMD();
  const daySet = new Set();
  for (const e of combinarParaMetricas(allEntradas, archivo)) {
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
function computeDiasEstudio(entradas, hoy, archivo = []) {
  const dias = {};
  for (const e of combinarParaMetricas(entradas, archivo)) {
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
function aniosConDatos(entradas, hoy, archivo = []) {
  const anios = new Set();
  for (const e of combinarParaMetricas(entradas, archivo)) {
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
function modeloMapa(entradas, hoy, mapaState, esMovil, archivo = []) {
  const dias = computeDiasEstudio(entradas, hoy, archivo);
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
    anios: aniosConDatos(entradas, hoy, archivo)
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

// --- REJILLA DE FICHAS + PANEL CON TABS (spec 003, T6, RF-1–RF-6) ---
// Una sola ficha abierta (D-4); el panel es un elemento persistente (no se
// reconstruye: conserva foco y formularios) que se coloca dentro de la rejilla
// justo bajo la fila de su ficha (`grid-column: 1 / -1`). El estado vive solo
// en sesión: cambiar de pestaña lo conserva, recargar lo cierra (RF-6).
let panelAbiertaId = null; // id con animación de apertura ya aplicada
let panelTimer = null;      // cierre diferido para la animación de 180 ms

function columnasRejilla() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(min-width: 1020px)').matches) return 3;
    if (window.matchMedia('(min-width: 640px)').matches) return 2;
  }
  return 1;
}

function movimientoReducido() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function renderBooksList() {
  const listEl = document.getElementById('books-list');
  const emptyEl = document.getElementById('books-empty');
  const panel = document.getElementById('ficha-panel');
  // Solo se retiran las fichas: el panel persiste (foco y formularios intactos)
  listEl.querySelectorAll(':scope > .ficha').forEach(n => n.remove());
  if (panel && panel.parentNode === listEl) listEl.removeChild(panel);

  if (state.libros.length === 0) {
    listEl.hidden = true;
    emptyEl.hidden = false;
    if (panel) panel.hidden = true;
    panelAbiertaId = null;
    return;
  }
  listEl.hidden = false;
  emptyEl.hidden = true;

  // Orden de más antigua a más reciente (RF-1)
  const librosOrdenados = [...state.libros].sort((a, b) => a.creadoEn - b.creadoEn);
  const botones = [];

  for (const libro of librosOrdenados) {
    const resumen = resumenLibro(libro, state.entradas.filter(e => e.libroId === libro.id));
    const abierta = state.ficha.abierta === libro.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ficha' + (abierta ? ' abierta' : '');
    btn.dataset.bookId = libro.id;
    btn.setAttribute('aria-expanded', abierta ? 'true' : 'false');
    btn.setAttribute('aria-controls', 'ficha-panel');

    const icono = document.createElement('span');
    icono.className = 'ficha-icon';
    icono.setAttribute('aria-hidden', 'true');
    icono.style.setProperty('--libro-color', libro.color);
    icono.style.setProperty('--libro-tinta', colorTextoLibro(libro.color));
    const inicial = document.createElement('span');
    inicial.className = 'ficha-inicial';
    inicial.textContent = inicialLibro(libro.nombre);
    icono.appendChild(inicial);

    const info = document.createElement('span');
    info.className = 'ficha-info';
    const nombre = document.createElement('span');
    nombre.className = 'ficha-nombre';
    nombre.textContent = libro.nombre;
    const meta = document.createElement('span');
    meta.className = 'ficha-meta';
    meta.textContent = `${resumen.numEntradas} entrada${resumen.numEntradas === 1 ? '' : 's'} · ${resumen.minutos} min`;
    info.appendChild(nombre);
    info.appendChild(meta);

    btn.appendChild(icono);
    btn.appendChild(info);
    btn.addEventListener('click', () => alternarFicha(libro.id));
    listEl.appendChild(btn);
    botones.push(btn);
  }

  // Panel a ancho completo bajo la fila de su ficha (RF-4, RNF-8)
  const libroAbierto = state.libros.find(l => l.id === state.ficha.abierta);
  if (!libroAbierto || !panel) {
    // Plegar: 180 ms de salida (0 ms con movimiento reducido, RNF-5/RNF-6)
    if (panel && !panel.hidden) {
      if (movimientoReducido()) {
        panel.hidden = true;
      } else {
        if (panelTimer) clearTimeout(panelTimer);
        panel.classList.add('is-closing');
        panelTimer = setTimeout(() => {
          panel.hidden = true;
          panel.classList.remove('is-closing');
        }, 180);
      }
    }
    panelAbiertaId = null;
    return;
  }
  const cols = columnasRejilla();
  const idx = librosOrdenados.findIndex(l => l.id === libroAbierto.id);
  const finFila = Math.min((Math.floor(idx / cols) + 1) * cols, librosOrdenados.length);
  if (finFila >= botones.length) {
    listEl.appendChild(panel);
  } else {
    listEl.insertBefore(panel, botones[finFila]);
  }
  panel.setAttribute('aria-label', `Libro ${libroAbierto.nombre}`);
  renderFichaTabs(false);

  // Apertura 220 ms / cierre 180 ms; una sola animación por acción y 0 ms con
  // movimiento reducido (RNF-5, RNF-6). El foco queda en la ficha (RNF-7).
  if (panelTimer) {
    clearTimeout(panelTimer);
    panelTimer = null;
  }
  panel.classList.remove('is-closing');
  if (panelAbiertaId !== libroAbierto.id || panel.hidden) {
    panel.hidden = false;
    if (!movimientoReducido()) {
      panel.classList.remove('is-opening');
      void panel.offsetWidth;
      panel.classList.add('is-opening');
    }
    panelAbiertaId = libroAbierto.id;
  }
}

// Tabs Entradas / Fuentes / Editar (RF-5, RNF-7): `tab`/`tabpanel` con
// `aria-selected`; cambio con fundido 160 ms. `animar` solo al cambiar de
// opción por acción del usuario, no en cada render.
function renderFichaTabs(animar) {
  const panel = document.getElementById('ficha-panel');
  if (!panel) return;
  const opciones = ['entradas', 'fuentes', 'editar'];
  for (const op of opciones) {
    const tab = document.getElementById('ficha-tab-' + op);
    const page = document.getElementById('ficha-page-' + op);
    if (!tab || !page) continue;
    const activa = state.ficha.opcion === op;
    tab.setAttribute('aria-selected', activa ? 'true' : 'false');
    tab.tabIndex = activa ? 0 : -1;
    page.hidden = !activa;
    if (activa && animar && !movimientoReducido()) {
      page.classList.remove('is-switching');
      void page.offsetWidth;
      page.classList.add('is-switching');
    } else if (!animar) {
      page.classList.remove('is-switching');
    }
  }
}

function fijarOpcionFicha(opcion) {
  state.ficha = transicionFicha(state.ficha, { tipo: 'OPCION', opcion });
  state.selectedBookId = state.ficha.abierta;
  renderFichaTabs(true);
  // Cambiar de tab limpia la confirmación de borrado (transicionFicha OPCION)
  renderZonaBorrado();
}

function alternarFicha(libroId) {
  state.ficha = transicionFicha(state.ficha, { tipo: 'ALTERNAR', id: libroId });
  state.selectedBookId = state.ficha.abierta;
  // La búsqueda es por libro y se limpia al abrir otro (RF-9); el formulario
  // de entrada también se cierra para no arrastrar una edición a medias.
  state.searchQuery = state.ficha.busqueda;
  const buscador = document.getElementById('entry-search');
  if (buscador && buscador.value !== state.searchQuery) buscador.value = state.searchQuery;
  resetEntryForm();
  render();
}

// Teclado de los tabs (RNF-7): flechas ←/→ e Inicio/Fin se mueven y activan.
function setupFichaTabs() {
  const tabs = ['entradas', 'fuentes', 'editar']
    .map(op => document.getElementById('ficha-tab-' + op))
    .filter(Boolean);
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => fijarOpcionFicha(tab.id.replace('ficha-tab-', '')));
    tab.addEventListener('keydown', (ev) => {
      let j = null;
      if (ev.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (ev.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (ev.key === 'Home') j = 0;
      else if (ev.key === 'End') j = tabs.length - 1;
      if (j === null) return;
      ev.preventDefault();
      tabs[j].focus();
      fijarOpcionFicha(tabs[j].id.replace('ficha-tab-', ''));
    });
  });
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
  // La vista de detalle separada se eliminó en T6: el panel de la ficha
  // abierta muestra las entradas (T7), fuentes (T8) y edición (T8/T9).
  // Se conserva la búsqueda del libro abierto y se pinta su lista.
  const libro = state.libros.find(l => l.id === state.ficha.abierta);
  if (!libro) return;
  state.selectedBookId = libro.id;
  const buscador = document.getElementById('entry-search');
  if (buscador && buscador.value !== (state.searchQuery || '')) {
    buscador.value = state.searchQuery || '';
  }
  renderEntryFormState();
  renderEntries();
  renderFuentes();
  renderEditarLibro();
}

// Formulario de entrada plegable (RF-8, T7): oculto por defecto; «+ Añadir
// entrada» lo despliega (200 ms, 0 ms con movimiento reducido). Al editar
// («Seguir estudiando» / «Corregir tiempo») se muestra siempre.
function renderEntryFormState() {
  const seccion = document.getElementById('entry-form-section');
  const btn = document.getElementById('btn-add-entry');
  if (!seccion || !btn) return;
  const visible = state.entryFormOpen || state.editingEntryId !== null;
  const estabaOculta = seccion.hidden;
  seccion.hidden = !visible;
  btn.setAttribute('aria-expanded', visible ? 'true' : 'false');
  btn.textContent = visible ? '− Ocultar formulario' : '+ Añadir entrada';
  if (visible && estabaOculta && !movimientoReducido()) {
    seccion.classList.remove('is-opening');
    void seccion.offsetWidth;
    seccion.classList.add('is-opening');
  } else if (!visible) {
    seccion.classList.remove('is-opening');
  }
}

function setEntryFormOpen(abierto, conFoco) {
  state.entryFormOpen = abierto;
  renderEntryFormState();
  if (abierto && conFoco) {
    const titulo = document.getElementById('entry-title');
    if (titulo) titulo.focus();
  }
}

function renderEntries() {
  const libroId = state.ficha ? state.ficha.abierta : state.selectedBookId;
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
    state.resaltarEntradaId = null;
    return;
  }
  listEl.hidden = false;
  emptyEl.hidden = true;
  noResultsEl.hidden = true;

  for (const e of entradas) {
    const card = document.createElement('article');
    card.className = 'entry-card';
    card.dataset.entryId = e.id;
    card.tabIndex = -1;
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

  // Destino del deep-link desde Hoy (RF-10): deja la entrada visible con un
  // realce breve y el foco para teclado/lector. Solo una vez por pulsación.
  if (state.resaltarEntradaId) {
    const destino = listEl.querySelector(`.entry-card[data-entry-id="${state.resaltarEntradaId}"]`);
    state.resaltarEntradaId = null;
    if (destino) {
      destino.classList.add('resaltada');
      destino.scrollIntoView({ block: 'nearest' });
      destino.focus({ preventScroll: true });
      setTimeout(() => destino.classList.remove('resaltada'), 2000);
    }
  }
}

// --- FUENTES + EDITAR (spec 003, T8, RF-11–RF-14) ---
// Opción Fuentes: muestra el libro (icono grande, nombre, entradas, minutos y
// fecha de creación), su contenido y origen como texto literal y su lista de
// fuentes con enlaces en pestaña nueva. Opción Editar: nombre único, color,
// contenido/origen (2×500 con contador) y CRUD de fuentes (máx. 20), todo con
// guardado instantáneo y `textContent` (RNF-10). Sin DOM en las validaciones.
let editarLibroId = null;   // libro cuyos campos de Editar están sincronizados
let editandoFuenteId = null; // fuente en edición inline (solo sesión)

// Fecha de creación «12 de octubre de 2026» desde el creadoEn numérico
function fechaCreacionLibro(creadoEn) {
  const d = typeof creadoEn === 'number' ? new Date(creadoEn) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
}

// Título de fuente: obligatorio, 1–60 tras trim (RF-14). Pura, sin DOM.
function validarTituloFuente(titulo) {
  const t = typeof titulo === 'string' ? titulo.trim() : '';
  if (t === '') return { ok: false, error: 'El título de la fuente es obligatorio.' };
  if (t.length > 60) return { ok: false, error: 'El título no puede superar 60 caracteres.' };
  return { ok: true, valor: t };
}

// Enlace de fuente: obligatorio, http(s) con autocompletado de `https://`
// (normalizarUrlFuente); otro esquema → mensaje exacto de RF-14. Pura, sin DOM.
function validarUrlFuente(texto) {
  const u = typeof texto === 'string' ? texto.trim() : '';
  if (u === '') return { ok: false, error: 'El enlace es obligatorio.' };
  const normalizada = normalizarUrlFuente(u);
  if (normalizada !== null) return { ok: true, valor: normalizada };
  if (/^[a-z][a-z0-9+.-]*:/.test(u.toLowerCase())) {
    return { ok: false, error: 'El enlace debe empezar por http:// o https://' };
  }
  return { ok: false, error: 'El enlace no es válido.' };
}

// Opción Fuentes (RF-11, RF-12): reconstruye la página desde el libro abierto.
// Sin focos que conservar aquí (solo texto y enlaces), así que se pinta entera.
function renderFuentes() {
  const detalle = document.getElementById('fuentes-detalle');
  const contenidoEl = document.getElementById('fuentes-contenido');
  const origenEl = document.getElementById('fuentes-origen');
  const vacioEl = document.getElementById('fuentes-vacio');
  const listaEl = document.getElementById('fuentes-lista');
  if (!detalle || !contenidoEl || !origenEl || !vacioEl || !listaEl) return;
  const libro = state.libros.find(l => l.id === state.ficha.abierta);
  detalle.innerHTML = '';
  listaEl.innerHTML = '';
  if (!libro) {
    contenidoEl.textContent = '';
    origenEl.textContent = '';
    vacioEl.hidden = true;
    return;
  }
  const resumen = resumenLibro(libro, state.entradas.filter(e => e.libroId === libro.id));

  const icono = document.createElement('span');
  icono.className = 'ficha-icon fuentes-icon';
  icono.setAttribute('aria-hidden', 'true');
  icono.style.setProperty('--libro-color', libro.color);
  icono.style.setProperty('--libro-tinta', colorTextoLibro(libro.color));
  const inicial = document.createElement('span');
  inicial.className = 'ficha-inicial';
  inicial.textContent = inicialLibro(libro.nombre);
  icono.appendChild(inicial);

  const info = document.createElement('div');
  info.className = 'fuentes-info';
  const nombre = document.createElement('h3');
  nombre.className = 'fuentes-nombre';
  nombre.textContent = libro.nombre;
  const meta = document.createElement('p');
  meta.className = 'fuentes-meta';
  meta.textContent = `${resumen.numEntradas} entrada${resumen.numEntradas === 1 ? '' : 's'} · ${resumen.minutos} min`;
  const fecha = document.createElement('p');
  fecha.className = 'fuentes-meta';
  const creada = fechaCreacionLibro(libro.creadoEn);
  fecha.textContent = creada ? `Creado el ${creada}` : '';
  info.appendChild(nombre);
  info.appendChild(meta);
  info.appendChild(fecha);
  detalle.appendChild(icono);
  detalle.appendChild(info);

  // Contenido y origen como texto literal (con saltos, sin HTML, RNF-10); en
  // vacío, mensaje en singular que invita a Editar (RF-12).
  if (libro.contenido) {
    contenidoEl.textContent = libro.contenido;
    contenidoEl.classList.remove('fuentes-vacio');
  } else {
    contenidoEl.textContent = 'Este libro aún no tiene contenido de estudio. Añádelo desde la opción Editar.';
    contenidoEl.classList.add('fuentes-vacio');
  }
  if (libro.origen) {
    origenEl.textContent = libro.origen;
    origenEl.classList.remove('fuentes-vacio');
  } else {
    origenEl.textContent = 'Este libro aún no tiene origen del contenido. Añádelo desde la opción Editar.';
    origenEl.classList.add('fuentes-vacio');
  }

  // Fuentes: enlace en pestaña nueva con aviso al lector (RF-11); vacío en
  // plural que invita a Editar (RF-12).
  const fuentes = Array.isArray(libro.fuentes) ? libro.fuentes : [];
  if (fuentes.length === 0) {
    vacioEl.textContent = 'Este libro aún no tiene fuentes de estudio. Añádelas desde la opción Editar.';
    vacioEl.hidden = false;
    return;
  }
  vacioEl.hidden = true;
  vacioEl.textContent = '';
  for (const f of fuentes) {
    const item = document.createElement('li');
    item.className = 'fuente-item';
    const enlace = document.createElement('a');
    enlace.className = 'fuente-enlace';
    enlace.href = f.url;
    enlace.target = '_blank';
    enlace.rel = 'noopener';
    enlace.textContent = f.titulo;
    const aviso = document.createElement('span');
    aviso.className = 'sr-only';
    aviso.textContent = ' (se abre en una pestaña nueva)';
    enlace.appendChild(aviso);
    const url = document.createElement('span');
    url.className = 'fuente-url';
    url.textContent = f.url;
    item.appendChild(enlace);
    item.appendChild(url);
    listaEl.appendChild(item);
  }
}

// Paleta de color de Editar (RF-13): se construye al abrir otro libro; el clic
// guarda al instante (sin reconstruir: el foco se conserva).
function construirEditarPaleta(libro) {
  const paletteEl = document.getElementById('editar-color-palette');
  if (!paletteEl) return;
  paletteEl.innerHTML = '';
  for (const color of BOOK_COLORS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-option' + (libro.color === color ? ' selected' : '');
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', libro.color === color ? 'true' : 'false');
    btn.setAttribute('aria-label', 'Color ' + color);
    btn.title = color;
    btn.style.backgroundColor = color;
    btn.dataset.color = color;
    btn.addEventListener('click', () => {
      const actual = state.libros.find(l => l.id === libro.id);
      if (!actual) return;
      actual.color = color;
      saveState();
      paletteEl.querySelectorAll('.color-option').forEach(b => {
        const esEste = b.dataset.color === color;
        b.classList.toggle('selected', esEste);
        b.setAttribute('aria-checked', esEste ? 'true' : 'false');
      });
      renderBooksList();
      renderFuentes();
    });
    paletteEl.appendChild(btn);
  }
}

// Lista de fuentes de Editar con CRUD inline (RF-14): ver, editar y quitar de
// una en una; repetidas OK; límite 20 con botón desactivado + aviso.
function renderEditarFuentesLista(libro) {
  const listaEl = document.getElementById('editar-fuentes-lista');
  const cuentaEl = document.getElementById('editar-fuentes-cuenta');
  const avisoEl = document.getElementById('editar-fuentes-aviso');
  const btnAnadir = document.getElementById('btn-add-fuente');
  if (!listaEl || !cuentaEl || !avisoEl || !btnAnadir) return;
  const fuentes = Array.isArray(libro.fuentes) ? libro.fuentes : [];
  listaEl.innerHTML = '';

  cuentaEl.textContent = `${fuentes.length} fuente${fuentes.length === 1 ? '' : 's'} de 20`;
  const sePuede = puedeAnadirFuente(fuentes);
  btnAnadir.disabled = !sePuede;
  avisoEl.textContent = sePuede ? '' : 'Has llegado al máximo de 20 fuentes por libro.';
  avisoEl.hidden = sePuede;

  for (const f of fuentes) {
    const item = document.createElement('li');
    item.className = 'fuente-item';
    if (editandoFuenteId === f.id) {
      // Fila en edición: título (60) + enlace con autocompletado https://
      const formDiv = document.createElement('div');
      formDiv.className = 'fuente-edit-form';
      const inputTitulo = document.createElement('input');
      inputTitulo.type = 'text';
      inputTitulo.className = 'form-input';
      inputTitulo.maxLength = 60;
      inputTitulo.value = f.titulo;
      inputTitulo.setAttribute('aria-label', 'Título de la fuente (máx. 60 caracteres)');
      const inputUrl = document.createElement('input');
      inputUrl.type = 'url';
      inputUrl.className = 'form-input';
      inputUrl.maxLength = 500;
      inputUrl.value = f.url;
      inputUrl.setAttribute('aria-label', 'Enlace de la fuente (http:// o https://)');
      const error = document.createElement('p');
      error.className = 'error-text';
      error.setAttribute('aria-live', 'polite');
      const acciones = document.createElement('div');
      acciones.className = 'fuente-acciones';
      const btnGuardar = document.createElement('button');
      btnGuardar.type = 'button';
      btnGuardar.className = 'btn btn-primary btn-small';
      btnGuardar.textContent = 'Guardar';
      btnGuardar.dataset.accion = 'guardar-fuente';
      btnGuardar.dataset.fuenteId = f.id;
      const btnCancelar = document.createElement('button');
      btnCancelar.type = 'button';
      btnCancelar.className = 'btn btn-secondary btn-small';
      btnCancelar.textContent = 'Cancelar';
      btnCancelar.dataset.accion = 'cancelar-fuente';
      acciones.appendChild(btnGuardar);
      acciones.appendChild(btnCancelar);
      formDiv.appendChild(inputTitulo);
      formDiv.appendChild(inputUrl);
      formDiv.appendChild(error);
      formDiv.appendChild(acciones);
      item.appendChild(formDiv);
    } else {
      const info = document.createElement('div');
      info.className = 'fuente-info';
      const titulo = document.createElement('span');
      titulo.className = 'fuente-titulo';
      titulo.textContent = f.titulo;
      const url = document.createElement('span');
      url.className = 'fuente-url';
      url.textContent = f.url;
      info.appendChild(titulo);
      info.appendChild(url);
      const acciones = document.createElement('div');
      acciones.className = 'fuente-acciones';
      const btnEditar = document.createElement('button');
      btnEditar.type = 'button';
      btnEditar.className = 'btn btn-secondary btn-small';
      btnEditar.textContent = 'Editar';
      btnEditar.dataset.accion = 'editar-fuente';
      btnEditar.dataset.fuenteId = f.id;
      const btnQuitar = document.createElement('button');
      btnQuitar.type = 'button';
      btnQuitar.className = 'btn btn-secondary btn-small';
      btnQuitar.textContent = 'Quitar';
      btnQuitar.dataset.accion = 'quitar-fuente';
      btnQuitar.dataset.fuenteId = f.id;
      acciones.appendChild(btnEditar);
      acciones.appendChild(btnQuitar);
      item.appendChild(info);
      item.appendChild(acciones);
    }
    listaEl.appendChild(item);
  }
}

// Opción Editar (RF-13, RF-14): sincroniza los campos al abrir otro libro;
// el resto (contadores, lista de fuentes) se actualiza en cada render sin
// tocar lo que el usuario está escribiendo. Guardado instantáneo.
function renderEditarLibro() {
  const libro = state.libros.find(l => l.id === state.ficha.abierta);
  if (!libro) return;
  const nombreInput = document.getElementById('editar-nombre');
  const contenidoInput = document.getElementById('editar-contenido');
  const origenInput = document.getElementById('editar-origen');
  if (!nombreInput || !contenidoInput || !origenInput) return;
  if (editarLibroId !== libro.id) {
    editarLibroId = libro.id;
    editandoFuenteId = null;
    nombreInput.value = libro.nombre || '';
    contenidoInput.value = libro.contenido || '';
    origenInput.value = libro.origen || '';
    document.getElementById('editar-nombre-error').textContent = '';
    document.getElementById('form-add-fuente').reset();
    limpiarErroresFuente();
    construirEditarPaleta(libro);
  }
  document.getElementById('editar-contenido-cuenta').textContent =
    `${(libro.contenido || '').length}/500 caracteres`;
  document.getElementById('editar-origen-cuenta').textContent =
    `${(libro.origen || '').length}/500 caracteres`;
  renderEditarFuentesLista(libro);
  renderZonaBorrado();
}

function limpiarErroresFuente() {
  const tituloError = document.getElementById('fuente-titulo-error');
  const urlError = document.getElementById('fuente-url-error');
  if (tituloError) tituloError.textContent = '';
  if (urlError) urlError.textContent = '';
}

// Lo escrito en Editar se guarda y se ve al instante: ficha, Fuentes y demás
// pestañas leen el mismo `state` (RF-13, RF-19). Sin render() completo para no
// mover el foco mientras se escribe.
function setupEditarLibro() {
  const nombreInput = document.getElementById('editar-nombre');
  const contenidoInput = document.getElementById('editar-contenido');
  const origenInput = document.getElementById('editar-origen');

  nombreInput.addEventListener('input', () => {
    const libro = state.libros.find(l => l.id === state.ficha.abierta);
    if (!libro) return;
    const validacion = validarNombreLibro(nombreInput.value, state.libros, libro.id);
    if (!validacion.ok) {
      document.getElementById('editar-nombre-error').textContent = validacion.error;
      return;
    }
    document.getElementById('editar-nombre-error').textContent = '';
    libro.nombre = nombreInput.value.trim();
    saveState();
    renderBooksList();
    renderFuentes();
  });

  contenidoInput.addEventListener('input', () => {
    const libro = state.libros.find(l => l.id === state.ficha.abierta);
    if (!libro) return;
    libro.contenido = contenidoInput.value.slice(0, 500);
    saveState();
    document.getElementById('editar-contenido-cuenta').textContent =
      `${libro.contenido.length}/500 caracteres`;
    renderFuentes();
  });

  origenInput.addEventListener('input', () => {
    const libro = state.libros.find(l => l.id === state.ficha.abierta);
    if (!libro) return;
    libro.origen = origenInput.value.slice(0, 500);
    saveState();
    document.getElementById('editar-origen-cuenta').textContent =
      `${libro.origen.length}/500 caracteres`;
    renderFuentes();
  });

  // Añadir fuente: título (60) + enlace con autocompletado https://;
  // repetidas OK; al llegar a 20 el botón se desactiva (RF-14).
  document.getElementById('form-add-fuente').addEventListener('submit', (e) => {
    e.preventDefault();
    const libro = state.libros.find(l => l.id === state.ficha.abierta);
    if (!libro) return;
    if (!Array.isArray(libro.fuentes)) libro.fuentes = [];
    if (!puedeAnadirFuente(libro.fuentes)) return;
    limpiarErroresFuente();
    const tituloInput = document.getElementById('fuente-titulo');
    const urlInput = document.getElementById('fuente-url');
    const validacionTitulo = validarTituloFuente(tituloInput.value);
    if (!validacionTitulo.ok) {
      document.getElementById('fuente-titulo-error').textContent = validacionTitulo.error;
      tituloInput.focus();
      return;
    }
    const validacionUrl = validarUrlFuente(urlInput.value);
    if (!validacionUrl.ok) {
      document.getElementById('fuente-url-error').textContent = validacionUrl.error;
      urlInput.focus();
      return;
    }
    libro.fuentes.push({ id: generateId(), titulo: validacionTitulo.valor, url: validacionUrl.valor });
    saveState();
    document.getElementById('form-add-fuente').reset();
    renderEditarFuentesLista(libro);
    renderFuentes();
    tituloInput.focus();
  });

  // CRUD de la lista: editar / guardar / cancelar / quitar (delegación).
  const listaEl = document.getElementById('editar-fuentes-lista');
  listaEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-accion]');
    if (!btn) return;
    const libro = state.libros.find(l => l.id === state.ficha.abierta);
    if (!libro || !Array.isArray(libro.fuentes)) return;
    const accion = btn.dataset.accion;
    const fuenteId = btn.dataset.fuenteId;
    if (accion === 'editar-fuente') {
      editandoFuenteId = fuenteId;
      renderEditarFuentesLista(libro);
      const fila = listaEl.querySelector('.fuente-edit-form input');
      if (fila) fila.focus();
    } else if (accion === 'cancelar-fuente') {
      editandoFuenteId = null;
      renderEditarFuentesLista(libro);
    } else if (accion === 'guardar-fuente') {
      const fila = btn.closest('.fuente-edit-form');
      const inputTitulo = fila.querySelectorAll('input')[0];
      const inputUrl = fila.querySelectorAll('input')[1];
      const error = fila.querySelector('.error-text');
      const validacionTitulo = validarTituloFuente(inputTitulo.value);
      if (!validacionTitulo.ok) {
        error.textContent = validacionTitulo.error;
        inputTitulo.focus();
        return;
      }
      const validacionUrl = validarUrlFuente(inputUrl.value);
      if (!validacionUrl.ok) {
        error.textContent = validacionUrl.error;
        inputUrl.focus();
        return;
      }
      const fuente = libro.fuentes.find(f => f.id === fuenteId);
      if (fuente) {
        fuente.titulo = validacionTitulo.valor;
        fuente.url = validacionUrl.valor;
      }
      editandoFuenteId = null;
      saveState();
      renderEditarFuentesLista(libro);
      renderFuentes();
    } else if (accion === 'quitar-fuente') {
      libro.fuentes = libro.fuentes.filter(f => f.id !== fuenteId);
      if (editandoFuenteId === fuenteId) editandoFuenteId = null;
      saveState();
      renderEditarFuentesLista(libro);
      renderFuentes();
      document.getElementById('fuente-titulo').focus();
    }
  });

  // `Escape` cancela la edición inline de la fuente (como en RF-15).
  listaEl.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || editandoFuenteId === null) return;
    const libro = state.libros.find(l => l.id === state.ficha.abierta);
    editandoFuenteId = null;
    if (libro) renderEditarFuentesLista(libro);
  });
}

// --- ELIMINAR LIBRO (spec 003, T9, RF-15/RF-16) ---
// «Eliminar libro» al final de Editar, separado visualmente: confirmación en
// la propia ficha con la frase exacta «¿Estás seguro de eliminar el libro?»,
// el detalle (N entradas, contenido, origen, enlaces) y «Sí, eliminar» /
// «Cancelar» (180 ms; `Escape` cancela y devuelve el foco). Al confirmar:
// archivarLibro → huella, salida de 200 ms, aviso «Libro eliminado.» y foco
// a la ficha siguiente/anterior o al estado vacío. Las métricas no se mueven
// (RF-17: leen entradas + huella).
function renderZonaBorrado() {
  const zona = document.getElementById('delete-confirm');
  const btnEliminar = document.getElementById('btn-delete-book');
  const detalle = document.getElementById('delete-confirm-detalle');
  if (!zona || !btnEliminar || !detalle) return;
  const libro = state.libros.find(l => l.id === state.ficha.abierta);
  const confirmando = state.ficha.confirmando === true
    && Boolean(libro)
    && state.ficha.opcion === 'editar';
  if (libro) {
    const num = state.entradas.filter(e => e.libroId === libro.id).length;
    detalle.textContent = textoDetalleBorrado(num);
  }
  const estabaOculta = zona.hidden;
  zona.hidden = !confirmando;
  if (confirmando && estabaOculta && !movimientoReducido()) {
    zona.classList.remove('is-showing');
    void zona.offsetWidth;
    zona.classList.add('is-showing');
  } else if (!confirmando) {
    zona.classList.remove('is-showing');
  }
}

function mostrarConfirmacionBorrado() {
  if (!state.libros.some(l => l.id === state.ficha.abierta)) return;
  state.ficha = transicionFicha(state.ficha, { tipo: 'CONFIRMAR' });
  renderZonaBorrado();
  const btnSi = document.getElementById('btn-confirm-delete-book');
  if (btnSi) btnSi.focus();
}

function cancelarConfirmacionBorrado() {
  if (state.ficha.confirmando !== true) return;
  state.ficha = transicionFicha(state.ficha, { tipo: 'CANCELAR_CONFIRMAR' });
  renderZonaBorrado();
  const btn = document.getElementById('btn-delete-book');
  if (btn) btn.focus();
}

function confirmarBorradoLibro() {
  const libroId = state.ficha.abierta;
  const libro = state.libros.find(l => l.id === libroId);
  if (!libro) return;
  // Foco tras borrar: ficha siguiente, si no la anterior, si no el vacío (RF-16)
  const ordenados = [...state.libros].sort((a, b) => a.creadoEn - b.creadoEn);
  const idx = ordenados.findIndex(l => l.id === libroId);
  const vecino = ordenados[idx + 1] || ordenados[idx - 1] || null;

  const borrar = () => {
    const res = archivarLibro(state.libros, state.entradas, state.archivo || [], libroId, Date.now());
    state.libros = res.libros;
    state.entradas = res.entradas;
    state.archivo = res.archivo;
    state.ficha = transicionFicha(state.ficha, { tipo: 'BORRADA' });
    state.selectedBookId = null;
    editarLibroId = null;
    editandoFuenteId = null;
    const panel = document.getElementById('ficha-panel');
    if (panel) panel.classList.remove('is-leaving');
    saveState();
    render();
    showToast('Libro eliminado.');
    if (vecino) {
      const btn = document.querySelector(`.ficha[data-book-id="${vecino.id}"]`);
      if (btn) { btn.focus(); return; }
    }
    const vacio = document.getElementById('btn-create-first-book');
    if (vacio) vacio.focus();
  };

  // Salida de 200 ms (opacidad + 8 px, RNF-5); instantánea con
  // movimiento reducido (RNF-6)
  if (movimientoReducido()) { borrar(); return; }
  const listEl = document.getElementById('books-list');
  const fichaBtn = listEl ? listEl.querySelector(`.ficha[data-book-id="${libroId}"]`) : null;
  const panel = document.getElementById('ficha-panel');
  if (fichaBtn) fichaBtn.classList.add('is-leaving');
  if (panel) panel.classList.add('is-leaving');
  setTimeout(borrar, 200);
}

function setupBorradoLibro() {
  document.getElementById('btn-delete-book').addEventListener('click', mostrarConfirmacionBorrado);
  document.getElementById('btn-cancel-delete-book').addEventListener('click', cancelarConfirmacionBorrado);
  document.getElementById('btn-confirm-delete-book').addEventListener('click', confirmarBorradoLibro);
  // `Escape` cancela la confirmación y devuelve el foco a «Eliminar libro»
  document.getElementById('ficha-page-editar').addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || state.ficha.confirmando !== true) return;
    ev.preventDefault();
    cancelarConfirmacionBorrado();
  });
}

// Valores de las tarjetas del carrusel
// 'resumen' es el resumen de metas semanales (spec 002): lo calcula render() una vez.
// 'archivo' es la huella de estudio (spec 003): las métricas la combinan con las
// entradas activas (RF-17); sin ella todo queda como antes.
function renderStats(resumen, archivo = []) {
  const res = computeStreak(state.entradas, archivo);
  document.getElementById('streak-current').textContent = String(res.current);
  document.getElementById('streak-longest').textContent = String(res.longest);

  const weekMin = computeWeeklyMinutes(state.entradas, archivo);
  let weekText = String(weekMin);
  if (weekMin >= 60) {
    const h = Math.floor(weekMin / 60);
    const m = weekMin % 60;
    weekText = `${weekMin} (${h}h ${m}m)`;
  }
  document.getElementById('week-minutes').textContent = weekText;
  document.getElementById('study-days').textContent = String(computeStudyDays(state.entradas, archivo));

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
function renderWeekStrip(resumen, archivo = []) {
  const gridEl = document.getElementById('week-grid');
  gridEl.innerHTML = '';

  const today = getTodayLocalYMD();
  const todayDate = ymdToDate(today);
  const offsetLunes = (todayDate.getDay() + 6) % 7;
  const lunes = addDaysYMD(today, -offsetLunes);

  const dateSet = getFechasEstudiadas(state.entradas, archivo);
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
      // Deep-link a la ficha (RF-10): se comprueba en el momento de pulsar;
      // si el libro ya no existe no cambia de pestaña ni muestra error.
      const libroVivo = state.libros.find(l => l.id === entrada.libroId);
      if (!libroVivo) return;
      resetEntryForm();
      state.resaltarEntradaId = entrada.id;
      // La búsqueda se limpia para que la entrada quede visible (RF-9, RF-10)
      state.searchQuery = '';
      if (state.ficha.abierta === libroVivo.id) {
        state.ficha.busqueda = '';
        fijarOpcionFicha('entradas');
      } else {
        state.ficha = transicionFicha(state.ficha, { tipo: 'ABRIR', id: libroVivo.id });
        state.selectedBookId = state.ficha.abierta;
      }
      switchTab('libros');
      render();
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
  const archivo = state.archivo || [];
  let modelo = modeloMapa(state.entradas, hoy, mapaState, esMovilHeatmap(), archivo);
  // Si el año visualizado se quedó sin datos, volver a «Actual» (RF-5)
  if (mapaState.vista === 'anio' && !modelo.anios.includes(mapaState.anio)) {
    mapaState = transicionMapa(mapaState, { tipo: 'VISTA_ACTUAL' }, {});
    modelo = modeloMapa(state.entradas, hoy, mapaState, esMovilHeatmap(), archivo);
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
  if (state.entradas.length === 0 && archivo.length === 0) {
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
  // Resumen semanal calculado una sola vez (spec 002, RNF-1), con la huella de
  // estudio: todas las métricas leen entradas activas + huella (spec 003, RF-17)
  const resumen = resumenMetas(state.entradas, state.metas, getTodayLocalYMD(), state.archivo || []);
  // Fecha usada en este render: si cambia el día con la app abierta, hay que
  // recalcular (RNF-1)
  fechaRender = getTodayLocalYMD();
  renderBooksList();
  renderBookView();
  renderStats(resumen, state.archivo || []);
  renderAjustes();
  renderWeekStrip(resumen, state.archivo || []);
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
// Seleccionar es alternar la ficha (RF-4): abre en Entradas o pliega si ya
// estaba abierta. El foco queda en la ficha activada (RNF-7).
function selectBook(bookId) {
  alternarFicha(bookId);
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
  state.entryFormOpen = true;
  renderEntryFormState();
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
  state.entryFormOpen = true;
  renderEntryFormState();
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
  state.entryFormOpen = false;
  document.getElementById('form-entry').reset();
  document.getElementById('entry-id-edit').value = '';
  document.getElementById('entry-time').value = '25';
  document.getElementById('entry-form-title').textContent = 'Nueva entrada';
  document.getElementById('btn-cancel-entry').hidden = true;
  clearEntryErrors();
  renderEntryFormState();
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
    const paletteEl = document.getElementById('book-color-palette');
    let color = paletteEl.dataset.selectedColor;
    if (!BOOK_COLORS.includes(color)) color = BOOK_COLORS[0];

    const editingId = document.getElementById('book-id-edit').value || null;
    const validacion = validarNombreLibro(nameInput.value, state.libros, editingId);
    if (!validacion.ok) {
      document.getElementById('book-name-error').textContent = validacion.error;
      nameInput.focus();
      return;
    }
    const name = nameInput.value.trim();
    if (editingId) {
      // Renombrar / cambiar color
      const idx = state.libros.findIndex(l => l.id === editingId);
      if (idx >= 0) {
        state.libros[idx] = { ...state.libros[idx], nombre: name, color };
      }
      hideBookForm();
    } else {
      // Crear nuevo libro y dejar su ficha abierta en Entradas (RF-7)
      const nuevo = {
        id: generateId(),
        nombre: name,
        color,
        creadoEn: Date.now(),
        contenido: '',
        origen: '',
        fuentes: []
      };
      state.libros.push(nuevo);
      state.ficha = transicionFicha(state.ficha, { tipo: 'ABRIR', id: nuevo.id });
      state.selectedBookId = nuevo.id;
      state.editingEntryId = null;
      state.entryEditMode = null;
      state.searchQuery = '';
      hideBookForm();
      resetEntryForm();
      // Libro nuevo abierto en Entradas con el formulario listo (RF-7)
      state.entryFormOpen = true;
    }

    saveState();
    render();
    // Libro recién creado: foco en el título de la nueva entrada (RF-7)
    if (!editingId) {
      const tituloEntrada = document.getElementById('entry-title');
      if (tituloEntrada) tituloEntrada.focus();
    }
  });

  // Cancelar edición de libro
  document.getElementById('btn-cancel-book').addEventListener('click', hideBookForm);

  // Renombrar y eliminar viven en la opción Editar de cada ficha (T8/T9).

  // Formulario de entrada (crear / editar)
  document.getElementById('form-entry').addEventListener('submit', (e) => {
    e.preventDefault();
    const libroActivo = state.ficha.abierta || state.selectedBookId;
    if (!libroActivo) {
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
        libroId: libroActivo,
        titulo: title,
        contenido: content,
        fecha: date,
        creadoEn: Date.now(),
        minutos: minutos,
        sesiones: [{ fecha: date, minutos: minutos }]
      };
      state.entradas.push(nuevo);
      // Tras guardar, el formulario queda limpio y desplegado para la
      // siguiente entrada, con el foco en el título (RF-7, RF-8)
      state.editingEntryId = null;
      state.entryEditMode = null;
      state.entryFormOpen = true;
      document.getElementById('form-entry').reset();
      document.getElementById('entry-id-edit').value = '';
      document.getElementById('entry-time').value = '25';
      document.getElementById('entry-form-title').textContent = 'Nueva entrada';
      document.getElementById('btn-cancel-entry').hidden = true;
      clearEntryErrors();
    }

    saveState();
    render();
    if (!editingId) {
      const tituloNuevo = document.getElementById('entry-title');
      if (tituloNuevo) tituloNuevo.focus();
    }
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

  // Búsqueda por libro: vive en el estado de la ficha y se limpia al abrir
  // otro libro (RF-9, transicionFicha resetea `busqueda` al abrir)
  document.getElementById('entry-search').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    state.ficha.busqueda = e.target.value;
    renderEntries();
  });
  document.getElementById('btn-clear-search').addEventListener('click', () => {
    state.searchQuery = '';
    state.ficha.busqueda = '';
    document.getElementById('entry-search').value = '';
    renderEntries();
    document.getElementById('entry-search').focus();
  });

  // «+ Añadir entrada» despliega el formulario de nueva entrada (RF-8)
  document.getElementById('btn-add-entry').addEventListener('click', () => {
    if (state.editingEntryId) {
      resetEntryForm();
      return;
    }
    setEntryFormOpen(!state.entryFormOpen, !state.entryFormOpen);
  });

  // Exportar datos a JSON (spec 003, RNF-3): version 3 con la huella incluida
  document.getElementById('btn-export').addEventListener('click', () => {
    try {
      const payload = construirExportacion(state);
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
        // Reemplazar estado con los datos importados normalizados: libros
        // (contenido/origen/fuentes), entradas, metas y huella a la vez
        // (spec 003, RNF-3). Un JSON antiguo sin huella queda en huella vacía.
        const datos = normalizarDatosImportados(parsed);
        state.libros = datos.libros;
        state.entradas = datos.entradas;
        state.metas = datos.metas;
        state.archivo = datos.archivo;
        state.selectedBookId = null;
        state.ficha = { abierta: null, opcion: 'entradas', confirmando: false, busqueda: '' };
        panelAbiertaId = null;
        editarLibroId = null;
        editandoFuenteId = null;
        state.editingBookId = null;
        state.editingEntryId = null;
        state.entryEditMode = null;
        state.entryFormOpen = false;
        state.resaltarEntradaId = null;
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
  state.archivo = loaded.archivo;
  state.selectedBookId = null;
  // Las fichas empiezan cerradas al recargar (RF-6) y no se persisten
  state.ficha = { abierta: null, opcion: 'entradas', confirmando: false, busqueda: '' };
  panelAbiertaId = null;
  editarLibroId = null;
  editandoFuenteId = null;
  state.editingBookId = null;
  state.editingEntryId = null;
  state.entryEditMode = null;
  state.entryFormOpen = false;
  state.resaltarEntradaId = null;
  state.searchQuery = '';
  state.tab = 'hoy';

  setupEventListeners();
  setupFichaTabs();
  setupEditarLibro();
  setupBorradoLibro();
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
    getTodayLocalYMD,
    addDaysYMD,
    getSesiones,
    getFechasEstudiadas,
    computeStreak,
    computeWeeklyMinutes,
    computeStudyDays,
    hayEntradasAnteriores,
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
    // Persistencia version 3 + export/import con huella (spec 003, T5):
    // puras, con tests en tests/libros.test.js (RNF-3, RF-19).
    construirExportacion,
    normalizarDatosImportados,
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
    textoTarjetaRacha,
    // Normalización de libros y fuentes (spec 003, T1): puras, con tests en
    // tests/libros.test.js (RNF-3, RF-13, RF-14).
    normalizarUrlFuente,
    normalizarFuente,
    normalizarFuentes,
    normalizarLibro,
    // Nombres únicos, icono y contraste (spec 003, T2): puras, con tests en
    // tests/libros.test.js (RF-1, RF-2, RF-7, RF-13).
    validarNombreLibro,
    inicialLibro,
    colorTextoLibro,
    // Huella de estudio al eliminar (spec 003, T3): puras, con tests en
    // tests/libros.test.js (RF-16, RF-17, RF-18, RNF-1, RNF-2).
    normalizarArchivo,
    archivarLibro,
    // Métricas con huella (spec 003, T4): las métricas aceptan `archivo = []`
    // y combinan entradas + huella; Hoy, listas y contadores siguen con solo
    // activas (RF-17, RF-18, RF-19).
    sesionesTodas,
    combinarParaMetricas,
    resumenLibro,
    // Estado de fichas con tabs (spec 003, T6): máquina de sesión pura
    // (RF-4, RF-5, RF-6, RF-15). Con tests en tests/libros.test.js.
    transicionFicha,
    // Límite de fuentes (spec 003, T8): pura, con tests en
    // tests/libros.test.js (RF-14).
    puedeAnadirFuente,
    // Detalle de la confirmación de borrado (spec 003, T9): pura, con tests
    // en tests/libros.test.js (RF-15).
    textoDetalleBorrado
  };
}
