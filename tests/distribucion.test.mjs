import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => readFileSync(path.join(RAIZ, r), 'utf8');
const leerJson = (r) => JSON.parse(leer(r));

test('la versión coincide en package.json, plugin.json y CHANGELOG', () => {
  const { version } = leerJson('package.json');
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(leerJson('.claude-plugin/plugin.json').version, version);
  assert.match(leer('CHANGELOG.md'), new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm'));
});

test('el marketplace publica la skill con el mismo nombre', () => {
  const m = leerJson('.claude-plugin/marketplace.json');
  const p = leerJson('.claude-plugin/plugin.json');
  assert.equal(m.plugins.length, 1);
  assert.equal(m.plugins[0].name, p.name);
  assert.equal(m.plugins[0].source, './');
  assert.ok(existsSync(path.join(RAIZ, 'skills', p.name, 'SKILL.md')));
});

test('el ícono del plugin existe', () => {
  const icono = leerJson('.claude-plugin/plugin.json').icon;
  assert.ok(icono && existsSync(path.join(RAIZ, icono)), `no existe ${icono}`);
});

test('la página enlaza solo archivos que existen', () => {
  const html = leer('docs/index.html');
  const locales = [...html.matchAll(/(?:href|src)="(?!https?:|#|mailto:)([^"]+)"/g)].map((m) => m[1]);
  for (const r of locales) assert.ok(existsSync(path.join(RAIZ, 'docs', r)), `no existe docs/${r}`);
  assert.match(html, /no (es|son) (una )?interpretación oficial/i);
  assert.match(html, /releases\/latest\/download\/ley-a-fondo-chile\.zip/);
});
