import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNorma } from '../skills/ley-a-fondo-chile/scripts/lib/parser.mjs';
import { leerFixture } from './helpers/fixtures.mjs';

const principales = (n, tipo) => n.partes.filter((p) => p.tipo === tipo && p.fragmento === 0);

test('Ley 20.000: metadatos y artículos', () => {
  const n = parseNorma(leerFixture('ley-20000.xml'));
  assert.equal(n.idNorma, 235507);
  assert.equal(n.tipo, 'Ley');
  assert.equal(n.numero, '20000');
  assert.equal(n.fechaVersion, '2026-05-23');
  assert.equal(n.fechaVersionRelleno, false);
  assert.equal(n.derogada, false);
  assert.deepEqual(n.organismos, ['MINISTERIO DEL INTERIOR']);
  assert.equal(principales(n, 'Artículo').length, 83);
  assert.equal(principales(n, 'Artículo Transitorio').length, 1);
  const a4 = principales(n, 'Artículo').find((p) => p.numero === '4');
  assert.match(a4.texto, /pequeñas cantidades/);
  assert.match(a4.ruta, /TITULO I/i);
  assert.equal(n.partes.find((p) => p.idParte === 0).tipo, 'Encabezado');
});

test('Decreto 199/2026: anexo sin base64 y 5 imágenes', () => {
  const n = parseNorma(leerFixture('decreto-199-2026.xml'));
  assert.equal(n.esTratado, true);
  const anexo = n.partes.filter((p) => p.tipo === 'Anexo');
  assert.ok(anexo.length >= 1);
  assert.ok(anexo.every((p) => !/\/9j\/4AAQ/.test(p.texto) && p.texto.length <= 4000));
  assert.match(anexo[0].texto, /Fortalecer la gobernanza/);
  assert.equal(n.imagenes.length, 5);
  assert.equal(n.imagenes[0].nombre, 'tabla_bcn_2881550_001.jpeg');
  assert.equal(n.imagenes[0].tipoContenido, 'image/jpeg');
  assert.equal(n.imagenes[0].datos.subarray(0, 3).toString('hex'), 'ffd8ff');
});

test('Código Civil: fecha de relleno y doble articulado', () => {
  const n = parseNorma(leerFixture('codigo-civil.xml'));
  assert.equal(n.fechaVersion, null);
  assert.equal(n.fechaVersionRelleno, true);
  const a1437 = n.partes.filter((p) => p.numero === '1437' && p.cuerpo === 'Código Civil' && p.fragmento === 0);
  assert.equal(a1437.length, 1);
  assert.equal(a1437[0].numeroOficial, '1437');
  assert.match(a1437[0].texto, /Las obligaciones nacen/);
  assert.ok(n.partes.some((p) => p.cuerpo === 'Ley sobre Registro Civil'));
  assert.ok(n.partes.filter((p) => p.numero === '1' && p.tipo === 'Artículo').length > 1);
});

test('Ley 20.190: doble articulado sin nombre usa el artículo contenedor como cuerpo', () => {
  const n = parseNorma(leerFixture('ley-20190.xml'));
  const prenda = n.partes.find((p) => p.numero === '1' && p.cuerpo === 'art. 14' && p.fragmento === 0);
  assert.ok(prenda, 'el art. 1 de la ley de prenda debe tener cuerpo "art. 14"');
  assert.match(prenda.texto, /prenda sin\s+desplazamiento tiene por objeto/);
  assert.ok(n.partes.some((p) => p.cuerpo === 'art. 18'));
  const propio = n.partes.find((p) => p.numero === '1' && p.cuerpo === null && p.tipo === 'Artículo');
  assert.ok(propio, 'el art. 1 propio de la Ley 20.190 no tiene cuerpo');
});

test('Código del Trabajo: bis/ter y fecha por artículo', () => {
  const n = parseNorma(leerFixture('codigo-trabajo.xml'));
  const p = n.partes.find((x) => x.numero === '18 quater');
  assert.equal(p.numeroOficial, '18 QUÁTER');
  assert.equal(p.fechaVersion, '2020-10-06');
  assert.equal(n.partes.filter((x) => x.derogado && x.fragmento === 0).length, 5);
});

test('Código Penal: la tabla del art. 56 es una imagen dentro del artículo', () => {
  const n = parseNorma(leerFixture('codigo-penal.xml'));
  const a56 = n.partes.find((p) => p.numero === '56' && p.tipo === 'Artículo');
  const imgs = n.imagenes.filter((i) => i.idParte === a56.idParte);
  assert.equal(imgs.length, 1);
  assert.equal(imgs[0].nombre, 'Art56CP.jpeg');
  assert.ok(!/DataCodificada|\/9j\//.test(a56.texto));
});

test('textos largos se fragmentan en ≤ 4000 caracteres', () => {
  const n = parseNorma(leerFixture('mensaje-codigo-civil.xml'));
  assert.equal(n.tipo, 'Mensaje');
  assert.equal(n.numero, 'Código Civil');
  const frags = n.partes.filter((p) => p.tipo === 'Artículo');
  assert.ok(frags.length > 1);
  assert.ok(frags.every((p) => p.texto.length <= 4000));
  assert.deepEqual(frags.map((p) => p.fragmento), frags.map((_, i) => i));
});

test('norma derogada completa', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Norma normaId="1" fechaVersion="2000-01-01" derogado="derogado" esTratado="no tratado">
<Identificador fechaPublicacion="1999-01-01" fechaPromulgacion="1998-12-01"><TiposNumeros><TipoNumero><Tipo>Ley</Tipo><Numero>1</Numero></TipoNumero></TiposNumeros><Organismos><Organismo>X</Organismo></Organismos></Identificador>
<Metadatos><TituloNorma>PRUEBA</TituloNorma></Metadatos>
<EstructurasFuncionales><EstructuraFuncional tipoParte="Artículo" fechaVersion="2000-01-01" derogado="derogado" transitorio="no transitorio" idParte="5"><Texto>Artículo 1.- Texto.</Texto><Metadatos><NombreParte presente="si">1</NombreParte><TituloParte presente="no"> </TituloParte></Metadatos></EstructuraFuncional></EstructurasFuncionales></Norma>`;
  const n = parseNorma(xml);
  assert.equal(n.derogada, true);
  assert.equal(n.partes.find((p) => p.idParte === 5).derogado, true);
});
