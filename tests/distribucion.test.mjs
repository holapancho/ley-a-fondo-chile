import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => readFileSync(path.join(RAIZ, r), 'utf8');
const leerJson = (r) => JSON.parse(leer(r));

test('la versión coincide en package.json y CHANGELOG', () => {
  const { version } = leerJson('package.json');
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.match(leer('CHANGELOG.md'), new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm'));
});

const PAGINAS = [
  { ruta: 'sitio/index.html', aviso: /no (es|son) (una )?interpretación oficial/i },
  { ruta: 'sitio/en/index.html', aviso: /not an official interpretation/i },
];

for (const { ruta, aviso } of PAGINAS) {
  test(`${ruta} enlaza solo archivos que existen`, () => {
    const html = leer(ruta);
    const carpeta = path.dirname(path.join(RAIZ, ruta));
    const locales = [...html.matchAll(/(?:href|src)="(?!https?:|#|mailto:)([^"#]+)/g)].map((m) => m[1]);
    for (const r of locales) assert.ok(existsSync(path.join(carpeta, r)), `${ruta}: no existe ${r}`);
    assert.match(html, aviso);
    assert.match(html, /releases\/latest\/download\/ley-a-fondo-chile\.zip/);
  });
}
