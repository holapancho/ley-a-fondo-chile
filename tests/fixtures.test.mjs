import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fixture } from './helpers/fixtures.mjs';

const NORMAS = [
  'ley-20000.xml', 'ley-16744.xml', 'decreto-199-2026.xml', 'decreto-867-2007.xml',
  'codigo-civil.xml', 'codigo-trabajo.xml', 'codigo-penal.xml', 'mensaje-codigo-civil.xml', 'ley-20190.xml',
];
const OTROS = [
  'codigos.json', 'vinculaciones-16744.json', 'vinculaciones-20000.json',
  'norma-json-28650.json', 'norma-json-172986.json', 'norma-json-1984.json', 'api-leychile-v1.yaml',
  'busqueda-16744.xml', 'busqueda-20000.xml', 'busqueda-decreto-867.xml',
];

for (const nombre of [...NORMAS, ...OTROS]) {
  test(`fixture ${nombre} existe y no está vacío`, () => {
    assert.ok(existsSync(fixture(nombre)), `falta ${nombre}`);
    assert.ok(statSync(fixture(nombre)).size > 0);
  });
}

for (const nombre of NORMAS) {
  test(`fixture ${nombre} es XML de norma`, () => {
    const t = readFileSync(fixture(nombre), 'utf8');
    assert.ok(t.startsWith('<?xml'));
    assert.ok(t.includes('<Norma '));
  });
}
