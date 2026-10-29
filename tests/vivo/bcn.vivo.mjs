// Pruebas contra Ley Chile – BCN real. No corren con `npm test`: usan internet y los endpoints
// no documentados de BCN, que pueden cambiar. Uso: npm run test:vivo
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearCliente } from '../../skills/ley-a-fondo-chile/scripts/lib/http.mjs';
import { crearFuentes, BASES } from '../../skills/ley-a-fondo-chile/scripts/lib/fuentes.mjs';
import { parseNorma } from '../../skills/ley-a-fondo-chile/scripts/lib/parser.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'ley-a-fondo-chile', 'scripts', 'ley-a-fondo.mjs');
const cliente = crearCliente({ pausaMs: 1000 });
const fuentes = crearFuentes(cliente);
let home;

function run(...args) {
  return new Promise((ok) => {
    const hijo = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, LEY_A_FONDO_HOME: home } });
    let stdout = '', stderr = '';
    hijo.stdout.on('data', (d) => { stdout += d; });
    hijo.stderr.on('data', (d) => { stderr += d; });
    hijo.on('close', (status) => ok({ status, stdout, stderr }));
  });
}

before(() => { home = path.join(mkdtempSync(path.join(tmpdir(), 'vivo-')), '.ley-a-fondo-chile'); });
after(() => rmSync(path.dirname(home), { recursive: true, force: true }));

test('búsqueda (opt=61) encuentra la Ley 16.744', async () => {
  const r = await fuentes.buscar('16744');
  assert.ok(r.some((n) => n.idNorma === 28650), JSON.stringify(r.slice(0, 5)));
});

test('XML de la norma (opt=7) se parsea y trae el art. 5 de la Ley 16.744', async () => {
  const n = parseNorma(await fuentes.xmlNorma(28650));
  assert.equal(n.idNorma, 28650);
  const a5 = n.partes.find((p) => p.tipo === 'Artículo' && p.numero === '5' && p.fragmento === 0);
  assert.ok(a5, 'no está el art. 5');
  assert.match(a5.texto, /trayecto directo/);
});

test('vinculaciones: la Ley 20.000 sigue reglamentada por el Decreto 867', async () => {
  const r = await fuentes.reglamentos(235507);
  assert.ok(r.some((x) => x.idNorma === 269323), `reglamentos: ${r.map((x) => x.idNorma).join(', ')}`);
});

test('getCodigos responde la lista de códigos (sin usar la copia local)', async () => {
  const lista = await cliente.json(`${BASES.nuevo}/Consulta/getCodigos`);
  assert.ok(Array.isArray(lista) && lista.length >= 15, `recibí ${lista?.length}`);
  assert.ok(lista.some((c) => Number(c.idNorma) === 172986 && Number(c.idParte) > 0), 'falta el Código Civil');
});

test('get_norma_json responde metadatos de vigencia', async () => {
  const m = await fuentes.metadatos(28650);
  assert.ok('inicioVigencia' in m);
});

test('de punta a punta: cargar, articulo y verificar-citas con el CLI', async () => {
  const c = await run('cargar', 'ley 16744');
  assert.equal(c.status, 0, c.stdout + c.stderr);
  const a = await run('articulo', 'ley 16744', '5', '--json');
  assert.equal(a.status, 0, a.stdout + a.stderr);
  const art = JSON.parse(a.stdout);
  assert.match(art.link, /idNorma=28650&idParte=\d+/);
  assert.match(art.partes.map((p) => p.texto).join('\n'), /trayecto directo/);
  const md = path.join(path.dirname(home), 'respuesta.md');
  writeFileSync(md, `Cubre los accidentes «ocurridos en el trayecto directo» ([Ley 16.744, art. 5](${art.link})).`);
  const v = await run('verificar-citas', md);
  assert.equal(v.status, 0, v.stdout + v.stderr);
});
