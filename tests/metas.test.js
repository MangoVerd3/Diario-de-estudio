// Tests T1 (spec 002): normalización y persistencia del historial de metas.
// node --test, sin instalar nada (constitución P4).
const test = require('node:test');
const assert = require('node:assert');
const {
  normalizarMetas,
  validateImportedData,
  loadState,
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
} = require('../app.js');// --- normalizarMetas (RNF-2) ---

test('normalizarMetas: sin datos devuelve historial vacío', () => {
  assert.deepStrictEqual(normalizarMetas(undefined), []);
  assert.deepStrictEqual(normalizarMetas(null), []);
  assert.deepStrictEqual(normalizarMetas('cinco'), []);
  assert.deepStrictEqual(normalizarMetas(5), []);
  assert.deepStrictEqual(normalizarMetas({ dias: 5, desde: '2026-10-05' }), []);
  assert.deepStrictEqual(normalizarMetas([null, 5, 'x', {}]), []);
});

test('normalizarMetas: descarta metas con dias fuera de 1–7 sin perder las válidas', () => {
  assert.deepStrictEqual(normalizarMetas([{ dias: 0, desde: '2026-10-05' }]), []);
  assert.deepStrictEqual(normalizarMetas([{ dias: 8, desde: '2026-10-05' }]), []);
  assert.deepStrictEqual(normalizarMetas([{ dias: '5', desde: '2026-10-05' }]), []);
  assert.deepStrictEqual(normalizarMetas([{ dias: 3.5, desde: '2026-10-05' }]), []);
  assert.deepStrictEqual(normalizarMetas([
    { dias: 9, desde: '2026-10-12' },
    { dias: 7, desde: '2026-10-05' }
  ]), [{ dias: 7, desde: '2026-10-05' }]);
});

test('normalizarMetas: descarta metas con desde inválido', () => {
  assert.deepStrictEqual(normalizarMetas([{ dias: 3 }]), []);
  assert.deepStrictEqual(normalizarMetas([{ dias: 3, desde: 20261005 }]), []);
  assert.deepStrictEqual(normalizarMetas([{ dias: 3, desde: '2026/10/05' }]), []);
  assert.deepStrictEqual(normalizarMetas([{ dias: 3, desde: '2026-10' }]), []);
  assert.deepStrictEqual(normalizarMetas([{ dias: 3, desde: '' }]), []);
});

test('normalizarMetas: ajusta al lunes un desde que no lo es', () => {
  assert.deepStrictEqual(normalizarMetas([{ dias: 5, desde: '2026-10-08' }]),
    [{ dias: 5, desde: '2026-10-05' }]);
  assert.deepStrictEqual(normalizarMetas([{ dias: 2, desde: '2026-10-11' }]),
    [{ dias: 2, desde: '2026-10-05' }]);
  assert.deepStrictEqual(normalizarMetas([{ dias: 2, desde: '2026-01-01' }]),
    [{ dias: 2, desde: '2025-12-29' }]);
  // un lunes se queda como está
  assert.deepStrictEqual(normalizarMetas([{ dias: 2, desde: '2026-10-05' }]),
    [{ dias: 2, desde: '2026-10-05' }]);
});

test('normalizarMetas: ordena por desde y devuelve objetos limpios', () => {
  const historial = normalizarMetas([
    { dias: 3, desde: '2026-10-26', extra: 'basura' },
    { dias: 5, desde: '2026-10-05' },
    { dias: 7, desde: '2026-10-12' }
  ]);
  assert.deepStrictEqual(historial, [
    { dias: 5, desde: '2026-10-05' },
    { dias: 7, desde: '2026-10-12' },
    { dias: 3, desde: '2026-10-26' }
  ]);
});

// --- Carga e importación de datos antiguos (RNF-2, P5) ---

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

const entradaAntigua = {
  id: 'e1', libroId: 'l1', titulo: 't', contenido: '', fecha: '2026-10-01',
  creadoEn: 1, minutos: 30, sesiones: [{ fecha: '2026-10-01', minutos: 30 }]
};

test('loadState: un JSON antiguo sin metas carga con historial vacío y conserva las entradas', () => {
  const estado = conLocalStorage({
    libros: [{ id: 'l1', nombre: 'Libro', color: '#ffffff', creadoEn: 1 }],
    entradas: [entradaAntigua]
  }, loadState);
  assert.deepStrictEqual(estado.metas, []);
  assert.strictEqual(estado.entradas.length, 1);
  assert.strictEqual(estado.entradas[0].fecha, '2026-10-01');
});

test('loadState: normaliza el historial de metas guardado', () => {
  const estado = conLocalStorage({
    libros: [], entradas: [],
    metas: [{ dias: 9, desde: '2026-10-12' }, { dias: 4, desde: '2026-10-07' }]
  }, loadState);
  assert.deepStrictEqual(estado.metas, [{ dias: 4, desde: '2026-10-05' }]);
});

test('loadState: sin datos guardados devuelve historial vacío', () => {
  const estado = conLocalStorage(null, loadState);
  assert.deepStrictEqual(estado.metas, []);
  assert.deepStrictEqual(estado.entradas, []);
});

test('validateImportedData: acepta el metas ausente o corrupto y sigue validando el resto', () => {
  assert.strictEqual(validateImportedData({ libros: [], entradas: [] }), true);
  assert.strictEqual(validateImportedData({
    libros: [], entradas: [], metas: [{ dias: 5, desde: '2026-10-05' }]
  }), true);
  // el archivo sigue siendo importable: normalizarMetas descarta las metas inválidas
  assert.strictEqual(validateImportedData({ libros: [], entradas: [], metas: 'cinco' }), true);
  // lo que no cambia: sin los arrays de siempre sigue fallando
  assert.strictEqual(validateImportedData({ entradas: [] }), false);
});

// --- Vigencia de la meta (RF-1, RF-2) ---

test('metaVigenteDe: sin historial la meta es 3 y no reevalúa semanas vividas', () => {
  assert.strictEqual(metaVigenteDe([], '2026-10-05'), 3);
  assert.strictEqual(metaVigenteDe([], '2025-01-01'), 3);
  const historial = [
    { dias: 5, desde: '2026-10-05' },
    { dias: 2, desde: '2026-10-19' }
  ];
  assert.strictEqual(metaVigenteDe(historial, '2026-10-05'), 5);
  assert.strictEqual(metaVigenteDe(historial, '2026-10-18'), 5);
  assert.strictEqual(metaVigenteDe(historial, '2026-10-19'), 2);
  // semanas anteriores a la primera meta: 3 (no se reevalúan)
  assert.strictEqual(metaVigenteDe(historial, '2026-09-28'), 3);
});

test('guardarMetaSemanal: la primera meta rige desde el lunes de la semana en curso', () => {
  assert.deepStrictEqual(guardarMetaSemanal([], 5, '2026-10-07'), [{ dias: 5, desde: '2026-10-05' }]);
  assert.deepStrictEqual(guardarMetaSemanal([], 1, '2026-10-05'), [{ dias: 1, desde: '2026-10-05' }]);
  // aunque coincida con los 3 días por defecto queda registrada (RF-2)
  assert.deepStrictEqual(guardarMetaSemanal([], 3, '2026-10-07'), [{ dias: 3, desde: '2026-10-05' }]);
});

test('guardarMetaSemanal: cada cambio posterior rige desde el lunes siguiente', () => {
  assert.deepStrictEqual(guardarMetaSemanal([{ dias: 5, desde: '2026-10-05' }], 4, '2026-10-08'), [
    { dias: 5, desde: '2026-10-05' },
    { dias: 4, desde: '2026-10-12' }
  ]);
});

test('guardarMetaSemanal: un cambio antes del lunes sustituye al pendiente sin tocar la vigente', () => {
  const historial = guardarMetaSemanal([{ dias: 5, desde: '2026-10-05' }], 4, '2026-10-08');
  assert.deepStrictEqual(guardarMetaSemanal(historial, 6, '2026-10-09'), [
    { dias: 5, desde: '2026-10-05' },
    { dias: 6, desde: '2026-10-12' }
  ]);
  assert.strictEqual(historial.length, 2);
});

test('guardarMetaSemanal: volver a la meta vigente solo deshace el pendiente', () => {
  assert.deepStrictEqual(guardarMetaSemanal([
    { dias: 5, desde: '2026-10-05' },
    { dias: 4, desde: '2026-10-12' }
  ], 5, '2026-10-08'), [{ dias: 5, desde: '2026-10-05' }]);
});

test('metaPendiente y metaSemanaActual: avisan solo cuando el cambio aún no rige', () => {
  assert.strictEqual(metaPendiente([{ dias: 5, desde: '2026-10-05' }], '2026-10-08'), null);
  assert.deepStrictEqual(metaPendiente([
    { dias: 5, desde: '2026-10-05' }, { dias: 4, desde: '2026-10-12' }
  ], '2026-10-08'), { dias: 4, desde: '2026-10-12' });
  assert.deepStrictEqual(metaSemanaActual([{ dias: 5, desde: '2026-10-05' }], '2026-10-08'),
    { dias: 5, aviso: null });
  assert.deepStrictEqual(metaSemanaActual([
    { dias: 5, desde: '2026-10-05' }, { dias: 4, desde: '2026-10-12' }
  ], '2026-10-08'), { dias: 4, aviso: 'Se aplicará desde el lunes' });
  // pasado el lunes del cambio, el pendiente ya rige y el aviso desaparece
  assert.deepStrictEqual(metaSemanaActual([
    { dias: 5, desde: '2026-10-05' }, { dias: 4, desde: '2026-10-12' }
  ], '2026-10-12'), { dias: 4, aviso: null });
});

// --- Días estudiados de la semana (RF-3) ---

// Entrada de prueba con el modelo real: sesiones agrupadas por fecha
const mk = (sesiones) => ({
  id: Math.random().toString(36).slice(2),
  libroId: 'l1',
  titulo: 't',
  contenido: '',
  fecha: sesiones[sesiones.length - 1].fecha,
  creadoEn: 1,
  minutos: sesiones.reduce((a, s) => a + s.minutos, 0),
  sesiones
});

const HOY = '2026-10-08'; // jueves

test('diasConMinutos: solo días con minutos > 0 y ordenados', () => {
  const dias = computeDiasEstudio([
    mk([{ fecha: '2026-10-06', minutos: 20 }]),
    mk([{ fecha: '2026-10-05', minutos: 30 }, { fecha: '2026-10-07', minutos: 0 }]),
    mk([{ fecha: '2026-10-08', minutos: -5 }])
  ], HOY);
  assert.deepStrictEqual(diasConMinutos(dias), ['2026-10-05', '2026-10-06']);
});

test('diasEstudiadosSemana: L + M + dos veces el jueves = 3 días', () => {
  const dias = computeDiasEstudio([
    mk([{ fecha: '2026-10-05', minutos: 25 }]),
    mk([{ fecha: '2026-10-06', minutos: 40 }]),
    mk([{ fecha: '2026-10-08', minutos: 15 }]),
    mk([{ fecha: '2026-10-08', minutos: 10 }])
  ], HOY);
  const fechas = diasConMinutos(dias);
  assert.strictEqual(diasEstudiadosSemana(fechas, '2026-10-05'), 3);
  // una sesión futura no cuenta
  assert.strictEqual(diasEstudiadosSemana(fechas, '2026-10-12'), 0);
  // la semana anterior y la siguiente quedan fuera
  assert.strictEqual(diasEstudiadosSemana(fechas, '2026-09-28'), 0);
  assert.strictEqual(diasEstudiadosSemana(fechas, '2026-10-19'), 0);
});

// --- Semanas cerradas, rachas y récords (RF-9) ---

// Escenario: HOY = lunes 2026-11-02, así que la última semana cerrada es
// 2026-10-26 y solo se evalúan semanas cerradas.
const HOY_LUNES = '2026-11-02';

test('semanasAEvaluar: del primer día estudiado a la última semana cerrada', () => {
  const fechas = ['2026-10-05', '2026-10-06', '2026-10-26'];
  assert.deepStrictEqual(semanasAEvaluar(fechas, HOY_LUNES), [
    '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'
  ]);
  // sin días estudiados no hay ventana
  assert.deepStrictEqual(semanasAEvaluar([], HOY_LUNES), []);
  // sin ninguna semana cerrada todavía
  assert.deepStrictEqual(semanasAEvaluar(['2026-11-02'], HOY_LUNES), []);
});

test('semanasAEvaluar: una entrada de 0 minutos en semanas anteriores no cambia el resultado', () => {
  const dias = computeDiasEstudio([
    mk([{ fecha: '2026-10-01', minutos: 0 }]),
    mk([{ fecha: '2026-10-05', minutos: 25 }]),
    mk([{ fecha: '2026-10-13', minutos: 25 }]),
    mk([{ fecha: '2026-10-20', minutos: 25 }])
  ], HOY_LUNES);
  const conCero = resumenSemanas(diasConMinutos(dias), [], HOY_LUNES);
  const sinCero = resumenSemanas(diasConMinutos(computeDiasEstudio([
    mk([{ fecha: '2026-10-05', minutos: 25 }]),
    mk([{ fecha: '2026-10-13', minutos: 25 }]),
    mk([{ fecha: '2026-10-20', minutos: 25 }])
  ], HOY_LUNES)), [], HOY_LUNES);
  assert.deepStrictEqual(rachasDeSemanas(conCero, 'cumplida'), rachasDeSemanas(sinCero, 'cumplida'));
  assert.deepStrictEqual(rachasDeSemanas(conCero, 'perfecta'), rachasDeSemanas(sinCero, 'perfecta'));
  assert.strictEqual(conCero.filter(s => s.cumplida).length, sinCero.filter(s => s.cumplida).length);
});

test('resumenSemanas: cada semana con su meta vigente y las vacías no cuentan', () => {
  const fechas = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-26'];
  const metas = [{ dias: 3, desde: '2026-10-05' }, { dias: 2, desde: '2026-10-19' }];
  const semanas = resumenSemanas(fechas, metas, HOY_LUNES);
  assert.strictEqual(semanas.length, 4);
  assert.deepStrictEqual(semanas[0], {
    lunes: '2026-10-05', meta: 3, diasEstudiados: 3, cumplida: true, perfecta: false
  });
  // semana sin entradas: no cumplida y corta la racha
  assert.strictEqual(semanas[1].diasEstudiados, 0);
  assert.strictEqual(semanas[1].cumplida, false);
  // la meta vigente de la última semana es la del cambio del 19
  assert.strictEqual(semanas[3].meta, 2);
  assert.strictEqual(semanas[3].cumplida, false);
  // antes de la primera meta, la vigente es 3
  assert.strictEqual(metaVigenteDe(metas, '2026-09-28'), 3);
});

test('rachasDeSemanas: racha hasta la última cerrada y récord histórico (RF-9)', () => {
  const fechas = [
    '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28',
    // semana del 2026-10-05 sin estudiar: corta la tanda de 6
    '2026-10-12', '2026-10-19',
    // semana del 2026-10-26 completa: perfecta
    '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'
  ];
  const semanas = resumenSemanas(fechas, [{ dias: 1, desde: '2026-08-24' }], HOY_LUNES);
  assert.strictEqual(semanas.length, 10);
  assert.strictEqual(semanas[semanas.length - 1].lunes, '2026-10-26');
  assert.deepStrictEqual(rachasDeSemanas(semanas, 'cumplida'), { racha: 3, record: 6 });
  assert.deepStrictEqual(rachasDeSemanas(semanas, 'perfecta'), { racha: 1, record: 1 });
});

test('rachasDeSemanas: la racha es 0 si la última semana cerrada no cuenta y el récord se conserva', () => {
  const fechas = ['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'];
  const semanas = resumenSemanas(fechas, [{ dias: 1, desde: '2026-08-24' }], HOY_LUNES);
  assert.strictEqual(semanas[semanas.length - 1].diasEstudiados, 0);
  assert.deepStrictEqual(rachasDeSemanas(semanas, 'cumplida'), { racha: 0, record: 6 });
});

test('rachasDeSemanas: sin semanas devuelve ceros', () => {
  assert.deepStrictEqual(rachasDeSemanas([], 'cumplida'), { racha: 0, record: 0 });
  assert.deepStrictEqual(rachasDeSemanas([], 'perfecta'), { racha: 0, record: 0 });
});

// --- Orquestadora del resumen semanal (RNF-1) ---

test('resumenMetas: primer uso a mitad de semana con meta 3', () => {
  const entradas = [mk([{ fecha: '2026-10-08', minutos: 25 }])]; // jueves
  const metas = [{ dias: 3, desde: '2026-10-05' }];
  const jueves = resumenMetas(entradas, metas, '2026-10-08');
  assert.strictEqual(jueves.meta, 3);
  assert.strictEqual(jueves.estudiados, 1);
  assert.strictEqual(jueves.metaCumplida, false);
  assert.strictEqual(jueves.totalMetas, 0);
  assert.strictEqual(jueves.rachaMetas, 0);
  // al llegar el lunes la semana ya cerró con un solo día: sigue sin cumplir
  const lunes = resumenMetas(entradas, metas, '2026-10-12');
  assert.strictEqual(lunes.estudiados, 0);
  assert.strictEqual(lunes.totalMetas, 0);
});

test('resumenMetas: la semana se cumple al estudiar el sábado y el domingo', () => {
  const entradas = [
    mk([{ fecha: '2026-10-08', minutos: 25 }]),
    mk([{ fecha: '2026-10-10', minutos: 25 }]),
    mk([{ fecha: '2026-10-11', minutos: 25 }])
  ];
  const r = resumenMetas(entradas, [{ dias: 3, desde: '2026-10-05' }], '2026-10-12');
  assert.strictEqual(r.totalMetas, 1);
  assert.strictEqual(r.rachaMetas, 1);
  assert.strictEqual(r.recordMetas, 1);
});

test('resumenMetas: con meta 1 cualquier día cuenta y con meta 7 hace falta la perfecta', () => {
  const unDia = [mk([{ fecha: '2026-10-08', minutos: 25 }])];
  assert.strictEqual(resumenMetas(unDia, [{ dias: 1, desde: '2026-10-05' }], '2026-10-12').totalMetas, 1);
  const ymd = (d) => `2026-10-${String(d).padStart(2, '0')}`;
  const siete = [];
  for (let d = 5; d <= 11; d++) siete.push(mk([{ fecha: ymd(d), minutos: 25 }]));
  const r = resumenMetas(siete, [{ dias: 7, desde: '2026-10-05' }], '2026-10-12');
  assert.strictEqual(r.totalMetas, 1);
  assert.strictEqual(r.totalPerfectas, 1);
});

test('resumenMetas: corregir o eliminar en una semana cerrada recalcula totales y rachas', () => {
  const metas = [{ dias: 2, desde: '2026-10-05' }];
  const entradas = [
    mk([{ fecha: '2026-10-08', minutos: 25 }]),
    mk([{ fecha: '2026-10-09', minutos: 25 }])
  ];
  assert.strictEqual(resumenMetas(entradas, metas, '2026-10-12').totalMetas, 1);
  // corregir una sesión a 0 minutos deja la semana con un solo día
  const corregidas = [
    entradas[0],
    { ...entradas[1], sesiones: [{ fecha: '2026-10-09', minutos: 0 }], minutos: 0 }
  ];
  const r = resumenMetas(corregidas, metas, '2026-10-12');
  assert.strictEqual(r.totalMetas, 0);
  assert.strictEqual(r.rachaMetas, 0);
  // eliminar la entrada deja la semana vacía: mismo resultado
  assert.strictEqual(resumenMetas([entradas[0]], metas, '2026-10-12').totalMetas, 0);
});

test('resumenMetas: eliminar la entrada más antigua desplaza la ventana', () => {
  // la meta rige desde el lunes de la semana del 28-sep, para que ambas semanas
  // cerradas se evalúen con meta 1
  const metas = [{ dias: 1, desde: '2026-09-28' }];
  const conAntigua = resumenMetas([
    mk([{ fecha: '2026-09-30', minutos: 20 }]),
    mk([{ fecha: '2026-10-08', minutos: 20 }])
  ], metas, '2026-10-12');
  const sinAntigua = resumenMetas([mk([{ fecha: '2026-10-08', minutos: 20 }])], metas, '2026-10-12');
  assert.strictEqual(conAntigua.totalMetas, 2); // semanas del 28-sep y del 5-oct
  assert.strictEqual(sinAntigua.totalMetas, 1); // solo la del 5-oct
});

test('resumenMetas: importar sin historial evalúa con la meta 3', () => {
  const r = resumenMetas([mk([{ fecha: '2026-10-08', minutos: 25 }])], [], '2026-10-12');
  assert.strictEqual(r.meta, 3);
  assert.strictEqual(r.estudiados, 0);
  assert.strictEqual(r.totalMetas, 0);
});

test('resumenMetas: la semana del cambio de hora no pierde ni duplica días', () => {
  const entradas = [];
  for (const fecha of ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']) {
    entradas.push(mk([{ fecha, minutos: 20 }]));
  }
  const r = resumenMetas(entradas, [{ dias: 7, desde: '2026-10-19' }], '2026-10-26');
  assert.strictEqual(r.totalPerfectas, 1);
  assert.strictEqual(r.totalMetas, 1);
});

// --- Fuegos del día (RF-4, RF-5, RF-6, RF-7) ---

const ymdOct = (d) => `2026-10-${String(d).padStart(2, '0')}`;
const fechasLMXJ = [ymdOct(5), ymdOct(6), ymdOct(7), ymdOct(8)];
const sieteFechas = [];
for (let d = 5; d <= 11; d++) sieteFechas.push(ymdOct(d));

test('fechaLogroMeta: devuelve el día estudiado nº N y null si aún no se alcanza', () => {
  const metas = [{ dias: 5, desde: '2026-10-05' }];
  assert.strictEqual(fechaLogroMeta(fechasLMXJ, [{ dias: 1, desde: '2026-10-05' }], '2026-10-05'), '2026-10-05');
  assert.strictEqual(fechaLogroMeta(fechasLMXJ, [{ dias: 4, desde: '2026-10-05' }], '2026-10-05'), '2026-10-08');
  assert.strictEqual(fechaLogroMeta(fechasLMXJ, metas, '2026-10-05'), null);
});

test('esPerfectaHoy: solo el domingo con los 7 días estudiados', () => {
  assert.strictEqual(esPerfectaHoy(sieteFechas, '2026-10-11'), true);
  assert.strictEqual(esPerfectaHoy(sieteFechas, '2026-10-10'), false); // sábado
  assert.strictEqual(esPerfectaHoy(sieteFechas.slice(0, 6), '2026-10-11'), false); // 6 días
  assert.strictEqual(esPerfectaHoy(sieteFechas, '2026-10-12'), false); // lunes siguiente
});

test('estadoFuegoHoy: prioridad perfecta > meta > racha', () => {
  // domingo con los 7 días y además la meta: gana la perfecta (meta 7 y meta 6)
  assert.deepStrictEqual(estadoFuegoHoy(sieteFechas, [{ dias: 7, desde: '2026-10-05' }], '2026-10-11', 2),
    { tipo: 'perfecta', texto: '🔥 ¡Semana perfecta!' });
  assert.deepStrictEqual(estadoFuegoHoy(sieteFechas, [{ dias: 6, desde: '2026-10-05' }], '2026-10-11', 0),
    { tipo: 'perfecta', texto: '🔥 ¡Semana perfecta!' });
  // logro hoy con racha activa: gana la meta
  assert.deepStrictEqual(estadoFuegoHoy(fechasLMXJ.slice(0, 2), [{ dias: 2, desde: '2026-10-05' }], '2026-10-06', 3),
    { tipo: 'meta', texto: '🔥 ¡Meta semanal alcanzada!' });
  // sin logro hoy pero con racha activa: racha
  assert.deepStrictEqual(estadoFuegoHoy([ymdOct(5)], [{ dias: 2, desde: '2026-10-05' }], '2026-10-06', 3),
    { tipo: 'racha', texto: '🔥 Racha de metas semanales activa' });
  // nada que celebrar
  assert.deepStrictEqual(estadoFuegoHoy([], [], '2026-10-06', 0), { tipo: null, texto: '' });
});

test('estadoFuegoHoy: el logro se mide por la fecha de la sesión, no por cuándo se registró', () => {
  const fechas = [ymdOct(5), ymdOct(6)];
  const metas = [{ dias: 2, desde: '2026-10-05' }];
  assert.strictEqual(estadoFuegoHoy(fechas, metas, '2026-10-06', 0).tipo, 'meta');
  // el jueves, aunque sea el día del registro, el logro fue el martes
  assert.strictEqual(estadoFuegoHoy(fechas, metas, '2026-10-08', 0).tipo, null);
});

test('resumenMetas: fuego y perfectaHoy salen del mismo resumen', () => {
  // domingo con la semana completa y meta 7
  const entradas = sieteFechas.map(f => mk([{ fecha: f, minutos: 25 }]));
  const r = resumenMetas(entradas, [{ dias: 7, desde: '2026-10-05' }], '2026-10-11');
  assert.strictEqual(r.perfectaHoy, true);
  assert.deepStrictEqual(r.fuego, { tipo: 'perfecta', texto: '🔥 ¡Semana perfecta!' });
  assert.strictEqual(r.fechaLogroMeta, '2026-10-11');
});

// --- Días posibles y concordancia (RF-8) ---

test('diasPosiblesSemana: de hoy al domingo, hoy solo si no está estudiado', () => {
  // miércoles con lunes y martes estudiados: quedan miércoles, jueves, viernes,
  // sábado y domingo
  assert.strictEqual(diasPosiblesSemana([ymdOct(5), ymdOct(6)], '2026-10-07'), 5);
  // el miércoles ya estudiado no cuenta
  assert.strictEqual(diasPosiblesSemana([ymdOct(5), ymdOct(6), ymdOct(7)], '2026-10-07'), 4);
  // domingo: solo queda hoy, y si ya se estudió no queda nada
  assert.strictEqual(diasPosiblesSemana([], '2026-10-11'), 1);
  assert.strictEqual(diasPosiblesSemana([ymdOct(11)], '2026-10-11'), 0);
  // sin ningún día estudiado, del lunes al domingo son 7
  assert.strictEqual(diasPosiblesSemana([], '2026-10-05'), 7);
});

test('textoMetaDias y textoFaltanDias: concordancia en singular y plural', () => {
  assert.strictEqual(textoMetaDias(1), '1 día');
  assert.strictEqual(textoMetaDias(5), '5 días');
  assert.strictEqual(textoMetaDias(7), '7 días');
  assert.strictEqual(textoFaltanDias(1), 'te falta 1 día');
  assert.strictEqual(textoFaltanDias(2), 'te faltan 2 días');
  assert.strictEqual(textoFaltanDias(7), 'te faltan 7 días');
});

// --- Texto de guía bajo la tira (RF-8) ---

const guia = (datos) => textoGuiaMeta({
  meta: 5, estudiados: 0, diasPosibles: 3, perfectaPosible: false,
  hayEntradasAnteriores: false, perfectaHoy: false, ...datos
});

test('textoGuiaMeta: caso 1, semana perfecta completada hoy', () => {
  assert.strictEqual(guia({ perfectaHoy: true, estudiados: 7, perfectaPosible: true }), '¡Completaste una semana perfecta!');
});

test('textoGuiaMeta: caso 2, semana sin empezar con entradas anteriores', () => {
  assert.strictEqual(guia({ hayEntradasAnteriores: true }), 'Esta semana aún no has estudiado: tu meta es de 5 días.');
  assert.strictEqual(guia({ meta: 1, hayEntradasAnteriores: true }), 'Esta semana aún no has estudiado: tu meta es de 1 día.');
  // sin entradas anteriores no es el caso 2: pasa al 3 (meta aún alcanzable)
  assert.strictEqual(guia({ diasPosibles: 5 }), 'Tu meta semanal es de 5 días, te faltan 5 días.');
});

test('textoGuiaMeta: caso 3, meta alcanzable', () => {
  assert.strictEqual(guia({ estudiados: 3, diasPosibles: 2 }), 'Tu meta semanal es de 5 días, te faltan 2 días.');
  assert.strictEqual(guia({ meta: 2, estudiados: 1, diasPosibles: 1 }), 'Tu meta semanal es de 2 días, te falta 1 día.');
  // justo alcanzable
  assert.strictEqual(guia({ estudiados: 3, diasPosibles: 2 }), 'Tu meta semanal es de 5 días, te faltan 2 días.');
});

test('textoGuiaMeta: caso 4, meta inalcanzable', () => {
  // meta 6, lunes y martes estudiados, viernes sin estudiar: 2 + 3 = 5 < 6
  assert.strictEqual(guia({ meta: 6, estudiados: 2, diasPosibles: 3 }), 'Recuerda estudiar todas las semanas');
});

test('textoGuiaMeta: caso 5, meta cumplida y semana perfecta aún posible', () => {
  // meta 5 cumplida (5 días estudiados) y ningún día anterior a hoy sin estudiar
  assert.strictEqual(guia({ estudiados: 5, perfectaPosible: true, diasPosibles: 3 }),
    'Meta semanal alcanzada, ¡esta semana puedes conseguir una semana perfecta!');
});

test('textoGuiaMeta: caso 6, meta cumplida sin perfecta posible', () => {
  assert.strictEqual(guia({ estudiados: 5, diasPosibles: 0 }), 'Meta alcanzada');
  assert.strictEqual(guia({ estudiados: 5, diasPosibles: 2 }), 'Meta alcanzada, ¿vamos a estudiar más?');
});

test('resumenMetas: la guía se construye con los datos del resumen', () => {
  // miércoles, meta 5, tres días estudiados
  const entradas = [ymdOct(5), ymdOct(6), ymdOct(7)].map(f => mk([{ fecha: f, minutos: 25 }]));
  const r = resumenMetas(entradas, [{ dias: 5, desde: '2026-10-05' }], '2026-10-07');
  assert.strictEqual(r.estudiados, 3);
  assert.strictEqual(r.diasPosibles, 4);
  assert.strictEqual(r.perfectaPosible, true);
  assert.strictEqual(r.metaCumplida, false);
  assert.strictEqual(r.guia, 'Tu meta semanal es de 5 días, te faltan 2 días.');
});

// --- Tarjetas del carrusel (RF-10) ---

test('textoTarjetaRacha: total, racha y récord', () => {
  assert.strictEqual(textoTarjetaRacha(4, 3, 6), '4 · racha 3 · récord 6');
  assert.strictEqual(textoTarjetaRacha(0, 0, 0), '0 · racha 0 · récord 0');
  assert.strictEqual(textoTarjetaRacha(1, 1, 1), '1 · racha 1 · récord 1');
});
