import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml, hijo, hijos, textoDe } from '../skills/ley-a-fondo-chile/scripts/lib/xml.mjs';
import { leerFixture } from './helpers/fixtures.mjs';

test('decodifica entidades y atributos de la Ley 20.000', () => {
  const r = parseXml(leerFixture('ley-20000.xml'));
  assert.equal(r.nombre, 'Norma');
  assert.equal(r.attrs.normaId, '235507');
  assert.match(textoDe(hijo(r, 'Metadatos'), 'TituloNorma'), /SUSTITUYE LA LEY Nº 19\.366/);
});

test('entidades numéricas, hex y nombradas', () => {
  const r = parseXml('<a x="&quot;y&quot;">&#237;&#xF3;&amp;&lt;&gt;&apos;</a>');
  assert.equal(r.attrs.x, '"y"');
  assert.equal(r.texto, 'íó&<>\'');
});

test('CDATA, comentarios, declaración y autocierre', () => {
  const r = parseXml('<?xml version="1.0"?><!-- c --><a><b/><c><![CDATA[<x>&amp;]]></c></a>');
  assert.equal(hijos(r, 'b').length, 1);
  assert.equal(textoDe(r, 'c'), '<x>&amp;');
  assert.equal(textoDe(r, 'nada'), '');
});

test('conserva prefijos de namespace', () => {
  const r = parseXml('<a><aem:Archivo xmlns:aem="u"><aem:Nombre>f.jpeg</aem:Nombre></aem:Archivo></a>');
  assert.equal(textoDe(hijo(r, 'aem:Archivo'), 'aem:Nombre'), 'f.jpeg');
});

test('xml de 2,9 MB en menos de 2 s', () => {
  const t = leerFixture('codigo-civil.xml');
  const inicio = performance.now();
  const r = parseXml(t);
  assert.equal(r.attrs.normaId, '172986');
  assert.ok(performance.now() - inicio < 2000);
});
