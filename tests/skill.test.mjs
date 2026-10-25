import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'ley-a-fondo-chile');
const skill = () => readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');

function frontmatter(texto) {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(m, 'SKILL.md debe empezar con frontmatter');
  return Object.fromEntries(m[1].split(/\r?\n/).filter((l) => /^\w[\w-]*:/.test(l))
    .map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim().replace(/^["']|["']$/g, '')]));
}

test('frontmatter válido según Agent Skills', () => {
  const fm = frontmatter(skill());
  assert.equal(fm.name, 'ley-a-fondo-chile');
  assert.equal(fm.name, path.basename(DIR));
  assert.match(fm.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(fm.description.length > 0 && fm.description.length <= 1024, `description: ${fm.description.length}`);
  assert.match(fm.description, /Ley Chile/);
  assert.match(fm.description, /decreto/i);
  assert.match(fm.description, /Chilean law/);
  assert.equal(fm.license, 'MIT');
  assert.ok(fm.compatibility && fm.compatibility.length <= 500);
  assert.match(fm.compatibility, /Node\.js 22\.13/);
});

test('SKILL.md tiene menos de 500 líneas', () => assert.ok(skill().split('\n').length < 500));

test('toda ruta relativa mencionada existe', () => {
  const textos = [skill(), readFileSync(path.join(DIR, 'references', 'formato-respuesta.md'), 'utf8')];
  const rutas = new Set(textos.flatMap((t) => [...t.matchAll(/\b((?:references|assets|scripts)\/[\w\-./]+\.\w+)/g)].map((m) => m[1])));
  assert.ok(rutas.size >= 3);
  for (const r of rutas) assert.ok(existsSync(path.join(DIR, r)), `no existe ${r}`);
});

test('assets/codigos.json tiene los 15 códigos', () => {
  const c = JSON.parse(readFileSync(path.join(DIR, 'assets', 'codigos.json'), 'utf8'));
  assert.equal(c.length, 15);
  assert.ok(c.some((x) => x.titulo === 'Código Civil' && x.idNorma === '172986'));
});

test('el formato de respuesta trae el cierre obligatorio', () => {
  const f = readFileSync(path.join(DIR, 'references', 'formato-respuesta.md'), 'utf8');
  assert.match(f, /no es una interpretación oficial de la Biblioteca del Congreso Nacional ni asesoría legal/);
  assert.match(f, /Fuente: Ley Chile – Biblioteca del Congreso Nacional/);
});
