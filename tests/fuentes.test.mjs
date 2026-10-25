import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearCliente, ErrorBcn } from '../skills/ley-a-fondo-chile/scripts/lib/http.mjs';
import { crearFuentes } from '../skills/ley-a-fondo-chile/scripts/lib/fuentes.mjs';
import { iniciarServidor } from './helpers/servidor-bcn.mjs';

let srv, fuentes, cliente;
let intentos500 = 0;

before(async () => {
  srv = await iniciarServidor({
    '/Consulta/obtxml?opt=61&cadena=16744': 'busqueda-16744.xml',
    '/Consulta/obtxml?opt=7&idNorma=235507': 'ley-20000.xml',
    '/Consulta/obtxml?opt=7&idNorma=666': () => ({ status: 200, body: '<!doctype html><html>Este sitio fue movido</html>' }),
    '/Consulta/obtxml?opt=7&idNorma=500': () => { intentos500++; return { status: 500, body: 'error' }; },
    '/servicios/Vinculaciones/get_vinculaciones?idNorma=28650&sentidoVinculacion=reglamentada_por&clase_vinculacion=reglamento': 'vinculaciones-16744.json',
    '/servicios/Consulta/getCodigos': 'codigos.json',
    '/servicios/Navegar/get_norma_json?idNorma=172986': 'norma-json-172986.json',
  });
  cliente = crearCliente({ pausaMs: 0 });
  fuentes = crearFuentes(cliente, { bases: { publica: srv.base, nuevo: `${srv.base}/servicios` } });
});
after(() => srv.cerrar());

test('buscar 16744 devuelve la ley primero', async () => {
  const r = await fuentes.buscar('16744');
  assert.equal(r[0].idNorma, 28650);
  assert.equal(r[0].tipo, 'Ley');
  assert.equal(r[0].numero, '16744');
  assert.equal(r[0].fechaPublicacion, '1968-02-01');
  assert.match(r[0].titulo, /ACCIDENTES DEL TRABAJO/);
});

test('xmlNorma devuelve el XML', async () => {
  assert.match(await fuentes.xmlNorma(235507), /normaId="235507"/);
});

test('reglamentos de la 16.744 agrupa el Decreto 67 de 2000 con dos partes', async () => {
  const r = await fuentes.reglamentos(28650);
  const ids = r.map((x) => x.idNorma);
  assert.equal(new Set(ids).size, ids.length);
  const conDos = r.filter((x) => x.partes.length === 2);
  assert.ok(conDos.some((x) => x.nombre === 'Decreto 67' && x.partes.every((p) => /Artículo 1[56]/.test(p.descripcion))));
});

test('códigos oficiales', async () => {
  const c = await fuentes.codigos();
  assert.equal(c.length, 15);
  assert.deepEqual(c.find((x) => x.titulo === 'Código Civil'), { idNorma: 172986, idParte: 8717776, idNormaMensaje: 1080094, titulo: 'Código Civil' });
});

test('metadatos entrega el inicio de vigencia real', async () => {
  assert.deepEqual(await fuentes.metadatos(172986), { inicioVigencia: '2025-08-28' });
});

test('HTML en vez de XML → ErrorBcn con la URL', async () => {
  await assert.rejects(fuentes.xmlNorma(666), (e) => e instanceof ErrorBcn && e.url.includes('idNorma=666'));
});

test('500 reintenta una vez y luego ErrorBcn', async () => {
  await assert.rejects(fuentes.xmlNorma(500), (e) => e instanceof ErrorBcn && e.status === 500);
  assert.equal(intentos500, 2);
});

test('la pausa se respeta entre solicitudes', async () => {
  const esperas = [];
  let reloj = 0;
  const c = crearCliente({ pausaMs: 1000, ahora: () => reloj, dormir: async (ms) => { esperas.push(ms); reloj += ms; } });
  await c.texto(`${srv.base}/servicios/Consulta/getCodigos`);
  await c.texto(`${srv.base}/servicios/Consulta/getCodigos`);
  assert.deepEqual(esperas, [1000]);
  assert.equal(c.solicitudesHechas, 2);
});

test('envía el User-Agent de la skill', async () => {
  let ua;
  srv.poner('/ua', (req) => { ua = req.headers['user-agent']; return { status: 200, body: 'ok' }; });
  await cliente.texto(`${srv.base}/ua`);
  assert.match(ua, /^ley-a-fondo-chile\//);
});

test('vínculos de reglamento sin idNorma se ignoran', async () => {
  srv.poner('/servicios/Vinculaciones/get_vinculaciones?idNorma=1&sentidoVinculacion=reglamentada_por&clase_vinculacion=reglamento',
    JSON.stringify({ cantidadAciertos: '2', aciertos: [
      { IDNORMA: '', NORMA: 'Decreto 2223', idParteActual: '', parteActual: 'Norma' },
      { IDNORMA: '55', NORMA: 'Decreto 55', idParteActual: '', parteActual: 'Norma', FECHA_PUBLICACION: '01-ENE-2020' }] }));
  const r = await fuentes.reglamentos(1);
  assert.deepEqual(r.map((x) => x.idNorma), [55]);
});
