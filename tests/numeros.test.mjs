import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarNumero } from '../skills/ley-a-fondo-chile/scripts/lib/numeros.mjs';

const CASOS = [
  ['4º', '4'], ['Artículo 2º', '2'], ['18 QUÁTER', '18 quater'], ['18-quáter', '18 quater'],
  ['18 quater', '18 quater'], ['66 BIS', '66 bis'], ['152 quáter M', '152 quater m'], ['1437', '1437'],
  ['5°', '5'], ['art. 4', '4'], ['  18   bis ', '18 bis'], ['Artículo 1º transitorio', '1 transitorio'],
];

for (const [entrada, salida] of CASOS) {
  test(`normalizarNumero(${JSON.stringify(entrada)}) → ${salida}`, () => {
    assert.equal(normalizarNumero(entrada), salida);
  });
}

test('la Ñ no se confunde con la N (revisión #2)', () => {
  assert.equal(normalizarNumero('183 Ñ'), '183 ñ');
  assert.equal(normalizarNumero('183 N'), '183 n');
  assert.equal(normalizarNumero('152 quáter Ñ'), '152 quater ñ');
});
