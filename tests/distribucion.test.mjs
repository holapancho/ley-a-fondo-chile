import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => readFileSync(path.join(RAIZ, r), 'utf8');
const leerJson = (r) => JSON.parse(leer(r));

// El plugin es solo la carpeta de la skill: el directorio de plugins revisa todo lo que contiene.
const PLUGIN = 'skills/ley-a-fondo-chile';
const MANIFIESTO = `${PLUGIN}/.claude-plugin/plugin.json`;

test('la versión coincide en package.json, plugin.json y CHANGELOG', () => {
  const { version } = leerJson('package.json');
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(leerJson(MANIFIESTO).version, version);
  assert.match(leer('CHANGELOG.md'), new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm'));
});

test('el marketplace publica la carpeta de la skill con el mismo nombre', () => {
  const m = leerJson('.claude-plugin/marketplace.json');
  const p = leerJson(MANIFIESTO);
  assert.equal(m.plugins.length, 1);
  assert.equal(m.plugins[0].name, p.name);
  assert.equal(m.plugins[0].source, `./${PLUGIN}`);
  assert.equal(path.basename(PLUGIN), p.name);
  assert.ok(existsSync(path.join(RAIZ, PLUGIN, 'SKILL.md')));
});

test('el ícono del plugin existe', () => {
  const icono = leerJson(MANIFIESTO).icon;
  assert.ok(icono && existsSync(path.join(RAIZ, PLUGIN, icono)), `no existe ${icono}`);
});

test('el plugin no tiene archivos que el directorio no alcance a revisar', () => {
  const archivos = readdirSync(path.join(RAIZ, PLUGIN), { recursive: true })
    .map((r) => path.join(RAIZ, PLUGIN, r)).filter((f) => statSync(f).isFile());
  for (const f of archivos) {
    assert.ok(statSync(f).size <= 256 * 1024, `${path.relative(RAIZ, f)} pesa más de 256 KiB`);
  }
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
