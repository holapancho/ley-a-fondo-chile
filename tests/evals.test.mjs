import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirIndice } from '../skills/ley-a-fondo-chile/scripts/lib/indice.mjs';
import { parseNorma } from '../skills/ley-a-fondo-chile/scripts/lib/parser.mjs';
import { evaluar } from '../evals/verificar.mjs';
import { leerFixture } from './helpers/fixtures.mjs';

const PREGUNTAS = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'evals', 'preguntas.json'), 'utf8'));
const trayecto = PREGUNTAS.find((p) => p.id === 'trayecto');
let dir, idx, link5;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'evals-'));
  idx = abrirIndice(path.join(dir, 'i.db'), path.join(dir, 'n'));
  idx.guardarNorma(parseNorma(leerFixture('ley-16744.xml')), { rol: 'principal', fechaObtencion: '2026-10-25' });
  link5 = idx.articulo(28650, '5').link;
});
after(() => { idx.cerrar(); rmSync(dir, { recursive: true, force: true }); });

test('preguntas.json tiene los 8 casos con id único', () => {
  assert.equal(PREGUNTAS.length, 8);
  assert.equal(new Set(PREGUNTAS.map((p) => p.id)).size, 8);
});

test('respuesta que cubre el artículo esperado y cita bien → ok', () => {
  const md = `Sí: el accidente de trayecto está cubierto ([Ley 16.744, art. 5](${link5})).`;
  const r = evaluar(trayecto, md, idx);
  assert.equal(r.cobertura, '1/1');
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('respuesta que no cita el artículo esperado → falla con faltantes', () => {
  const r = evaluar(trayecto, 'Sí, el trayecto cuenta ([Ley 16.744, art. 5](https://www.bcn.cl/leychile/navegar?idNorma=28650&idParte=8745395)).', idx);
  assert.equal(r.ok, false);
  assert.deepEqual(r.faltantes, ['28650 art. 5']);
});

test('respuesta sin el texto exigido → falla', () => {
  const r = evaluar(trayecto, `Está cubierto ([Ley 16.744, art. 5](${link5})).`, idx);
  assert.equal(r.ok, false);
  assert.deepEqual(r.sinContenido, ['trayecto']);
});
