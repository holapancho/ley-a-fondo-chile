// Descarga desde BCN los fixtures usados por los tests.
// Uso: node tests/fixtures/descargar.mjs [--todos]
// Sin --todos solo baja los que faltan.
import { existsSync, writeFileSync } from 'node:fs';
import { fixture } from '../helpers/fixtures.mjs';

const UA = 'ley-a-fondo-chile/0.1 (+https://github.com/holapancho/ley-a-fondo-chile)';
const OBTXML = 'https://www.leychile.cl/Consulta/obtxml';
const NUEVO = 'https://nuevo.leychile.cl/servicios';

const FIXTURES = {
  'ley-20000.xml': `${OBTXML}?opt=7&idNorma=235507`,
  'ley-16744.xml': `${OBTXML}?opt=7&idNorma=28650`,
  'decreto-199-2026.xml': `${OBTXML}?opt=7&idNorma=1228941`,
  'decreto-867-2007.xml': `${OBTXML}?opt=7&idNorma=269323`,
  'codigo-civil.xml': `${OBTXML}?opt=7&idNorma=172986`,
  'codigo-trabajo.xml': `${OBTXML}?opt=7&idNorma=207436`,
  'codigo-penal.xml': `${OBTXML}?opt=7&idNorma=1984`,
  'mensaje-codigo-civil.xml': `${OBTXML}?opt=7&idNorma=1080094`,
  'ley-20190.xml': `${OBTXML}?opt=7&idNorma=261427`,
  'busqueda-16744.xml': `${OBTXML}?opt=61&cadena=16744&cantidad=50`,
  'busqueda-20000.xml': `${OBTXML}?opt=61&cadena=20000&cantidad=50`,
  'busqueda-decreto-867.xml': `${OBTXML}?opt=61&cadena=decreto%20867&cantidad=100`,
  'codigos.json': `${NUEVO}/Consulta/getCodigos`,
  'vinculaciones-16744.json': `${NUEVO}/Vinculaciones/get_vinculaciones?idNorma=28650&npagina=1&itemsporpagina=50&sentidoVinculacion=reglamentada_por&clase_vinculacion=reglamento`,
  'vinculaciones-20000.json': `${NUEVO}/Vinculaciones/get_vinculaciones?idNorma=235507&npagina=1&itemsporpagina=50&sentidoVinculacion=reglamentada_por&clase_vinculacion=reglamento`,
  'norma-json-28650.json': `${NUEVO}/Navegar/get_norma_json?idNorma=28650`,
  'norma-json-172986.json': `${NUEVO}/Navegar/get_norma_json?idNorma=172986`,
  'norma-json-1984.json': `${NUEVO}/Navegar/get_norma_json?idNorma=1984`,
  'api-leychile-v1.yaml': 'https://www.bcn.cl/leychile/leychile-api-doc/assets/leychile-api-doc-v1.yaml',
};

const todos = process.argv.includes('--todos');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

let primero = true;
for (const [nombre, url] of Object.entries(FIXTURES)) {
  if (!todos && existsSync(fixture(nombre))) continue;
  if (!primero) await dormir(1000);
  primero = false;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${nombre}: HTTP ${res.status} en ${url}`);
  const cuerpo = Buffer.from(await res.arrayBuffer());
  writeFileSync(fixture(nombre), cuerpo);
  console.log(`${nombre}: ${cuerpo.length} bytes`);
}
