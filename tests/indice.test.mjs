import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { abrirIndice } from '../skills/ley-a-fondo-chile/scripts/lib/indice.mjs';
import { parseNorma } from '../skills/ley-a-fondo-chile/scripts/lib/parser.mjs';
import { leerFixture } from './helpers/fixtures.mjs';

const HOY = '2026-10-25';
let dir, idx;
const ley20000 = parseNorma(leerFixture('ley-20000.xml'));

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'indice-'));
  idx = abrirIndice(path.join(dir, 'indice.db'), path.join(dir, 'normas'));
  idx.guardarNorma(ley20000, { rol: 'principal', fechaObtencion: HOY });
  idx.guardarNorma(parseNorma(leerFixture('ley-16744.xml')), { rol: 'principal', fechaObtencion: HOY });
  idx.guardarNorma(parseNorma(leerFixture('codigo-civil.xml')),
    { rol: 'principal', fechaObtencion: HOY, nombreComun: 'Código Civil', fechaVersionReal: '2025-08-28' });
  idx.guardarNorma(parseNorma(leerFixture('decreto-199-2026.xml')), { rol: 'principal', fechaObtencion: HOY });
});
after(() => { idx.cerrar(); rmSync(dir, { recursive: true, force: true }); });

test('buscar encuentra el microtráfico en la Ley 20.000', () => {
  const r = idx.buscar('pequeñas cantidades porte', { idNormas: [235507] });
  assert.equal(r[0].idNorma, 235507);
  assert.ok(r.some((x) => x.citaSugerida.startsWith('Ley 20.000, art. 4')));
  assert.ok(r.every((x) => x.extracto.length > 0));
});

test('buscar no revienta con sintaxis FTS5 inválida', () => {
  for (const q of ['"18-quater', 'art. 4°', '(cultivo', 'a AND', '***', 'NEAR(', '']) {
    assert.doesNotThrow(() => idx.buscar(q), q);
  }
});

test('sin tildes encuentra con tildes', () => {
  const r = idx.buscar('habitacion trayecto', { idNormas: [28650] });
  assert.ok(r.some((x) => x.citaSugerida.startsWith('Ley 16.744, art. 5')));
});

test('derogados ocultos por defecto', () => {
  const todos = idx.buscar('derogado OR artículo', { limite: 5000, derogados: true });
  const visibles = idx.buscar('derogado OR artículo', { limite: 5000 });
  assert.ok(visibles.length <= todos.length);
  assert.ok(visibles.every((x) => !x.citaSugerida.includes('[DEROGADO]')));
});

test('artículo del Código Civil con doble articulado', () => {
  const d = idx.articulo(172986, '1437', { cuerpo: 'código civil' });
  assert.ok(d.citaSugerida.startsWith('Código Civil, art. 1437'), d.citaSugerida);
  assert.match(d.citaSugerida, /versión de la norma 2025-08-28/);
  assert.equal(d.link, `https://www.bcn.cl/leychile/navegar?idNorma=172986&idParte=${d.partes[0].idParte}`);
});

test('doble articulado sin nombre: la cita nombra el artículo contenedor', () => {
  idx.guardarNorma(parseNorma(leerFixture('ley-20190.xml')), { rol: 'principal', fechaObtencion: HOY });
  const d = idx.articulo(261427, '1', { cuerpo: 'art. 14' });
  assert.ok(d.citaSugerida.startsWith('Ley 20.190, art. 1 del art. 14 ('), d.citaSugerida);
  assert.match(d.partes[0].texto, /prenda sin\s+desplazamiento/);
  const amb = idx.articulo(261427, '1');
  assert.ok(amb.ambiguo.includes('art. 14') && amb.ambiguo.includes('Ley 20.190'), JSON.stringify(amb));
  const r = idx.buscar('"prenda sin desplazamiento" garantía tenencia', { idNormas: [261427] });
  assert.ok(r.some((x) => x.citaSugerida.startsWith('Ley 20.190, art. 1 del art. 14')));
  const dentro = r.filter((x) => x.ruta.startsWith('Artículo 14'));
  assert.ok(dentro.length > 0);
  assert.ok(dentro.every((x) => x.citaSugerida.includes(' del art. 14 (')), JSON.stringify(dentro.map((x) => x.citaSugerida)));
});

test('artículo ambiguo entre cuerpos legales', () => {
  const r = idx.articulo(172986, '1');
  assert.ok(Array.isArray(r.ambiguo) && r.ambiguo.length > 1);
});

test('artículo inexistente → null', () => assert.equal(idx.articulo(235507, '9999'), null));

test('artículos transitorios se piden explícitamente', () => {
  const permanente = idx.articulo(235507, '4');
  assert.match(permanente.partes[0].texto, /pequeñas cantidades/);
  const transitorio = idx.articulo(235507, '4 transitorio');
  assert.match(transitorio.partes[0].texto, /Bienes Nacionales/);
  assert.match(transitorio.citaSugerida, /^Ley 20\.000, art\. 4 transitorio/);
});

test('remisiones: el art. 3 de la 20.000 cita el 1 y el 1 es citado por el 3', () => {
  assert.ok(idx.articulo(235507, '3').cita.includes('1'));
  assert.ok(idx.articulo(235507, '1').citadoPor.some((c) => c.idNorma === 235507 && c.numero === '3'));
});

test('artículos de otras normas no cuentan como remisiones internas (revisión #1)', () => {
  assert.ok(!idx.articulo(235507, '20').cita.includes('11'));
  const a5 = idx.articulo(235507, '5').cita;
  assert.ok(!a5.includes('63') && !a5.includes('74'), JSON.stringify(a5));
  assert.ok(!idx.articulo(235507, '63').citadoPor.some((c) => c.idNorma === 235507 && c.numero === '5'));
});

test('menciones a otras normas por artículo y resumen por norma', () => {
  const m20 = idx.articulo(235507, '20').menciones;
  assert.ok(m20.some((m) => m.ref === 'codigo penal' && m.articulos.includes('11')), JSON.stringify(m20));
  assert.ok(!idx.articulo(235507, '4').menciones.some((m) => m.ref === 'ley 20000'), 'no se menciona a sí misma');
  const resumen = idx.resumenMenciones(235507);
  assert.ok(resumen.some((m) => m.ref === 'codigo penal' && m.veces >= 2));
  assert.ok(!resumen.some((m) => m.ref === 'ley 20000' || m.ref === '235507'));
  assert.deepEqual(Object.keys(resumen[0]).sort(), ['etiqueta', 'ref', 'veces']);
});

test('imágenes del anexo quedan en disco y se informan', () => {
  const anexo = idx.buscar('Fortalecer gobernanza', { idNormas: [1228941] })[0];
  assert.match(anexo.citaSugerida, /Anexo/);
  const imgs = idx.imagenesDe(1228941, anexo.idParte);
  assert.equal(imgs.length, 5);
  assert.ok(imgs.every((r) => existsSync(r)));
});

test('sección devuelve el párrafo completo del artículo', () => {
  const a4 = idx.articulo(235507, '4');
  const s = idx.seccion(a4.partes[0].idParte);
  assert.ok(s.partes.some((p) => p.numero === '3'));
  assert.ok(s.partes.some((p) => p.numero === '4'));
});

test('textoParteCompleto concatena fragmentos', () => {
  const a4 = idx.articulo(235507, '4');
  assert.match(idx.textoParteCompleto(235507, a4.partes[0].idParte), /pequeñas cantidades/);
});

test('reglamentos vinculados a un artículo y huérfanos', () => {
  const d867 = parseNorma(leerFixture('decreto-867-2007.xml'));
  idx.guardarNorma(d867, { rol: 'reglamento', fechaObtencion: HOY });
  const a63 = idx.articulo(235507, '63');
  idx.vincular(235507, 269323, 'reglamento', [{ idParte: a63.partes[0].idParte, descripcion: 'Artículo 63' }]);
  assert.ok(idx.articulo(235507, '63').reglamentos.some((r) => r.idNorma === 269323));
  assert.ok(idx.listar().find((n) => n.idNorma === 269323).de.includes(235507));
  idx.desvincular(235507, 269323);
  assert.deepEqual(idx.eliminarHuerfanas(), [269323]);
  assert.equal(idx.norma(269323), null);
});

test('el rol no baja', () => {
  const cp = parseNorma(leerFixture('codigo-penal.xml'));
  idx.guardarNorma(cp, { rol: 'principal', fechaObtencion: HOY, nombreComun: 'Código Penal' });
  idx.guardarNorma(cp, { rol: 'dependencia', fechaObtencion: HOY, nombreComun: 'Código Penal' });
  assert.equal(idx.listar().find((n) => n.idNorma === 1984).rol, 'principal');
});

test('reemplazo informa artículos cambiados y no duplica', () => {
  const antes = idx.buscar('pequeñas cantidades', { idNormas: [235507], limite: 100 }).length;
  const copia = structuredClone(ley20000);
  const a4 = copia.partes.find((p) => p.numero === '4' && p.fragmento === 0);
  a4.texto += ' TEXTO MODIFICADO';
  const r = idx.guardarNorma(copia, { rol: 'principal', fechaObtencion: HOY });
  assert.deepEqual(r.cambiados, [a4.numeroOficial]);
  assert.equal(idx.buscar('pequeñas cantidades', { idNormas: [235507], limite: 100 }).length, antes);
  assert.deepEqual(idx.guardarNorma(copia, { rol: 'principal', fechaObtencion: HOY }).cambiados, []);
});

test('norma derogada se marca en la cita sugerida', () => {
  const xml = `<?xml version="1.0"?><Norma normaId="9" fechaVersion="2000-01-01" derogado="derogado" esTratado="no tratado">
<Identificador fechaPublicacion="1999-01-01"><TiposNumeros><TipoNumero><Tipo>Ley</Tipo><Numero>9</Numero></TipoNumero></TiposNumeros></Identificador>
<Metadatos><TituloNorma>PRUEBA DEROGADA</TituloNorma></Metadatos><EstructurasFuncionales>
<EstructuraFuncional tipoParte="Artículo" fechaVersion="2000-01-01" derogado="no derogado" transitorio="no transitorio" idParte="77"><Texto>Artículo 1.- Zanahoria.</Texto><Metadatos><NombreParte presente="si">1</NombreParte></Metadatos></EstructuraFuncional>
</EstructurasFuncionales></Norma>`;
  idx.guardarNorma(parseNorma(xml), { rol: 'principal', fechaObtencion: HOY });
  assert.match(idx.articulo(9, '1').citaSugerida, /\[NORMA DEROGADA\]$/);
  assert.equal(idx.listar().find((n) => n.idNorma === 9).derogada, true);
});

test('cita sin fechas usa la fecha de obtención', () => {
  const n = parseNorma(leerFixture('ley-20000.xml'));
  n.idNorma = 8; n.fechaVersion = null;
  for (const p of n.partes) p.fechaVersion = null;
  idx.guardarNorma(n, { rol: 'principal', fechaObtencion: HOY });
  assert.match(idx.articulo(8, '4').citaSugerida, /\(fecha de versión no disponible; obtenido 2026-10-25\)/);
});

const xmlConImagenes = (nombre1, nombre2) => `<?xml version="1.0"?><Norma normaId="77" fechaVersion="2020-01-01" derogado="no derogado" esTratado="no tratado">
<Identificador fechaPublicacion="2020-01-01"><TiposNumeros><TipoNumero><Tipo>Ley</Tipo><Numero>77777</Numero></TipoNumero></TiposNumeros></Identificador>
<Metadatos><TituloNorma>PRUEBA IMAGENES</TituloNorma></Metadatos><EstructurasFuncionales>
<EstructuraFuncional tipoParte="Artículo" fechaVersion="2020-01-01" derogado="no derogado" transitorio="no transitorio" idParte="7701"><Texto>Artículo 1.- Tabla uno.<aem:ArchivoBinario><aem:Nombre>${nombre1}</aem:Nombre><aem:TipoContenido>image/jpeg</aem:TipoContenido><aem:DataCodificada>${Buffer.from('UNO').toString('base64')}</aem:DataCodificada></aem:ArchivoBinario></Texto><Metadatos><NombreParte presente="si">1</NombreParte></Metadatos></EstructuraFuncional>
<EstructuraFuncional tipoParte="Artículo" fechaVersion="2020-01-01" derogado="no derogado" transitorio="no transitorio" idParte="7702"><Texto>Artículo 2.- Tabla dos.<aem:ArchivoBinario><aem:Nombre>${nombre2}</aem:Nombre><aem:TipoContenido>image/jpeg</aem:TipoContenido><aem:DataCodificada>${Buffer.from('DOS').toString('base64')}</aem:DataCodificada></aem:ArchivoBinario></Texto><Metadatos><NombreParte presente="si">2</NombreParte></Metadatos></EstructuraFuncional>
</EstructurasFuncionales></Norma>`;

test('imágenes con el mismo nombre en artículos distintos no se pisan (revisión #5)', async () => {
  const { readFileSync } = await import('node:fs');
  idx.guardarNorma(parseNorma(xmlConImagenes('tabla.jpg', 'tabla.jpg')), { rol: 'principal', fechaObtencion: HOY });
  const [i1] = idx.articulo(77, '1').imagenes;
  const [i2] = idx.articulo(77, '2').imagenes;
  assert.notEqual(i1, i2);
  assert.equal(readFileSync(i1, 'utf8'), 'UNO');
  assert.equal(readFileSync(i2, 'utf8'), 'DOS');
});

test('nombres de imagen inválidos en Windows no rompen la carga (revisión #5)', () => {
  assert.doesNotThrow(() => idx.guardarNorma(parseNorma(xmlConImagenes('a?b:c*.jpg', '..')), { rol: 'principal', fechaObtencion: HOY }));
  assert.ok(existsSync(idx.articulo(77, '1').imagenes[0]));
  assert.ok(existsSync(idx.articulo(77, '2').imagenes[0]));
});

test('artículos repetidos en el mismo cuerpo se distinguen por idParte (revisión #2)', () => {
  const xml = xmlConImagenes('x.jpg', 'y.jpg').replace('normaId="77"', 'normaId="78"').replace('<NombreParte presente="si">2<', '<NombreParte presente="si">1<');
  idx.guardarNorma(parseNorma(xml), { rol: 'principal', fechaObtencion: HOY });
  const r = idx.articulo(78, '1');
  assert.equal(r.ambiguo.length, 2);
  assert.ok(r.ambiguo.every((a) => /idParte 770[12]/.test(a)), JSON.stringify(r));
});

test('buscar relanza errores que no son de sintaxis (revisión #7)', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const otro = new DatabaseSync(path.join(dir, 'indice.db'));
  assert.equal(otro.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
  otro.close();
  const aparte = abrirIndice(path.join(dir, 'cerrado.db'), path.join(dir, 'n2'));
  aparte.cerrar();
  assert.throws(() => aparte.buscar('trayecto'));
});

test('en el Código Civil, --cuerpo "Código Civil" distingue su art. 1 del art. 1 del DFL', () => {
  const d = idx.articulo(172986, '1', { cuerpo: 'Código Civil' });
  assert.ok(!d.ambiguo, JSON.stringify(d));
  assert.ok(d.citaSugerida.startsWith('Código Civil, art. 1 ('), d.citaSugerida);
  const amb = idx.articulo(172986, '1').ambiguo;
  assert.ok(amb.includes('Decreto con Fuerza de Ley 1 de 2000') && amb.includes('Código Civil'), JSON.stringify(amb));
});
