// Tests T1: lógica pura base del mapa de calor (node --test, sin instalar nada)
const test = require('node:test');
const assert = require('node:assert');
const {
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
  transicionMapa
} = require('../app.js');

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

test('nivelIntensidad: umbrales exactos (RF-2)', () => {
  assert.strictEqual(nivelIntensidad(0), 0);
  assert.strictEqual(nivelIntensidad(1), 1);
  assert.strictEqual(nivelIntensidad(29), 1);
  assert.strictEqual(nivelIntensidad(30), 2);
  assert.strictEqual(nivelIntensidad(59), 2);
  assert.strictEqual(nivelIntensidad(60), 3);
  assert.strictEqual(nivelIntensidad(119), 3);
  assert.strictEqual(nivelIntensidad(120), 4);
  assert.strictEqual(nivelIntensidad(239), 4);
  assert.strictEqual(nivelIntensidad(240), 5);
  assert.strictEqual(nivelIntensidad(500), 5);
});

test('lunesDeYMD: cualquier día cae en el lunes de su semana (RF-1)', () => {
  assert.strictEqual(lunesDeYMD('2026-10-08'), '2026-10-05'); // jueves
  assert.strictEqual(lunesDeYMD('2026-10-05'), '2026-10-05'); // lunes (él mismo)
  assert.strictEqual(lunesDeYMD('2026-10-11'), '2026-10-05'); // domingo
  assert.strictEqual(lunesDeYMD('2026-10-01'), '2026-09-28'); // cruza de mes
  assert.strictEqual(lunesDeYMD('2026-01-01'), '2025-12-29'); // cruza de año
});

test('computeDiasEstudio: suma minutos y cuenta entradas por día (RF-2)', () => {
  const dias = computeDiasEstudio([
    mk([{ fecha: '2026-10-08', minutos: 30 }, { fecha: '2026-10-07', minutos: 20 }]),
    mk([{ fecha: '2026-10-08', minutos: 15 }])
  ], HOY);
  assert.deepStrictEqual(dias['2026-10-08'], { minutos: 45, numEntradas: 2 });
  assert.deepStrictEqual(dias['2026-10-07'], { minutos: 20, numEntradas: 1 });
});

test('computeDiasEstudio: ignora sesiones futuras y corruptas (RF-7, P5)', () => {
  const dias = computeDiasEstudio([
    mk([{ fecha: '2026-10-10', minutos: 60 }]), // futura: no cuenta
    mk([{ fecha: '2026-10-08', minutos: 25 }, { minutos: 10 }]) // una sin fecha
  ], HOY);
  assert.strictEqual(dias['2026-10-10'], undefined);
  assert.deepStrictEqual(dias['2026-10-08'], { minutos: 25, numEntradas: 1 });
});

test('formatoMinutos: sin paréntesis <60, con horas >=60 (RF-6)', () => {
  assert.strictEqual(formatoMinutos(0), '0 min');
  assert.strictEqual(formatoMinutos(45), '45 min');
  assert.strictEqual(formatoMinutos(60), '60 (1h 0m)');
  assert.strictEqual(formatoMinutos(120), '120 (2h 0m)');
  assert.strictEqual(formatoMinutos(150), '150 (2h 30m)');
});

test('aniosConDatos: orden ascendente, omite años vacíos y solo futuros (RF-5)', () => {
  const anios = aniosConDatos([
    mk([{ fecha: '2026-10-08', minutos: 30 }]),
    mk([{ fecha: '2024-03-15', minutos: 20 }]),
    mk([{ fecha: '2027-01-05', minutos: 99 }]) // futuro: no cuenta
  ], HOY);
  assert.deepStrictEqual(anios, [2024, 2026]);
  assert.deepStrictEqual(aniosConDatos([], HOY), []);
});

// ===== T2: modelo del mapa =====

test('rangoVistaActual: 12 móvil, 53 escritorio, extra acotado (RF-3, RF-4)', () => {
  assert.strictEqual(rangoVistaActual(true, 0), 12);
  assert.strictEqual(rangoVistaActual(false, 0), 53);
  assert.strictEqual(rangoVistaActual(true, 12), 24);
  assert.strictEqual(rangoVistaActual(true, 100), 53);
});

test('numSemanasDeAnio: columnas que ocupa un año (RF-5)', () => {
  assert.strictEqual(numSemanasDeAnio(2024), 53);
  assert.strictEqual(numSemanasDeAnio(2025), 53);
  assert.strictEqual(numSemanasDeAnio(2026), 53);
});

test('rangoVistaAnio: completo en escritorio, bloques de 12 en móvil (RF-4, RF-5)', () => {
  assert.deepStrictEqual(rangoVistaAnio(2024, false, 0), { numColumnas: 53, totalAnio: 53 });
  assert.deepStrictEqual(rangoVistaAnio(2024, true, 0), { numColumnas: 12, totalAnio: 53 });
  assert.deepStrictEqual(rangoVistaAnio(2024, true, 12), { numColumnas: 24, totalAnio: 53 });
  assert.deepStrictEqual(rangoVistaAnio(2024, true, 100), { numColumnas: 53, totalAnio: 53 });
});

test('construirModeloSemanas: hoy, futuros y fuera de rango (RF-1, RF-7)', () => {
  const dias = { '2026-10-08': { minutos: 45, numEntradas: 2 } };
  const cols = construirModeloSemanas(dias, HOY, HOY, 2, (f) => f < '2026-10-01');
  assert.strictEqual(cols.length, 2);
  assert.strictEqual(cols[0].length, 7);
  const celdaHoy = cols[1][3]; // jueves
  assert.strictEqual(celdaHoy.fecha, HOY);
  assert.ok(celdaHoy.esHoy && celdaHoy.pulsable);
  assert.strictEqual(celdaHoy.nivel, 2); // 45 min → nivel 2
  assert.strictEqual(celdaHoy.numEntradas, 2);
  // Fuera de rango: 28-30 sep → atenuados, no pulsables, sin color
  assert.ok(cols[0][0].fueraDeRango && !cols[0][0].pulsable && cols[0][0].nivel === 0);
  // Futuro: 9 oct → atenuado, no pulsable, sin color
  assert.ok(cols[1][4].esFuturo && !cols[1][4].pulsable && cols[1][4].nivel === 0);
});

test('modeloMapa vista Actual: 12 columnas en móvil y la última contiene hoy (RF-1, RF-3)', () => {
  const m = modeloMapa([mk([{ fecha: HOY, minutos: 30 }])], HOY,
    { vista: 'actual', anio: null, extra: 0, diaSel: null }, true);
  assert.strictEqual(m.numColumnas, 12);
  assert.strictEqual(m.columnas[11][3].fecha, HOY); // jueves de la última semana
  assert.ok(m.hayDatosVisibles);
  assert.deepStrictEqual(m.anios, [2026]);
});

test('modeloMapa vista Actual: primera semana con días atenuados (ventana rodante, RF-1)', () => {
  const m = modeloMapa([], HOY, { vista: 'actual', anio: null, extra: 0, diaSel: null }, true);
  // Hoy es jueves: límite = hoy - 77 días = 23 jul; la 1ª columna empieza el lunes 20 jul
  const primera = m.columnas[0];
  assert.strictEqual(primera[0].fecha, '2026-07-20');
  assert.ok(primera[0].fueraDeRango && primera[1].fueraDeRango && primera[2].fueraDeRango);
  assert.ok(!primera[3].fueraDeRango); // 23 jul ya entra en el rango
  assert.ok(!m.hayDatosVisibles); // sin entradas
});

test('modeloMapa vista de año: completo en escritorio, 12 en móvil (RF-5)', () => {
  // Diciembre: visible en las últimas 12 semanas del año en móvil
  const entradas = [mk([{ fecha: '2024-12-15', minutos: 30 }])];
  const estado = { vista: 'anio', anio: 2024, extra: 0, diaSel: null };
  const mDesk = modeloMapa(entradas, HOY, estado, false);
  assert.strictEqual(mDesk.numColumnas, 53);
  const mMovil = modeloMapa(entradas, HOY, estado, true);
  assert.strictEqual(mMovil.numColumnas, 12);
  assert.ok(mMovil.hayDatosVisibles);
  // Los días fuera de 2024 van atenuados
  const ultima = mMovil.columnas[11];
  assert.ok(ultima.some(d => d.fecha > '2024-12-31' && d.fueraDeRango));
});

test('modeloMapa: sesiones futuras no colorean (RF-7)', () => {
  const m = modeloMapa([mk([{ fecha: '2026-10-10', minutos: 300 }])], HOY,
    { vista: 'actual', anio: null, extra: 0, diaSel: null }, true);
  const plano = m.columnas.flat();
  const futuro = plano.find(d => d.fecha === '2026-10-10');
  assert.strictEqual(futuro.nivel, 0);
  assert.ok(!m.hayDatosVisibles);
});

// ===== T3: máquina de estados =====

const S0 = { vista: 'actual', anio: null, extra: 0, diaSel: null };

test('transicionMapa AMPLIAR: suma 12 y no pasa del máximo (RF-4)', () => {
  const s1 = transicionMapa(S0, { tipo: 'AMPLIAR' }, { maxExtra: 41 });
  assert.strictEqual(s1.extra, 12);
  const s2 = transicionMapa({ ...S0, extra: 36 }, { tipo: 'AMPLIAR' }, { maxExtra: 41 });
  assert.strictEqual(s2.extra, 41); // tope
});

test('transicionMapa VISTA_ANIO y VISTA_ACTUAL: cambian vista y resetean (RF-4, RF-5)', () => {
  const sAnio = transicionMapa({ ...S0, extra: 24, diaSel: HOY }, { tipo: 'VISTA_ANIO', anio: 2024 }, {});
  assert.deepStrictEqual(sAnio, { vista: 'anio', anio: 2024, extra: 0, diaSel: null });
  const sActual = transicionMapa(sAnio, { tipo: 'VISTA_ACTUAL' }, {});
  assert.deepStrictEqual(sActual, S0);
});

test('transicionMapa SELECCIONAR_DIA: selecciona y hace toggle (RF-6)', () => {
  const s1 = transicionMapa(S0, { tipo: 'SELECCIONAR_DIA', fecha: HOY }, {});
  assert.strictEqual(s1.diaSel, HOY);
  const s2 = transicionMapa(s1, { tipo: 'SELECCIONAR_DIA', fecha: HOY }, {});
  assert.strictEqual(s2.diaSel, null); // mismo día: se cierra
  const s3 = transicionMapa(s1, { tipo: 'SELECCIONAR_DIA', fecha: '2026-10-07' }, {});
  assert.strictEqual(s3.diaSel, '2026-10-07'); // otro día: reemplaza
});

test('transicionMapa CAMBIO_TAMANO: conserva vista/extra y cierra detalle (RF-3, RF-6)', () => {
  const s = { vista: 'anio', anio: 2024, extra: 24, diaSel: HOY };
  const s2 = transicionMapa(s, { tipo: 'CAMBIO_TAMANO' }, {});
  assert.deepStrictEqual(s2, { ...s, diaSel: null });
});

test('transicionMapa RECALCULAR: detalle solo si el día sigue visible (RF-9)', () => {
  const s = { ...S0, diaSel: HOY };
  assert.strictEqual(transicionMapa(s, { tipo: 'RECALCULAR' }, { diaVisible: true }).diaSel, HOY);
  assert.strictEqual(transicionMapa(s, { tipo: 'RECALCULAR' }, { diaVisible: false }).diaSel, null);
});
