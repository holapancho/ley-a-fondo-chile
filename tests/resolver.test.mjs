import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearCliente } from '../skills/ley-a-fondo-chile/scripts/lib/http.mjs';
import { crearFuentes } from '../skills/ley-a-fondo-chile/scripts/lib/fuentes.mjs';
import { resolverReferencia } from '../skills/ley-a-fondo-chile/scripts/lib/resolver.mjs';
import { iniciarServidor } from './helpers/servidor-bcn.mjs';

let srv, fuentes;
const r = (entrada) => resolverReferencia(entrada, fuentes);

before(async () => {
  srv = await iniciarServidor({
    '/Consulta/obtxml?opt=61&cadena=16744': 'busqueda-16744.xml',
    '/Consulta/obtxml?opt=61&cadena=20000': 'busqueda-20000.xml',
    '/Consulta/obtxml?opt=61&cadena=867': 'busqueda-decreto-867.xml',
    '/Consulta/obtxml?opt=61&cadena=99999999': "<?xml version='1.0'?><Normas total='0'></Normas>",
    '/servicios/Consulta/getCodigos': 'codigos.json',
  });
  fuentes = crearFuentes(crearCliente({ pausaMs: 0 }), { bases: { publica: srv.base, nuevo: `${srv.base}/servicios` } });
});
after(() => srv.cerrar());

test('ley 16.744 → 28650', async () => assert.deepEqual(await r('ley 16.744'), { tipo: 'unico', idNorma: 28650 }));
test('Ley 20000 → 235507', async () => assert.deepEqual(await r('Ley 20000'), { tipo: 'unico', idNorma: 235507 }));

test('Código del Trabajo → 207436', async () => {
  const x = await r('Código del Trabajo');
  assert.equal(x.idNorma, 207436);
  assert.equal(x.nombreComun, 'Código del Trabajo');
});

test('codigo civil (sin tilde) trae inicio y mensaje', async () => {
  const x = await r('codigo civil');
  assert.deepEqual(x, { tipo: 'unico', idNorma: 172986, nombreComun: 'Código Civil', idParteInicio: 8717776, idNormaMensaje: 1080094 });
});

test('código procesal penal no se confunde con el de procedimiento penal', async () => {
  assert.equal((await r('codigo procesal penal')).idNorma, 176595);
  assert.equal((await r('código de procedimiento penal')).idNorma, 22960);
});

test('código inexistente', async () => assert.equal((await r('código de la galaxia')).tipo, 'no-encontrado'));

test('decreto 867 sin año → ambiguo, ordenado por fecha descendente', async () => {
  const x = await r('decreto 867');
  assert.equal(x.tipo, 'ambiguo');
  assert.ok(x.candidatos.length > 10);
  assert.ok(x.candidatos.every((c) => c.tipo === 'Decreto' && c.numero === '867'));
  const fechas = x.candidatos.map((c) => c.fechaPublicacion);
  assert.deepEqual(fechas, [...fechas].sort().reverse());
});

test('decreto 867 2008 → incluye el reglamento de la 20.000', async () => {
  const x = await r('decreto 867 2008');
  const ids = x.tipo === 'unico' ? [x.idNorma] : x.candidatos.map((c) => c.idNorma);
  assert.ok(ids.includes(269323));
  assert.ok(x.tipo === 'unico' || x.candidatos.every((c) => c.fechaPublicacion.startsWith('2008')));
});

test('link de BCN', async () => {
  assert.deepEqual(await r('https://www.bcn.cl/leychile/navegar?idNorma=1228941&idParte=0'), { tipo: 'unico', idNorma: 1228941 });
});

test('idNorma solo', async () => assert.deepEqual(await r('235507'), { tipo: 'unico', idNorma: 235507 }));
test('ley inexistente', async () => assert.equal((await r('ley 99999999')).tipo, 'no-encontrado'));
test('texto que no entiende', async () => assert.equal((await r('la ley de drogas')).tipo, 'no-encontrado'));

test('un código pedido por idNorma o link conserva su nombre (revisión #3)', async () => {
  const x = await r('207436');
  assert.equal(x.nombreComun, 'Código del Trabajo');
  const y = await r('https://www.bcn.cl/leychile/navegar?idNorma=172986&idParte=8717776');
  assert.equal(y.nombreComun, 'Código Civil');
  assert.equal(y.idNormaMensaje, 1080094);
});
