import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iniciarServidor } from './helpers/servidor-bcn.mjs';
import { rutasBase, XML } from './helpers/rutas.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'ley-a-fondo-chile', 'scripts', 'ley-a-fondo.mjs');
let srv, home;

function run(...args) {
  return new Promise((ok) => {
    const hijo = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, LEY_A_FONDO_HOME: home, LEY_A_FONDO_PAUSA_MS: '0',
        LEY_A_FONDO_BASE_PUBLICA: srv.base, LEY_A_FONDO_BASE_NUEVO: `${srv.base}/servicios` },
    });
    let stdout = '', stderr = '';
    hijo.stdout.on('data', (d) => { stdout += d; });
    hijo.stderr.on('data', (d) => { stderr += d; });
    hijo.on('close', (status) => ok({ status, stdout, stderr }));
  });
}

before(async () => {
  srv = await iniciarServidor({ ...rutasBase(), [XML(666)]: () => ({ status: 200, body: '<!doctype html><html></html>' }) });
  home = path.join(mkdtempSync(path.join(tmpdir(), 'cli-')), 'José Pérez ñandú', '.ley-a-fondo-chile');
});
after(() => srv.cerrar());

test('cargar, buscar y artículo de punta a punta (home con espacios y ñ)', async () => {
  const c = await run('cargar', 'ley', '20000');
  assert.equal(c.status, 0, c.stderr);
  assert.match(c.stdout, /\[1\/10\] Ley 20\.000…/);
  assert.ok(existsSync(path.join(home, 'indice.db')));
  const b = await run('buscar', 'pequeñas cantidades');
  assert.equal(b.status, 0, b.stderr);
  assert.match(b.stdout, /Ley 20\.000, art\. 4/);
  const a = await run('articulo', 'ley 20000', '4');
  assert.equal(a.status, 0, a.stderr);
  assert.match(a.stdout, /navegar\?idNorma=235507&idParte=\d+/);
  assert.match(a.stdout, /pequeñas cantidades/);
});

test('cargar informa las normas mencionadas que no cargó', async () => {
  const c = await run('cargar', 'ley', '20000');
  assert.match(c.stdout, /menciona otras normas que NO se cargaron/i);
  assert.match(c.stdout, /Código Penal/);
});

test('articulo muestra las normas mencionadas y cómo cargarlas', async () => {
  const a = await run('articulo', 'ley 20000', '20');
  assert.equal(a.status, 0, a.stderr);
  assert.match(a.stdout, /Menciona otras normas:/);
  assert.match(a.stdout, /Código Penal \(art\. 11\) — no cargada/);
  assert.match(a.stdout, /cargar "codigo penal"/);
});

test('buscar filtrado por norma cargada', async () => {
  const b = await run('buscar', 'reglamento', '--norma', 'ley 20000');
  assert.equal(b.status, 0, b.stderr);
  assert.doesNotMatch(b.stdout, /Decreto/);
});

test('--norma con una norma no cargada sale con 1 y lo explica', async () => {
  const b = await run('buscar', 'accidente', '--norma', 'ley 16744');
  assert.equal(b.status, 1);
  assert.match(b.stdout, /no está cargada/);
});

test('stderr no tiene ExperimentalWarning', async () => {
  const e = await run('estado');
  assert.equal(e.status, 0);
  assert.doesNotMatch(e.stderr, /ExperimentalWarning/);
  assert.match(e.stdout, /sin API key/);
  assert.match(e.stdout, /José Pérez ñandú/);
});

test('referencia ambigua sale con 2 y lista candidatos', async () => {
  const r = await run('cargar', 'decreto', '867');
  assert.equal(r.status, 2);
  assert.match(r.stdout, /269323/);
});

test('no encontrado sale con 1 y sugiere el link', async () => {
  const r = await run('cargar', 'la', 'ley', 'de', 'drogas');
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /link|idNorma/i);
});

test('error de BCN sale con 1 sin traza', async () => {
  const r = await run('cargar', '666');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /BCN/);
  assert.doesNotMatch(r.stderr, /at .*\.mjs/);
});

test('--json entrega JSON válido', async () => {
  const r = await run('listar', '--json');
  assert.equal(r.status, 0, r.stderr);
  const lista = JSON.parse(r.stdout);
  assert.ok(lista.some((n) => n.idNorma === 235507));
});

test('artículo ambiguo entre cuerpos y --cuerpo', async () => {
  assert.equal((await run('cargar', 'código', 'civil')).status, 0);
  const amb = await run('articulo', 'codigo civil', '1');
  assert.equal(amb.status, 2);
  assert.match(amb.stdout, /--cuerpo/);
  const ok = await run('articulo', 'codigo civil', '1437', '--cuerpo', 'Código Civil');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Código Civil, art\. 1437/);
});

test('sección e idParte', async () => {
  const a = JSON.parse((await run('articulo', 'ley 20000', '4', '--json')).stdout);
  const s = await run('seccion', String(a.partes[0].idParte));
  assert.equal(s.status, 0, s.stderr);
  assert.match(s.stdout, /Artículo 3/);
});

test('reindexar --todas', async () => {
  const r = await run('reindexar', '--todas');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /sin cambios/);
});

test('comando desconocido muestra ayuda y sale con 1', async () => {
  const r = await run('volar');
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /Uso:/);
});

test('verificar-citas: válido sale 0, inválido sale 4', async () => {
  const a = JSON.parse((await run('articulo', 'ley 20000', '4', '--json')).stdout);
  const dir = mkdtempSync(path.join(tmpdir(), 'citas-'));
  const bueno = path.join(dir, 'bueno.md');
  writeFileSync(bueno, `La ley sanciona a quien porte «pequeñas cantidades de sustancias» ([Ley 20.000, art. 4](${a.link})).`);
  assert.equal((await run('verificar-citas', bueno)).status, 0);
  const malo = path.join(dir, 'malo.md');
  writeFileSync(malo, `Dice «grandes cantidades de sustancias» ([Ley 20.000, art. 4](${a.link})).`);
  const r = await run('verificar-citas', malo);
  assert.equal(r.status, 4);
  assert.match(r.stdout, /literal-no-coincide/);
});
