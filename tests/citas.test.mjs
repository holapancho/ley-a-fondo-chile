import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { abrirIndice } from '../skills/ley-a-fondo-chile/scripts/lib/indice.mjs';
import { parseNorma } from '../skills/ley-a-fondo-chile/scripts/lib/parser.mjs';
import { verificarCitas } from '../skills/ley-a-fondo-chile/scripts/lib/citas.mjs';
import { leerFixture } from './helpers/fixtures.mjs';

let dir, idx, link4, link1;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'citas-'));
  idx = abrirIndice(path.join(dir, 'i.db'), path.join(dir, 'n'));
  idx.guardarNorma(parseNorma(leerFixture('ley-20000.xml')), { rol: 'principal', fechaObtencion: '2026-10-25' });
  link4 = idx.articulo(235507, '4').link;
  link1 = idx.articulo(235507, '1').link;
});
after(() => { idx.cerrar(); rmSync(dir, { recursive: true, force: true }); });

test('respuesta válida', () => {
  const md = `## Resumen\n\nQuien porte «pequeñas cantidades de sustancias o drogas estupefacientes» comete microtráfico ([Ley 20.000, art. 4](${link4})).\n\nOtra idea sin literal ([Ley 20.000, art. 1](${link1})).`;
  const r = verificarCitas(md, idx);
  assert.deepEqual(r.errores, []);
  assert.equal(r.ok, true);
  assert.equal(r.citas, 2);
  assert.equal(r.literales, 1);
});

test('idParte inventado', () => {
  const r = verificarCitas('Algo ([Ley 20.000, art. 4](https://www.bcn.cl/leychile/navegar?idNorma=235507&idParte=1)).', idx);
  assert.equal(r.ok, false);
  assert.equal(r.errores[0].tipo, 'parte-inexistente');
});

test('literal alterado en una palabra', () => {
  const r = verificarCitas(`«grandes cantidades de sustancias o drogas estupefacientes» ([Ley 20.000, art. 4](${link4}))`, idx);
  assert.equal(r.errores[0].tipo, 'literal-no-coincide');
});

test('literal sin cita en el mismo párrafo', () => {
  const r = verificarCitas(`«pequeñas cantidades»\n\nOtro párrafo ([art. 4](${link4}))`, idx);
  assert.equal(r.errores[0].tipo, 'literal-sin-cita');
});

test('espacios, saltos de línea, blockquote y elisión con … no importan', () => {
  const md = `> «pequeñas   cantidades\n> de sustancias … productoras de dependencia física o síquica»\n> ([Ley 20.000, art. 4](${link4}))`;
  assert.equal(verificarCitas(md, idx).ok, true);
});

test('las notas al margen de BCN dentro del texto no rompen un literal correcto', () => {
  idx.guardarNorma(parseNorma(leerFixture('codigo-civil.xml')), { rol: 'principal', fechaObtencion: '2026-10-25', nombreComun: 'Código Civil' });
  const link = idx.articulo(172986, '1437', { cuerpo: 'Código Civil' }).link;
  const md = `Nacen «ya de un hecho voluntario de la persona que se obliga, como en la aceptación de una herencia o legado» ([Código Civil, art. 1437](${link})).`;
  assert.deepEqual(verificarCitas(md, idx).errores, []);
  const malo = `«de un hecho voluntario de la persona que se obliga L. 19.585 como»  ([Código Civil, art. 1437](${link}))`;
  assert.equal(verificarCitas(malo, idx).ok, false);
});

test('respuesta sin citas no es válida', () => {
  const r = verificarCitas('La ley dice cosas.', idx);
  assert.equal(r.ok, false);
  assert.equal(r.errores[0].tipo, 'sin-citas');
});

test('la etiqueta debe corresponder a la norma y al artículo del link (revisión #6)', () => {
  const r = verificarCitas(`Dice «pequeñas cantidades» ([Código Penal, art. 3](${link4})).`, idx);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.tipo === 'etiqueta-no-coincide'), JSON.stringify(r.errores));
  const otroArticulo = verificarCitas(`Dice «pequeñas cantidades» ([Ley 20.000, art. 5](${link4})).`, idx);
  assert.ok(otroArticulo.errores.some((e) => e.tipo === 'etiqueta-no-coincide'));
  assert.equal(verificarCitas(`Dice «pequeñas cantidades» ([ley 20.000, ART. 4º](${link4})).`, idx).ok, true);
});

test('un literal no puede citarse a un contenedor (título, párrafo) (revisión #6)', () => {
  const titulo = idx.articulo(235507, '4').partes[0].idPadre;
  const link = `https://www.bcn.cl/leychile/navegar?idNorma=235507&idParte=${titulo}`;
  const r = verificarCitas(`«pequeñas cantidades» ([Ley 20.000, párrafo 1º](${link})).`, idx);
  assert.ok(r.errores.some((e) => e.tipo === 'literal-en-contenedor'), JSON.stringify(r.errores));
});
