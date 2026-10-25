import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearCliente, ErrorBcn } from '../skills/ley-a-fondo-chile/scripts/lib/http.mjs';
import { crearFuentes } from '../skills/ley-a-fondo-chile/scripts/lib/fuentes.mjs';
import { abrirIndice } from '../skills/ley-a-fondo-chile/scripts/lib/indice.mjs';
import { cargar, reindexar } from '../skills/ley-a-fondo-chile/scripts/lib/cargar.mjs';
import { iniciarServidor, xmlSintetico } from './helpers/servidor-bcn.mjs';
import { leerFixture } from './helpers/fixtures.mjs';
import { VIN, XML, vin20000, REGLAMENTOS_20000, unReglamento, rutasBase } from './helpers/rutas.mjs';

async function preparar(extra = {}) {
  const srv = await iniciarServidor({ ...rutasBase(), ...extra });
  const dir = mkdtempSync(path.join(tmpdir(), 'cargar-'));
  const indice = abrirIndice(path.join(dir, 'indice.db'), path.join(dir, 'normas'));
  const lineas = [];
  const fuentes = crearFuentes(crearCliente({ pausaMs: 0 }), { bases: { publica: srv.base, nuevo: `${srv.base}/servicios` } });
  const ctx = { fuentes, indice, avisar: (l) => lineas.push(l), hoy: '2026-10-25' };
  return { srv, indice, ctx, lineas, cerrar: async () => { indice.cerrar(); await srv.cerrar(); } };
}

test('carga la Ley 20.000 con sus 9 reglamentos', async () => {
  const p = await preparar();
  const r = await cargar('ley 20000', p.ctx);
  assert.equal(r.estado, 'ok');
  assert.equal(r.normas.length, 1 + REGLAMENTOS_20000.length);
  assert.equal(REGLAMENTOS_20000.length, 9);
  const lista = p.indice.listar();
  assert.equal(lista.filter((n) => n.rol === 'reglamento').length, 9);
  assert.ok(lista.find((n) => n.idNorma === 269323).de.includes(235507));
  assert.match(p.lineas[0], /^\[1\/10\] Ley 20\.000… \d+ artículos ✓$/);
  await p.cerrar();
});

test('un reglamento con error 500 no aborta la carga', async () => {
  const caido = REGLAMENTOS_20000.find((x) => x !== 269323);
  const p = await preparar({ [XML(caido)]: () => ({ status: 500, body: 'x' }) });
  const r = await cargar('ley 20000', p.ctx);
  assert.equal(r.estado, 'ok');
  assert.equal(r.normas.length, 9);
  assert.equal(r.advertencias.length, 1);
  assert.match(r.advertencias[0], new RegExp(String(caido)));
  assert.ok(p.lineas.some((l) => l.includes('✗')));
  await p.cerrar();
});

test('HTML en lugar del XML principal → ErrorBcn y el índice no cambia', async () => {
  const p = await preparar({ [XML(235507)]: () => ({ status: 200, body: '<!doctype html><html></html>' }) });
  await assert.rejects(cargar('ley 20000', p.ctx), ErrorBcn);
  assert.deepEqual(p.indice.listar(), []);
  await p.cerrar();
});

test('cargar dos veces no duplica', async () => {
  const p = await preparar();
  await cargar('ley 20000', p.ctx);
  const n1 = p.indice.buscar('pequeñas cantidades', { limite: 100 }).length;
  await cargar('ley 20000', p.ctx);
  assert.equal(p.indice.listar().length, 10);
  assert.equal(p.indice.buscar('pequeñas cantidades', { limite: 100 }).length, n1);
  await p.cerrar();
});

test('código penal como dependencia no baja reglamentos; luego explícito sí y queda principal', async () => {
  const p = await preparar();
  const r = await cargar('código penal', p.ctx, { dependencia: true });
  assert.equal(r.normas.length, 1);
  assert.equal(p.indice.listar().find((n) => n.idNorma === 1984).rol, 'dependencia');
  assert.ok(!p.srv.solicitudes.some((u) => u.includes('get_vinculaciones') && u.includes('idNorma=1984')));
  const r2 = await cargar('código penal', p.ctx, { dependencia: true });
  assert.equal(r2.normas.length, 0);
  await cargar('código penal', p.ctx);
  const lista = p.indice.listar();
  assert.equal(lista.find((n) => n.idNorma === 1984).rol, 'principal');
  assert.ok(lista.some((n) => n.idNorma === 900001));
  await p.cerrar();
});

test('código civil: fecha real desde metadatos y mensaje vinculado', async () => {
  const p = await preparar();
  const r = await cargar('codigo civil', p.ctx);
  assert.equal(r.estado, 'ok');
  const lista = p.indice.listar();
  const cc = lista.find((n) => n.idNorma === 172986);
  assert.equal(cc.nombre, 'Código Civil');
  assert.equal(cc.fechaVersion, '2025-08-28');
  const mensaje = lista.find((n) => n.idNorma === 1080094);
  assert.equal(mensaje.rol, 'mensaje');
  assert.deepEqual(mensaje.de, [172986]);
  await p.cerrar();
});

test('estados no exitosos se devuelven sin descargar', async () => {
  const p = await preparar();
  assert.equal((await cargar('decreto 867', p.ctx)).estado, 'ambiguo');
  assert.equal((await cargar('la ley de drogas', p.ctx)).estado, 'no-encontrado');
  assert.ok(!p.srv.solicitudes.some((u) => u.includes('opt=7')));
  await p.cerrar();
});

test('reindexar sin cambios', async () => {
  const p = await preparar();
  await cargar('ley 20000', p.ctx);
  const r = await reindexar(null, p.ctx);
  assert.equal(r.normas.length, 10);
  assert.ok(r.normas.every((n) => n.estado === 'sin-cambios'), JSON.stringify(r.normas));
  assert.deepEqual(r.reglamentosNuevos, []);
  assert.deepEqual(r.reglamentosQuitados, []);
  await p.cerrar();
});

test('reindexar detecta cambios, reglamento nuevo y reglamento quitado', async () => {
  const p = await preparar();
  await cargar('ley 20000', p.ctx);
  const quitado = REGLAMENTOS_20000.find((x) => x !== 269323);
  const nuevaLista = { ...vin20000, aciertos: [
    ...vin20000.aciertos.filter((a) => Number(a.IDNORMA) !== quitado),
    JSON.parse(unReglamento(900002, null)).aciertos[0]] };
  p.srv.poner(VIN(235507), JSON.stringify(nuevaLista));
  p.srv.poner(XML(900002), xmlSintetico(900002, 'Decreto', '900002', [{ numero: '1', texto: 'Artículo 1.- Nuevo.' }]));
  p.srv.poner(XML(235507), leerFixture('ley-20000.xml').replace('porte consigo peque&#241;as', 'porte consigo muy peque&#241;as'));
  const r = await reindexar('ley 20000', p.ctx);
  assert.deepEqual(r.reglamentosNuevos, [900002]);
  assert.deepEqual(r.reglamentosQuitados, [quitado]);
  const principal = r.normas.find((n) => n.idNorma === 235507);
  assert.equal(principal.estado, 'actualizada');
  assert.ok(principal.cambiados.length >= 1);
  const ids = p.indice.listar().map((n) => n.idNorma);
  assert.ok(ids.includes(900002) && !ids.includes(quitado));
  await p.cerrar();
});

test('reindexar algo no cargado', async () => {
  const p = await preparar();
  const r = await reindexar('ley 20000', p.ctx);
  assert.deepEqual(r.normas, []);
  assert.equal(r.noCargada, true);
  await p.cerrar();
});

test('si fallan los metadatos, el Código Civil se carga igual con advertencia (revisión #4)', async () => {
  const p = await preparar({ '/servicios/Navegar/get_norma_json?idNorma=172986': () => ({ status: 200, body: '<!doctype html><html></html>' }) });
  const r = await cargar('codigo civil', p.ctx);
  assert.equal(r.estado, 'ok');
  assert.ok(r.advertencias.some((a) => /fecha de versión/i.test(a)), JSON.stringify(r.advertencias));
  assert.equal(p.indice.listar().find((n) => n.idNorma === 172986).fechaVersion, null);
  await p.cerrar();
});
