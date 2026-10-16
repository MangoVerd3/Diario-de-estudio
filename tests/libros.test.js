// Tests T1 (spec 003): normalizar libros, fuentes y urls (migración sin pérdida).
// node --test, sin instalar nada (constitución P4).
const test = require('node:test');
const assert = require('node:assert');
const {
  normalizarLibro,
  normalizarFuente,
  normalizarUrlFuente,
  validarNombreLibro,
  inicialLibro,
  colorTextoLibro,
  normalizarArchivo,
  archivarLibro,
  computeDiasEstudio,
  validateImportedData,
  loadState,
  construirExportacion,
  normalizarDatosImportados,
  transicionFicha,
  puedeAnadirFuente,
  textoDetalleBorrado
} = require('../app.js');

// loadState lee de localStorage: se sustituye por un doble de prueba.
function conLocalStorage(datos, fn) {
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (clave) => (clave === 'diarioEstudio' && datos !== null ? JSON.stringify(datos) : null),
    setItem: () => {},
    removeItem: () => {}
  };
  try {
    return fn();
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
}

// --- normalizarUrlFuente (RF-14) ---

test('normalizarUrlFuente: acepta http y https tal cual (con trim)', () => {
  assert.strictEqual(normalizarUrlFuente('https://ejemplo.com/a'), 'https://ejemplo.com/a');
  assert.strictEqual(normalizarUrlFuente('http://ejemplo.com'), 'http://ejemplo.com');
  assert.strictEqual(normalizarUrlFuente('  https://ejemplo.com  '), 'https://ejemplo.com');
});

test('normalizarUrlFuente: completa con https:// si falta el esquema', () => {
  assert.strictEqual(normalizarUrlFuente('www.ejemplo.com'), 'https://www.ejemplo.com');
  assert.strictEqual(normalizarUrlFuente('ejemplo.com/curso'), 'https://ejemplo.com/curso');
});

test('normalizarUrlFuente: rechaza otros esquemas', () => {
  assert.strictEqual(normalizarUrlFuente('javascript:alert(1)'), null);
  assert.strictEqual(normalizarUrlFuente('mailto:a@b.com'), null);
  assert.strictEqual(normalizarUrlFuente('ftp://ejemplo.com'), null);
  assert.strictEqual(normalizarUrlFuente('JAVASCRIPT:alert(1)'), null);
});

test('normalizarUrlFuente: rechaza vacío, >500 caracteres y espacios internos', () => {
  assert.strictEqual(normalizarUrlFuente(''), null);
  assert.strictEqual(normalizarUrlFuente('   '), null);
  assert.strictEqual(normalizarUrlFuente('https://eje mplo.com'), null);
  assert.strictEqual(normalizarUrlFuente('https://'), null);
  assert.strictEqual(normalizarUrlFuente('https://' + 'a'.repeat(500)), null);
  assert.strictEqual(normalizarUrlFuente(null), null);
  assert.strictEqual(normalizarUrlFuente(42), null);
});

// --- normalizarFuente (RF-14, RNF-3) ---

test('normalizarFuente: título vacío, solo-espacios o >60 se descarta', () => {
  assert.strictEqual(normalizarFuente({ titulo: '', url: 'https://a.com' }), null);
  assert.strictEqual(normalizarFuente({ titulo: '   ', url: 'https://a.com' }), null);
  assert.strictEqual(normalizarFuente({ titulo: 'a'.repeat(61), url: 'https://a.com' }), null);
  assert.strictEqual(normalizarFuente({ url: 'https://a.com' }), null);
  assert.strictEqual(normalizarFuente(null), null);
});

test('normalizarFuente: enlace javascript: o mailto: se descarta', () => {
  assert.strictEqual(normalizarFuente({ titulo: 'X', url: 'javascript:alert(1)' }), null);
  assert.strictEqual(normalizarFuente({ titulo: 'X', url: 'mailto:a@b.com' }), null);
});

test('normalizarFuente: fuente válida conserva título recortado y url normalizada', () => {
  const f = normalizarFuente({ id: 'f1', titulo: '  MDN  ', url: 'www.mozilla.org' });
  assert.deepStrictEqual(f, { id: 'f1', titulo: 'MDN', url: 'https://www.mozilla.org' });
});

test('normalizarFuente: sin id se genera uno sin perder la fuente', () => {
  const f = normalizarFuente({ titulo: 'MDN', url: 'https://mozilla.org' });
  assert.ok(f && typeof f.id === 'string' && f.id.length > 0);
  assert.strictEqual(f.titulo, 'MDN');
});

test('normalizarFuente: título de 60 y url de 500 siguen válidos', () => {
  const url500 = 'https://' + 'a'.repeat(492);
  assert.strictEqual(url500.length, 500);
  const f = normalizarFuente({ id: 'f1', titulo: 'a'.repeat(60), url: url500 });
  assert.ok(f !== null);
});

// --- normalizarLibro (RNF-3, RF-13, RF-14) ---

test('normalizarLibro: sin contenido/origen/fuentes añade vacíos sin perder nada', () => {
  const l = normalizarLibro({ id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1 });
  assert.deepStrictEqual(l, {
    id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1,
    contenido: '', origen: '', fuentes: []
  });
});

test('normalizarLibro: contenido y origen >500 se recortan', () => {
  const l = normalizarLibro({
    id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1,
    contenido: 'x'.repeat(600), origen: 'y'.repeat(501)
  });
  assert.strictEqual(l.contenido.length, 500);
  assert.strictEqual(l.origen.length, 500);
});

test('normalizarLibro: color fuera de paleta vuelve al primero', () => {
  const l = normalizarLibro({ id: 'l1', nombre: 'Mate', color: '#ffffff', creadoEn: 1 });
  assert.strictEqual(l.color, '#3b82f6');
});

test('normalizarLibro: libro sin id o sin nombre es null (el resto no se pierde)', () => {
  assert.strictEqual(normalizarLibro({ nombre: 'Mate', color: '#3b82f6', creadoEn: 1 }), null);
  assert.strictEqual(normalizarLibro({ id: 'l1', color: '#3b82f6', creadoEn: 1 }), null);
  assert.strictEqual(normalizarLibro(null), null);
  // …pero un libro válido junto a uno inválido sobrevive en loadState
  const estado = conLocalStorage({
    libros: [
      { nombre: 'Sin id', color: '#3b82f6', creadoEn: 1 },
      { id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1 }
    ],
    entradas: []
  }, loadState);
  assert.strictEqual(estado.libros.length, 1);
  assert.strictEqual(estado.libros[0].nombre, 'Mate');
});

test('normalizarLibro: fuente corrupta se descarta sin perder el resto', () => {
  const l = normalizarLibro({
    id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1,
    fuentes: [
      { id: 'f1', titulo: 'Buena', url: 'https://a.com' },
      { id: 'f2', titulo: '', url: 'https://b.com' },
      { id: 'f3', titulo: 'Mala', url: 'javascript:x' }
    ]
  });
  assert.deepStrictEqual(l.fuentes, [{ id: 'f1', titulo: 'Buena', url: 'https://a.com' }]);
});

// --- loadState e import de JSON version: 2 (RNF-3) ---

test('loadState: libro antiguo sin contenido/origen/fuentes carga sin perder nada', () => {
  const estado = conLocalStorage({
    libros: [{ id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1 }],
    entradas: [{
      id: 'e1', libroId: 'l1', titulo: 't', contenido: '', fecha: '2026-10-01',
      creadoEn: 1, minutos: 30, sesiones: [{ fecha: '2026-10-01', minutos: 30 }]
    }]
  }, loadState);
  assert.strictEqual(estado.libros.length, 1);
  assert.strictEqual(estado.libros[0].nombre, 'Mate');
  assert.strictEqual(estado.libros[0].contenido, '');
  assert.strictEqual(estado.libros[0].origen, '');
  assert.deepStrictEqual(estado.libros[0].fuentes, []);
  assert.strictEqual(estado.entradas.length, 1);
});

test('validateImportedData: acepta JSON version 2 sin contenido/origen/fuentes', () => {
  assert.strictEqual(validateImportedData({
    libros: [{ id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1 }],
    entradas: [],
    version: 2
  }), true);
});

// --- T2 (spec 003, E1): validarNombreLibro (RF-7, RF-13) ---

function mkLibros() {
  return [
    { id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1 },
    { id: 'l2', nombre: 'Física', color: '#10b981', creadoEn: 2 }
  ];
}

test('validarNombreLibro: vacío o solo-espacios no es válido', () => {
  assert.deepStrictEqual(
    validarNombreLibro('', mkLibros(), null),
    { ok: false, error: 'El nombre del libro es obligatorio.' }
  );
  assert.deepStrictEqual(
    validarNombreLibro('   ', mkLibros(), null),
    { ok: false, error: 'El nombre del libro es obligatorio.' }
  );
});

test('validarNombreLibro: más de 40 caracteres no es válido', () => {
  assert.deepStrictEqual(
    validarNombreLibro('a'.repeat(41), mkLibros(), null),
    { ok: false, error: 'El nombre no puede superar 40 caracteres.' }
  );
});

test('validarNombreLibro: 40 caracteres sí es válido', () => {
  assert.deepStrictEqual(validarNombreLibro('a'.repeat(40), mkLibros(), null), { ok: true });
});

test('validarNombreLibro: duplicado al crear (trim + minúsculas) con mensaje exacto', () => {
  const libros = mkLibros();
  for (const variante of ['Mate', 'mate', 'MATE', '  Mate  ', ' mate ']) {
    assert.deepStrictEqual(
      validarNombreLibro(variante, libros, null),
      { ok: false, error: 'Ya tienes un libro con ese nombre' }
    );
  }
});

test('validarNombreLibro: duplicado al renombrar también se bloquea', () => {
  // Renombrar l2 a un nombre que ya usa l1 → error exacto
  assert.deepStrictEqual(
    validarNombreLibro(' mate ', mkLibros(), 'l2'),
    { ok: false, error: 'Ya tienes un libro con ese nombre' }
  );
});

test('validarNombreLibro: el propio libro queda excluido al renombrar', () => {
  // Guardar «Mate» sin cambios (mismo id, mismo nombre con otra caja) → válido
  assert.deepStrictEqual(validarNombreLibro('mate', mkLibros(), 'l1'), { ok: true });
  assert.deepStrictEqual(validarNombreLibro('  Mate  ', mkLibros(), 'l1'), { ok: true });
  // Un nombre libre también es válido
  assert.deepStrictEqual(validarNombreLibro('Química', mkLibros(), 'l1'), { ok: true });
  assert.deepStrictEqual(validarNombreLibro('Química', mkLibros(), null), { ok: true });
});

// --- T2: inicialLibro (RF-2, §8.6) ---

test('inicialLibro: ignora espacios iniciales y pasa a mayúsculas', () => {
  assert.strictEqual(inicialLibro('Mate'), 'M');
  assert.strictEqual(inicialLibro('  mate'), 'M');
  assert.strictEqual(inicialLibro(' yoga'), 'Y');
});

test('inicialLibro: conserva acentos y caracteres no latinos', () => {
  assert.strictEqual(inicialLibro('Álgebra'), 'Á');
  assert.strictEqual(inicialLibro('álgebra'), 'Á');
  assert.strictEqual(inicialLibro('日本語'), '日');
});

// --- T2: colorTextoLibro (RF-2, RNF-7: contraste ≥ 4.5:1) ---

// Contraste WCAG 2.x entre dos hex (misma fórmula que app.js).
function luminanciaTest(hex) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = rgb.map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrasteTest(a, b) {
  const la = luminanciaTest(a);
  const lb = luminanciaTest(b);
  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);
  return (claro + 0.05) / (oscuro + 0.05);
}

test('colorTextoLibro: elige la tinta de mayor contraste en los 8 colores', () => {
  const colores = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'
  ];
  for (const color of colores) {
    const tinta = colorTextoLibro(color);
    assert.ok(tinta === '#1c1917' || tinta === '#ffffff', `tinta válida para ${color}`);
    const mejor = contrasteTest(color, '#1c1917') >= contrasteTest(color, '#ffffff')
      ? '#1c1917'
      : '#ffffff';
    assert.strictEqual(tinta, mejor, `${color} debe usar la tinta de mayor contraste`);
  }
});

test('colorTextoLibro: contraste ≥4.5:1 salvo el violeta (límite documentado)', () => {
  // Siete colores llegan a 4.5:1 con una de las dos tintas. El violeta #8b5cf6
  // queda en tierra de nadie (oscura 4.13, blanca 4.23): ninguna tinta fija lo
  // alcanza, así que se elige la mejor (blanca, ≥3:1 de texto grande; el icono
  // es decorativo con aria-hidden y nunca sustituye al nombre, RF-2).
  const colores45 = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#06b6d4', '#f97316', '#ec4899'
  ];
  for (const color of colores45) {
    const tinta = colorTextoLibro(color);
    assert.ok(
      contrasteTest(color, tinta) >= 4.5,
      `${color} con ${tinta} debe llegar a 4.5:1`
    );
  }
  assert.strictEqual(colorTextoLibro('#8b5cf6'), '#ffffff');
  assert.ok(contrasteTest('#8b5cf6', '#ffffff') >= 3);
});

test('colorTextoLibro: amarillos claros piden tinta oscura', () => {
  assert.strictEqual(colorTextoLibro('#f59e0b'), '#1c1917');
});

// --- T4 (spec 003, RF-17/18/19): métricas con entradas + huella (001/002 intactas) ---

const {
  sesionesTodas,
  combinarParaMetricas,
  resumenLibro,
  computeStreak,
  computeWeeklyMinutes,
  computeStudyDays,
  getFechasEstudiadas,
  hayEntradasAnteriores,
  aniosConDatos,
  modeloMapa,
  resumenMetas,
  getSesiones
} = require('../app.js');

// Fecha local de hoy en 'YYYY-MM-DD' (igual que getTodayLocalYMD, sin importar la app).
function hoyLocalT4() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Suma n días a un 'YYYY-MM-DD' en hora local (tolera DST y cambios de mes).
function moverDiasT4(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function mkEntradaT4(id, libroId, sesiones) {
  const minutos = sesiones.reduce((acc, s) => acc + s.minutos, 0);
  return {
    id, libroId, titulo: 'Título ' + id, contenido: '',
    fecha: sesiones[sesiones.length - 1].fecha, creadoEn: 1, minutos, sesiones
  };
}

// Escenario de racha 6: 6 días seguidos que terminan hoy, repartidos en 2 entradas.
function escenarioRacha6() {
  const hoy = hoyLocalT4();
  const dias = [-5, -4, -3, -2, -1, 0].map(n => moverDiasT4(hoy, n));
  const libros = [mkLibroHuella('l1', 'Mate')];
  const entradas = [
    mkEntradaT4('e1', 'l1', dias.slice(0, 3).map(f => ({ fecha: f, minutos: 20 }))),
    mkEntradaT4('e2', 'l1', dias.slice(3).map(f => ({ fecha: f, minutos: 20 })))
  ];
  return { hoy, libros, entradas };
}

// Escenario de metas: 4 semanas cerradas cumplidas (una perfecta), hoy lunes.
const HOY_METAS_T4 = '2026-10-19'; // lunes
const METAS_T4 = [{ dias: 3, desde: '2026-09-21' }]; // lunes

function entradasCuatroSemanasT4() {
  const lunes = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'];
  return lunes.map((l, w) => {
    const offsets = w === 2 ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2];
    return mkEntradaT4('s' + w, 'l1', offsets.map(n => ({ fecha: moverDiasT4(l, n), minutos: 25 })));
  });
}

const MAPA_ESTADO_T4 = { vista: 'actual', anio: null, extra: 0, diaSel: null };

test('T4 sesionesTodas: combina sesiones de entradas y huella', () => {
  const entradas = [mkEntradaT4('e1', 'l1', [{ fecha: '2026-10-01', minutos: 20 }])];
  const archivo = [{ libroId: 'l1', archivadoEn: 7, sesiones: [{ fecha: '2026-10-02', minutos: 10 }] }];
  assert.deepStrictEqual(sesionesTodas(entradas, archivo), [
    { fecha: '2026-10-01', minutos: 20 },
    { fecha: '2026-10-02', minutos: 10 }
  ]);
});

test('T4 sesionesTodas: sin huella (omitida, [] o null) devuelve solo las activas', () => {
  const entradas = [mkEntradaT4('e1', 'l1', [{ fecha: '2026-10-01', minutos: 20 }])];
  const esperado = [{ fecha: '2026-10-01', minutos: 20 }];
  assert.deepStrictEqual(sesionesTodas(entradas), esperado);
  assert.deepStrictEqual(sesionesTodas(entradas, []), esperado);
  assert.deepStrictEqual(sesionesTodas(entradas, null), esperado);
});

test('T4 combinarParaMetricas: una pseudo-entrada por registro, con copia de sesiones', () => {
  const entradas = [mkEntradaT4('e1', 'l1', [{ fecha: '2026-10-01', minutos: 20 }])];
  const archivo = [
    { libroId: 'l1', archivadoEn: 7, sesiones: [{ fecha: '2026-10-02', minutos: 10 }] },
    { libroId: 'l1', archivadoEn: 8, sesiones: [{ fecha: '2026-10-03', minutos: 5 }] }
  ];
  const combinadas = combinarParaMetricas(entradas, archivo);
  assert.strictEqual(combinadas.length, 3);
  assert.strictEqual(combinadas[0], entradas[0]);
  assert.deepStrictEqual(combinadas[1].sesiones, [{ fecha: '2026-10-02', minutos: 10 }]);
  assert.deepStrictEqual(combinadas[2].sesiones, [{ fecha: '2026-10-03', minutos: 5 }]);
  // La pseudo-entrada es una copia: mutarla no afecta a la huella
  combinadas[1].sesiones[0].minutos = 999;
  assert.strictEqual(archivo[0].sesiones[0].minutos, 10);
});

test('T4 combinarParaMetricas: sin huella devuelve las mismas entradas', () => {
  const entradas = [mkEntradaT4('e1', 'l1', [{ fecha: '2026-10-01', minutos: 20 }])];
  assert.deepStrictEqual(combinarParaMetricas(entradas), entradas);
  assert.deepStrictEqual(combinarParaMetricas(entradas, []), entradas);
});

test('T4 métricas: sin huella explícita dan lo mismo que antes (parámetro opcional)', () => {
  const { hoy } = escenarioRacha6();
  const { entradas } = escenarioRacha6();
  assert.deepStrictEqual(computeStreak(entradas), computeStreak(entradas, []));
  assert.strictEqual(computeWeeklyMinutes(entradas), computeWeeklyMinutes(entradas, []));
  assert.strictEqual(computeStudyDays(entradas), computeStudyDays(entradas, []));
  assert.deepStrictEqual(computeDiasEstudio(entradas, hoy), computeDiasEstudio(entradas, hoy, []));
  assert.deepStrictEqual(
    Array.from(getFechasEstudiadas(entradas)).sort(),
    Array.from(getFechasEstudiadas(entradas, [])).sort()
  );
  assert.deepStrictEqual(aniosConDatos(entradas, hoy), aniosConDatos(entradas, hoy, []));
  assert.deepStrictEqual(
    modeloMapa(entradas, hoy, MAPA_ESTADO_T4, false),
    modeloMapa(entradas, hoy, MAPA_ESTADO_T4, false, [])
  );
  assert.deepStrictEqual(
    resumenMetas(entradas, [], hoy),
    resumenMetas(entradas, [], hoy, [])
  );
  assert.strictEqual(
    hayEntradasAnteriores(entradas, '2026-01-01'),
    hayEntradasAnteriores(entradas, '2026-01-01', [])
  );
});

test('T4 racha 6 intacta tras borrar el libro (racha, minutos/semana, días)', () => {
  const { libros, entradas } = escenarioRacha6();
  assert.deepStrictEqual(computeStreak(entradas), { current: 6, longest: 6 });
  const antesMin = computeWeeklyMinutes(entradas);
  assert.ok(antesMin > 0);
  const antesDias = computeStudyDays(entradas);
  assert.strictEqual(antesDias, 6);
  const res = archivarLibro(libros, entradas, [], 'l1', Date.now());
  assert.deepStrictEqual(res.entradas, []);
  assert.deepStrictEqual(computeStreak(res.entradas, res.archivo), { current: 6, longest: 6 });
  assert.strictEqual(computeWeeklyMinutes(res.entradas, res.archivo), antesMin);
  assert.strictEqual(computeStudyDays(res.entradas, res.archivo), antesDias);
});

test('T4 computeDiasEstudio idéntico tras borrar (entradas+huella)', () => {
  const { hoy, libros, entradas } = escenarioRacha6();
  const antes = computeDiasEstudio(entradas, hoy);
  assert.strictEqual(Object.keys(antes).length, 6);
  const res = archivarLibro(libros, entradas, [], 'l1', Date.now());
  assert.deepStrictEqual(computeDiasEstudio(res.entradas, hoy, res.archivo), antes);
});

test('T4 resumenMetas idéntico tras borrar en el escenario de racha', () => {
  const { hoy, libros, entradas } = escenarioRacha6();
  const antes = resumenMetas(entradas, [], hoy);
  const res = archivarLibro(libros, entradas, [], 'l1', Date.now());
  assert.deepStrictEqual(resumenMetas(res.entradas, [], hoy, res.archivo), antes);
});

test('T4 4 metas + 1 perfecta intactas tras borrar (metas, fuegos y guía)', () => {
  const libros = [mkLibroHuella('l1', 'Mate')];
  const entradas = entradasCuatroSemanasT4();
  const antes = resumenMetas(entradas, METAS_T4, HOY_METAS_T4);
  assert.strictEqual(antes.totalMetas, 4);
  assert.strictEqual(antes.rachaMetas, 4);
  assert.strictEqual(antes.recordMetas, 4);
  assert.strictEqual(antes.totalPerfectas, 1);
  const res = archivarLibro(libros, entradas, [], 'l1', 123);
  const despues = resumenMetas(res.entradas, METAS_T4, HOY_METAS_T4, res.archivo);
  assert.deepStrictEqual(despues, antes);
  assert.strictEqual(despues.totalMetas, 4);
  assert.deepStrictEqual(despues.fuego, antes.fuego);
  assert.strictEqual(despues.guia, antes.guia);
});

test('T4 modeloMapa idéntico tras borrar (día de huella sigue coloreado)', () => {
  const libros = [mkLibroHuella('l1', 'Mate')];
  const entradas = entradasCuatroSemanasT4();
  const antes = modeloMapa(entradas, HOY_METAS_T4, MAPA_ESTADO_T4, false);
  assert.ok(antes.hayDatosVisibles);
  const res = archivarLibro(libros, entradas, [], 'l1', 123);
  const despues = modeloMapa(res.entradas, HOY_METAS_T4, MAPA_ESTADO_T4, false, res.archivo);
  assert.deepStrictEqual(despues, antes);
});

test('T4 aniosConDatos intacto tras borrar', () => {
  const libros = [mkLibroHuella('l1', 'Mate')];
  const entradas = entradasCuatroSemanasT4();
  const antes = aniosConDatos(entradas, HOY_METAS_T4);
  const res = archivarLibro(libros, entradas, [], 'l1', 123);
  assert.deepStrictEqual(aniosConDatos(res.entradas, HOY_METAS_T4, res.archivo), antes);
  assert.deepStrictEqual(antes, [2026]);
});

test('T4 día solo-de-huella sigue coloreado y contando', () => {
  const hoy = '2026-10-08'; // jueves, como en tests/heatmap.test.js
  const archivo = [{ libroId: 'l1', archivadoEn: 7, sesiones: [{ fecha: hoy, minutos: 45 }] }];
  const dias = computeDiasEstudio([], hoy, archivo);
  assert.deepStrictEqual(dias[hoy], { minutos: 45, numEntradas: 1 });
  assert.ok(getFechasEstudiadas([], archivo).has(hoy));
  assert.strictEqual(computeStudyDays([], archivo), 1);
  const modelo = modeloMapa([], hoy, MAPA_ESTADO_T4, false, archivo);
  const celda = modelo.columnas.flat().find(d => d.fecha === hoy);
  assert.ok(celda && celda.nivel > 0 && celda.numEntradas === 1);
});

test('T4 hayEntradasAnteriores ve la huella archivada', () => {
  const archivo = [{ libroId: 'l1', archivadoEn: 7, sesiones: [{ fecha: '2026-09-01', minutos: 10 }] }];
  assert.strictEqual(hayEntradasAnteriores([], '2026-10-05', archivo), true);
  assert.strictEqual(hayEntradasAnteriores([], '2026-10-05'), false);
});

test('T4 resumenLibro cuenta solo entradas activas (ignora la huella)', () => {
  const libro = mkLibroHuella('l1', 'Mate');
  const activas = [
    mkEntradaT4('e1', 'l1', [{ fecha: '2026-10-01', minutos: 30 }]),
    mkEntradaT4('e2', 'l1', [{ fecha: '2026-10-02', minutos: 15 }])
  ];
  assert.deepStrictEqual(resumenLibro(libro, activas), { numEntradas: 2, minutos: 45 });
  assert.deepStrictEqual(resumenLibro(libro, []), { numEntradas: 0, minutos: 0 });
  // Aunque exista huella con más sesiones, el contador no se mueve
  const archivo = [{ libroId: 'l1', archivadoEn: 7, sesiones: [{ fecha: '2026-10-03', minutos: 100 }] }];
  assert.deepStrictEqual(resumenLibro(libro, activas), { numEntradas: 2, minutos: 45 });
  assert.ok(archivo.length === 1);
});

test('T4 Hoy y listas ignoran la huella (único libro borrado)', () => {
  const hoy = hoyLocalT4();
  const libros = [mkLibroHuella('l1', 'Mate')];
  const entradas = [mkEntradaT4('e1', 'l1', [{ fecha: hoy, minutos: 20 }])];
  const res = archivarLibro(libros, entradas, [], 'l1', Date.now());
  // Lo visible queda vacío: ni «Entradas de hoy» ni las listas ven la huella
  assert.deepStrictEqual(res.entradas, []);
  const deHoy = res.entradas.filter(e => getSesiones(e).some(s => s.fecha === hoy));
  assert.deepStrictEqual(deHoy, []);
  // …pero la huella sí sostiene la racha y los días
  assert.deepStrictEqual(computeStreak(res.entradas, res.archivo).current, 1);
  assert.strictEqual(computeStudyDays(res.entradas, res.archivo), 1);
});

// --- T3 (spec 003, RF-16/17/18): huella de estudio al eliminar (INV-1..3) ---

function mkLibroHuella(id, nombre) {
  return { id, nombre, color: '#3b82f6', creadoEn: 1, contenido: '', origen: '', fuentes: [] };
}

function mkEntradaHuella(id, libroId, sesiones) {
  const minutos = sesiones.reduce((acc, s) => acc + s.minutos, 0);
  const fecha = sesiones.length > 0 ? sesiones[sesiones.length - 1].fecha : '2026-10-01';
  return { id, libroId, titulo: 'Título ' + id, contenido: 'Contenido ' + id, fecha, creadoEn: 1, minutos, sesiones };
}

function sesionesPlan(entradas, archivo) {
  const lista = [];
  for (const e of entradas) {
    for (const s of (e.sesiones || [])) lista.push(`${s.fecha}|${s.minutos}`);
  }
  for (const r of (archivo || [])) {
    for (const s of (r.sesiones || [])) lista.push(`${s.fecha}|${s.minutos}`);
  }
  return lista.sort();
}

test('normalizarArchivo: ausente o no-array es huella vacía', () => {
  assert.deepStrictEqual(normalizarArchivo(undefined), []);
  assert.deepStrictEqual(normalizarArchivo(null), []);
  assert.deepStrictEqual(normalizarArchivo('huella'), []);
  assert.deepStrictEqual(normalizarArchivo([]), []);
});

test('normalizarArchivo: registro corrupto se descarta sin perder el resto', () => {
  const huella = normalizarArchivo([
    { libroId: 'l1', archivadoEn: 10, sesiones: [{ fecha: '2026-10-01', minutos: 20 }] },
    { libroId: 'l2', archivadoEn: 11, sesiones: 'no-array' },
    { libroId: 'l3', archivadoEn: 12, sesiones: [{ fecha: 42, minutos: 10 }] },
    { libroId: 42, archivadoEn: 13, sesiones: [{ fecha: '2026-10-02', minutos: 5 }] },
    null
  ]);
  assert.deepStrictEqual(huella, [
    { libroId: 'l1', archivadoEn: 10, sesiones: [{ fecha: '2026-10-01', minutos: 20 }] }
  ]);
});

test('normalizarArchivo: agrupa sesiones por fecha y archivadoEn ausente es 0', () => {
  const huella = normalizarArchivo([
    {
      libroId: 'l1',
      sesiones: [
        { fecha: '2026-10-02', minutos: 10 },
        { fecha: '2026-10-02', minutos: 15 },
        { fecha: '2026-10-01', minutos: 5 },
        { fecha: '2026-10-03', minutos: -4 },
        { fecha: null, minutos: 7 }
      ]
    }
  ]);
  assert.deepStrictEqual(huella, [
    {
      libroId: 'l1',
      archivadoEn: 0,
      sesiones: [
        { fecha: '2026-10-01', minutos: 5 },
        { fecha: '2026-10-02', minutos: 25 }
      ]
    }
  ]);
});

test('archivarLibro: 2 entradas dan 2 registros solo con libroId/archivadoEn/sesiones', () => {
  const libros = [mkLibroHuella('l1', 'Mate'), mkLibroHuella('l2', 'Física')];
  const entradas = [
    mkEntradaHuella('e1', 'l1', [{ fecha: '2026-10-01', minutos: 20 }, { fecha: '2026-10-02', minutos: 10 }]),
    mkEntradaHuella('e2', 'l1', [{ fecha: '2026-10-02', minutos: 30 }]),
    mkEntradaHuella('e3', 'l2', [{ fecha: '2026-10-03', minutos: 15 }])
  ];
  const res = archivarLibro(libros, entradas, [], 'l1', 999);
  assert.strictEqual(res.libros.length, 1);
  assert.strictEqual(res.libros[0].id, 'l2');
  assert.deepStrictEqual(res.entradas.map(e => e.id), ['e3']);
  assert.strictEqual(res.archivo.length, 2);
  for (const r of res.archivo) {
    assert.deepStrictEqual(Object.keys(r).sort(), ['archivadoEn', 'libroId', 'sesiones']);
    assert.strictEqual(r.libroId, 'l1');
    assert.strictEqual(r.archivadoEn, 999);
  }
  assert.deepStrictEqual(res.archivo[0].sesiones, [
    { fecha: '2026-10-01', minutos: 20 },
    { fecha: '2026-10-02', minutos: 10 }
  ]);
  assert.deepStrictEqual(res.archivo[1].sesiones, [{ fecha: '2026-10-02', minutos: 30 }]);
});

test('archivarLibro: libro sin entradas deja la huella intacta', () => {
  const libros = [mkLibroHuella('l1', 'Mate'), mkLibroHuella('l2', 'Física')];
  const entradas = [mkEntradaHuella('e1', 'l2', [{ fecha: '2026-10-01', minutos: 10 }])];
  const huellaPrevia = [{ libroId: 'viejolibro', archivadoEn: 1, sesiones: [{ fecha: '2026-09-01', minutos: 5 }] }];
  const res = archivarLibro(libros, entradas, huellaPrevia, 'l1', 999);
  assert.strictEqual(res.libros.length, 1);
  assert.strictEqual(res.entradas.length, 1);
  assert.deepStrictEqual(res.archivo, huellaPrevia);
  assert.notStrictEqual(res.archivo, huellaPrevia);
});

test('archivarLibro: no muta los arrays ni las entradas originales', () => {
  const libros = [mkLibroHuella('l1', 'Mate')];
  const entradas = [mkEntradaHuella('e1', 'l1', [{ fecha: '2026-10-01', minutos: 20 }])];
  const archivo = [];
  const copiaLibros = JSON.parse(JSON.stringify(libros));
  const copiaEntradas = JSON.parse(JSON.stringify(entradas));
  const res = archivarLibro(libros, entradas, archivo, 'l1', 5);
  assert.deepStrictEqual(libros, copiaLibros);
  assert.deepStrictEqual(entradas, copiaEntradas);
  assert.deepStrictEqual(archivo, []);
  // El registro es una copia: mutarlo no afecta a la entrada original
  res.archivo[0].sesiones[0].minutos = 999;
  assert.strictEqual(entradas[0].sesiones[0].minutos, 20);
});

test('archivarLibro: libro inexistente devuelve copias sin cambios', () => {
  const libros = [mkLibroHuella('l1', 'Mate')];
  const entradas = [mkEntradaHuella('e1', 'l1', [{ fecha: '2026-10-01', minutos: 20 }])];
  const res = archivarLibro(libros, entradas, [], 'no-existe', 5);
  assert.deepStrictEqual(res.libros, libros);
  assert.deepStrictEqual(res.entradas, entradas);
  assert.deepStrictEqual(res.archivo, []);
  assert.notStrictEqual(res.libros, libros);
  assert.notStrictEqual(res.entradas, entradas);
});

test('INV-1: sesiones(entradas)+sesiones(huella) iguales antes y después', () => {
  const libros = [mkLibroHuella('l1', 'Mate'), mkLibroHuella('l2', 'Física')];
  const entradas = [
    mkEntradaHuella('e1', 'l1', [{ fecha: '2026-10-01', minutos: 20 }, { fecha: '2026-10-02', minutos: 10 }]),
    mkEntradaHuella('e2', 'l1', [{ fecha: '2026-10-02', minutos: 30 }]),
    mkEntradaHuella('e3', 'l2', [{ fecha: '2026-10-03', minutos: 15 }])
  ];
  const antes = sesionesPlan(entradas, []);
  const res = archivarLibro(libros, entradas, [], 'l1', 7);
  const despues = sesionesPlan(res.entradas, res.archivo);
  assert.deepStrictEqual(despues, antes);
});

test('INV-2: métricas idénticas exista o no el libro (entradas+huella)', () => {
  const hoy = '2026-10-10';
  const entradas = [
    mkEntradaHuella('e1', 'l1', [{ fecha: '2026-10-08', minutos: 20 }, { fecha: '2026-10-09', minutos: 10 }]),
    mkEntradaHuella('e2', 'l1', [{ fecha: '2026-10-09', minutos: 30 }])
  ];
  const libros = [mkLibroHuella('l1', 'Mate')];
  const antes = computeDiasEstudio(entradas, hoy);
  const res = archivarLibro(libros, entradas, [], 'l1', 7);
  // La huella se lee como pseudo-entradas con sus sesiones (puente de T4)
  const pseudo = res.archivo.map((r, i) => ({ id: 'huella:' + i, sesiones: r.sesiones }));
  const despues = computeDiasEstudio([...res.entradas, ...pseudo], hoy);
  assert.deepStrictEqual(despues, antes);
  assert.deepStrictEqual(res.entradas, []);
});

test('INV-3: ningún nombre, contenido, origen, título o url sobrevive en la huella', () => {
  const libro = {
    id: 'l1', nombre: 'Mi Libro Secreto', color: '#3b82f6', creadoEn: 1,
    contenido: 'Temario secreto', origen: 'Manual secreto',
    fuentes: [{ id: 'f1', titulo: 'Fuente secreta', url: 'https://secreto.example.com' }]
  };
  const entradas = [mkEntradaHuella('e1', 'l1', [{ fecha: '2026-10-01', minutos: 20 }])];
  const res = archivarLibro([libro], entradas, [], 'l1', 7);
  const texto = JSON.stringify(res.archivo);
  for (const prohibido of [
    'Mi Libro Secreto', 'Temario secreto', 'Manual secreto',
    'Fuente secreta', 'secreto.example.com',
    entradas[0].titulo, entradas[0].contenido
  ]) {
    assert.ok(!texto.includes(prohibido), `la huella no debe contener: ${prohibido}`);
  }
});

// --- T5 (spec 003, RNF-3, RF-19): persistencia version 3 + export/import con huella ---

test('T5 validateImportedData: acepta JSON sin archivo/fuentes/metas (version 2)', () => {
  assert.strictEqual(validateImportedData({
    libros: [{ id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1 }],
    entradas: [],
    version: 2
  }), true);
  // Libro antiguo sin contenido/origen/fuentes + entrada mínima, sin metas ni archivo
  assert.strictEqual(validateImportedData({
    libros: [{ id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1 }],
    entradas: [{ id: 'e1', libroId: 'l1', titulo: 't', fecha: '2026-10-01', creadoEn: 1 }],
    version: 2
  }), true);
});

test('T5 loadState: normaliza JSON antiguo sin contenido/origen/fuentes/archivo/metas', () => {
  const estado = conLocalStorage({
    version: 2,
    libros: [{ id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1 }],
    entradas: [{ id: 'e1', libroId: 'l1', titulo: 't', fecha: '2026-10-01', creadoEn: 1, minutos: 30 }]
  }, loadState);
  assert.strictEqual(estado.libros[0].contenido, '');
  assert.strictEqual(estado.libros[0].origen, '');
  assert.deepStrictEqual(estado.libros[0].fuentes, []);
  assert.deepStrictEqual(estado.archivo, []);
  assert.deepStrictEqual(estado.metas, []);
  assert.strictEqual(estado.entradas.length, 1);
});

test('T5 export: construirExportacion marca version 3 e incluye la huella', () => {
  const estado = {
    libros: [{ id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1, contenido: 'c', origen: 'o', fuentes: [] }],
    entradas: [{ id: 'e1', libroId: 'l1', titulo: 't', fecha: '2026-10-01', creadoEn: 1, minutos: 20, sesiones: [{ fecha: '2026-10-01', minutos: 20 }] }],
    metas: [{ dias: 3, desde: '2026-09-21' }],
    archivo: [{ libroId: 'l9', archivadoEn: 7, sesiones: [{ fecha: '2026-09-01', minutos: 15 }] }]
  };
  const payload = construirExportacion(estado);
  assert.strictEqual(payload.version, 3);
  assert.deepStrictEqual(payload.archivo, estado.archivo);
  assert.deepStrictEqual(payload.libros, estado.libros);
  assert.deepStrictEqual(payload.metas, estado.metas);
});

test('T5 import: normalizarDatosImportados reemplaza también la huella', () => {
  const huella = [{ libroId: 'l1', archivadoEn: 7, sesiones: [{ fecha: '2026-09-01', minutos: 15 }] }];
  const res = normalizarDatosImportados({
    version: 3,
    libros: [{ id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1, contenido: 'c', origen: 'o', fuentes: [{ id: 'f1', titulo: 'MDN', url: 'https://a.com' }] }],
    entradas: [],
    metas: [],
    archivo: huella
  });
  assert.deepStrictEqual(res.archivo, huella);
  // JSON antiguo sin huella → huella vacía, sin perder nada (criterio 7)
  const viejo = normalizarDatosImportados({
    version: 2,
    libros: [{ id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1 }],
    entradas: [{ id: 'e1', libroId: 'l1', titulo: 't', fecha: '2026-10-01', creadoEn: 1, minutos: 30 }]
  });
  assert.deepStrictEqual(viejo.archivo, []);
  assert.strictEqual(viejo.libros[0].contenido, '');
  assert.deepStrictEqual(viejo.libros[0].fuentes, []);
  assert.strictEqual(viejo.entradas.length, 1);
});

test('T5 ida y vuelta: exportar/importar conserva contenido, origen, fuentes y huella', () => {
  const estado = {
    libros: [{ id: 'l1', nombre: 'Mate', color: '#3b82f6', creadoEn: 1, contenido: 'Temario', origen: 'Manual', fuentes: [{ id: 'f1', titulo: 'MDN', url: 'https://a.com' }] }],
    entradas: [{ id: 'e1', libroId: 'l1', titulo: 't', contenido: '', fecha: '2026-10-01', creadoEn: 1, minutos: 20, sesiones: [{ fecha: '2026-10-01', minutos: 20 }] }],
    metas: [{ dias: 3, desde: '2026-09-21' }],
    archivo: [{ libroId: 'l9', archivadoEn: 7, sesiones: [{ fecha: '2026-09-01', minutos: 15 }] }]
  };
  const payload = construirExportacion(estado);
  assert.ok(validateImportedData(payload));
  const vuelta = normalizarDatosImportados(JSON.parse(JSON.stringify(payload)));
  assert.deepStrictEqual(vuelta.libros, estado.libros);
  assert.deepStrictEqual(vuelta.archivo, estado.archivo);
  assert.deepStrictEqual(vuelta.metas, estado.metas);
  assert.strictEqual(vuelta.entradas.length, 1);
});

// --- T6 (spec 003, RF-4/RF-5/RF-6/RF-15): transicionFicha (acordeón 1/2/3) ---

function fichaCerrada() {
  return { abierta: null, opcion: 'entradas', confirmando: false, busqueda: '' };
}

test('transicionFicha: ALTERNAR abre la ficha cerrada en Entradas y sin confirmar', () => {
  const res = transicionFicha(fichaCerrada(), { tipo: 'ALTERNAR', id: 'l1' });
  assert.deepStrictEqual(res, { abierta: 'l1', opcion: 'entradas', confirmando: false, busqueda: '' });
});

test('transicionFicha: ALTERNAR la misma ficha la pliega', () => {
  const abierta = { abierta: 'l1', opcion: 'fuentes', confirmando: false, busqueda: 'tri' };
  const res = transicionFicha(abierta, { tipo: 'ALTERNAR', id: 'l1' });
  assert.deepStrictEqual(res, { abierta: null, opcion: 'entradas', confirmando: false, busqueda: '' });
});

test('transicionFicha: abrir otra pliega la anterior y resetea a Entradas', () => {
  const abierta = { abierta: 'l1', opcion: 'fuentes', confirmando: true, busqueda: 'tri' };
  const res = transicionFicha(abierta, { tipo: 'ALTERNAR', id: 'l2' });
  assert.deepStrictEqual(res, { abierta: 'l2', opcion: 'entradas', confirmando: false, busqueda: '' });
  const resAbrir = transicionFicha(abierta, { tipo: 'ABRIR', id: 'l2' });
  assert.deepStrictEqual(resAbrir, { abierta: 'l2', opcion: 'entradas', confirmando: false, busqueda: '' });
});

test('transicionFicha: CERRAR pliega y resetea', () => {
  const abierta = { abierta: 'l1', opcion: 'editar', confirmando: true, busqueda: 'x' };
  assert.deepStrictEqual(
    transicionFicha(abierta, { tipo: 'CERRAR' }),
    { abierta: null, opcion: 'entradas', confirmando: false, busqueda: '' }
  );
});

test('transicionFicha: OPCION cambia de tab y limpia confirmando (conserva búsqueda)', () => {
  const abierta = { abierta: 'l1', opcion: 'entradas', confirmando: true, busqueda: 'tri' };
  const res = transicionFicha(abierta, { tipo: 'OPCION', opcion: 'fuentes' });
  assert.deepStrictEqual(res, { abierta: 'l1', opcion: 'fuentes', confirmando: false, busqueda: 'tri' });
});

test('transicionFicha: CONFIRMAR y CANCELAR_CONFIRMAR gestionan la confirmación', () => {
  const abierta = { abierta: 'l1', opcion: 'editar', confirmando: false, busqueda: '' };
  assert.strictEqual(transicionFicha(abierta, { tipo: 'CONFIRMAR' }).confirmando, true);
  const confirmando = { abierta: 'l1', opcion: 'editar', confirmando: true, busqueda: '' };
  const cancelada = transicionFicha(confirmando, { tipo: 'CANCELAR_CONFIRMAR' });
  assert.deepStrictEqual(cancelada, { abierta: 'l1', opcion: 'editar', confirmando: false, busqueda: '' });
});

test('transicionFicha: BORRADA cierra todo y resetea', () => {
  const abierta = { abierta: 'l1', opcion: 'editar', confirmando: true, busqueda: 'x' };
  assert.deepStrictEqual(
    transicionFicha(abierta, { tipo: 'BORRADA' }),
    { abierta: null, opcion: 'entradas', confirmando: false, busqueda: '' }
  );
});

test('transicionFicha: no muta la ficha de entrada', () => {
  const ficha = { abierta: 'l1', opcion: 'entradas', confirmando: false, busqueda: '' };
  const copia = { ...ficha };
  transicionFicha(ficha, { tipo: 'ALTERNAR', id: 'l2' });
  assert.deepStrictEqual(ficha, copia);
});

// --- T8 (spec 003, RF-14): puedeAnadirFuente (límite 20) ---

function mkFuentes(n) {
  return Array.from({ length: n }, (_, i) => ({ id: 'f' + i, titulo: 'T' + i, url: 'https://a.com/' + i }));
}

test('puedeAnadirFuente: con 19 fuentes se puede añadir', () => {
  assert.strictEqual(puedeAnadirFuente(mkFuentes(19)), true);
});

test('puedeAnadirFuente: con 20 fuentes no se puede añadir (botón desactivado + aviso)', () => {
  assert.strictEqual(puedeAnadirFuente(mkFuentes(20)), false);
});

test('puedeAnadirFuente: vacía, ausente o no-array se puede añadir', () => {
  assert.strictEqual(puedeAnadirFuente([]), true);
  assert.strictEqual(puedeAnadirFuente(undefined), true);
  assert.strictEqual(puedeAnadirFuente(null), true);
});

// --- T9 (spec 003, RF-15/16/17): borrar deja métricas idénticas, incluido el único libro ---

test('textoDetalleBorrado: singular con 1 entrada y plural con 0 o varias', () => {
  assert.strictEqual(
    textoDetalleBorrado(1),
    'Se eliminará 1 entrada, su contenido, su origen y sus enlaces.'
  );
  assert.strictEqual(
    textoDetalleBorrado(5),
    'Se eliminarán 5 entradas, su contenido, su origen y sus enlaces.'
  );
  assert.strictEqual(
    textoDetalleBorrado(0),
    'Se eliminarán 0 entradas, su contenido, su origen y sus enlaces.'
  );
});

test('T9 borrar el único libro (racha 6) deja racha/días/minutos/mapa idénticos', () => {
  const { hoy, libros, entradas } = escenarioRacha6(); // único libro l1, racha 6 hasta hoy
  const antesRacha = computeStreak(entradas);
  assert.deepStrictEqual(antesRacha, { current: 6, longest: 6 });
  const antesMin = computeWeeklyMinutes(entradas);
  const antesDias = computeStudyDays(entradas);
  const antesDiasEstudio = computeDiasEstudio(entradas, hoy);
  const antesMapa = modeloMapa(entradas, hoy, MAPA_ESTADO_T4, false);
  const antesAnios = aniosConDatos(entradas, hoy);
  const res = archivarLibro(libros, entradas, [], 'l1', Date.now());
  // Lo visible queda vacío (criterio 2: el único libro)
  assert.deepStrictEqual(res.libros, []);
  assert.deepStrictEqual(res.entradas, []);
  assert.ok(res.archivo.length > 0);
  assert.deepStrictEqual(computeStreak(res.entradas, res.archivo), antesRacha);
  assert.strictEqual(computeWeeklyMinutes(res.entradas, res.archivo), antesMin);
  assert.strictEqual(computeStudyDays(res.entradas, res.archivo), antesDias);
  assert.deepStrictEqual(computeDiasEstudio(res.entradas, hoy, res.archivo), antesDiasEstudio);
  assert.deepStrictEqual(modeloMapa(res.entradas, hoy, MAPA_ESTADO_T4, false, res.archivo), antesMapa);
  assert.deepStrictEqual(aniosConDatos(res.entradas, hoy, res.archivo), antesAnios);
});

test('T9 borrar el único libro (4 semanas) deja metas/perfectas/fuegos/guía idénticos', () => {
  const libros = [mkLibroHuella('l1', 'Mate')];
  const entradas = entradasCuatroSemanasT4(); // único libro l1
  const antes = resumenMetas(entradas, METAS_T4, HOY_METAS_T4);
  assert.strictEqual(antes.totalMetas, 4);
  const res = archivarLibro(libros, entradas, [], 'l1', 123);
  assert.deepStrictEqual(res.libros, []);
  assert.deepStrictEqual(res.entradas, []);
  const despues = resumenMetas(res.entradas, METAS_T4, HOY_METAS_T4, res.archivo);
  assert.deepStrictEqual(despues, antes);
  assert.deepStrictEqual(despues.fuego, antes.fuego);
  assert.strictEqual(despues.guia, antes.guia);
});
