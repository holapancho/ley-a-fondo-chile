import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraerReferencias, extraerNormasMencionadas } from '../skills/ley-a-fondo-chile/scripts/lib/referencias.mjs';

const CASOS = [
  ['las penas establecidas en el artículo 1º', [{ numero: '1', ley: null }]],
  ['los artículos 15 y 16 de esta ley', [{ numero: '15', ley: null }, { numero: '16', ley: null }]],
  ['inciso segundo del artículo 4', [{ numero: '4', ley: null }]],
  ['el artículo 66 bis', [{ numero: '66 bis', ley: null }]],
  ['el artículo 5° de la ley N° 20.000', [{ numero: '5', ley: '20000' }]],
  ['los artículos 1º, 2º y 3º', [{ numero: '1', ley: null }, { numero: '2', ley: null }, { numero: '3', ley: null }]],
  ['el artículo 18 quáter y el artículo 18 quáter', [{ numero: '18 quater', ley: null }]],
  ['Artículo 4º.- El que, sin la competente autorización', []],
  ['la facultad contemplada en el artículo 398 del Código Procesal Penal', []],
  ['en el artículo 107, de la LIR', []],
  ['el artículo 43 del decreto con fuerza de ley N° 251', []],
  ['sin remisiones aquí', []],
];

for (const [texto, esperado] of CASOS) {
  test(`extraerReferencias: ${texto}`, () => assert.deepEqual(extraerReferencias(texto), esperado));
}

const MENCIONES = [
  ['instrucciones para lo dispuesto en el artículo 57 bis, Letra A, Nº10 y en el artículo 107, de la LIR.',
    [{ ref: '6368', etiqueta: 'Ley sobre Impuesto a la Renta (DL 824)', articulos: ['57 bis', '107'] }]],
  ['lo establecido en el reglamento de la ley N° 20.000 que sanciona el tráfico',
    [{ ref: 'ley 20000', etiqueta: 'Ley 20.000', articulos: [] }]],
  ['el artículo 5° de la ley N° 20.000', [{ ref: 'ley 20000', etiqueta: 'Ley 20.000', articulos: ['5'] }]],
  ['la facultad contemplada en el artículo 398 del Código Procesal Penal.',
    [{ ref: 'codigo procesal penal', etiqueta: 'Código Procesal Penal', articulos: ['398'] }]],
  ['regirán los artículos 49 a 49 sexies del Código Penal',
    [{ ref: 'codigo penal', etiqueta: 'Código Penal', articulos: ['49', '49 sexies'] }]],
  ['conforme al decreto ley N° 3.500, de 1980, que establece',
    [{ ref: 'decreto ley 3500 1980', etiqueta: 'Decreto Ley 3.500 de 1980', articulos: [] }]],
  ['el decreto con fuerza de ley N° 1, de 2002, del Ministerio del Trabajo',
    [{ ref: 'dfl 1 2002', etiqueta: 'DFL 1 de 2002', articulos: [] }]],
  ['Sustituye la Ley Nº 19.366. Además, el artículo 2 de la ley 19.913 y la ley N° 19.366',
    [{ ref: 'ley 19366', etiqueta: 'Ley 19.366', articulos: [] }, { ref: 'ley 19913', etiqueta: 'Ley 19.913', articulos: ['2'] }]],
  ['según el presente código y esta ley', []],
  ['Artículo 20.- En los delitos contemplados en esta ley no procederá la atenuante contenida en el número 7 del artículo 11 del Código Penal.',
    [{ ref: 'codigo penal', etiqueta: 'Código Penal', articulos: ['11'] }]],
];

for (const [texto, esperado] of MENCIONES) {
  test(`extraerNormasMencionadas: ${texto.slice(0, 60)}`, () => assert.deepEqual(extraerNormasMencionadas(texto), esperado));
}
