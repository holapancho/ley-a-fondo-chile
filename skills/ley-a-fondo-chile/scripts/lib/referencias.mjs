// Detecta remisiones a otros artículos ("las penas del artículo 1º") y menciones a otras normas
// ("artículo 107 de la LIR", "ley N° 20.000", "Código Procesal Penal").
import { normalizarNumero } from './numeros.mjs';

const LATIN = '(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies)';
const NUM = `\\d+(?:\\s*[º°])?(?:\\s+${LATIN})?`;
const LISTA = `${NUM}(?:\\s*(?:,|\\by\\b|\\be\\b|\\ba\\b)\\s*${NUM})*`;
const RE_REF = new RegExp(`art[íi]culos?\\s+(${LISTA})`, 'gi');
const RE_LEY = /^\s*,?\s*de la ley\s+(?:n[°ºo]\.?\s*)?(\d[\d.]*\d|\d)/i;
// "Artículo 4º.-" al inicio de un artículo es su encabezado, no una remisión.
const RE_ENCABEZADO = /^\s*\.?\s*-/;
// Remisión a un artículo de otra norma que no es "ley N° X": va a las menciones, no a las remisiones internas.
const RE_OTRA_NORMA = /^\s*,?\s*(?:de\s+la|del|de)\s+(?:c[óo]digo\s|decreto\b|d\.?\s?f\.?\s?l\b|LIR\b|constituci[óo]n)/i;

const separar = (lista) => lista.split(/\s*(?:,|\by\b|\be\b|\ba\b)\s*/i).filter((p) => p.trim()).map(normalizarNumero);

export function extraerReferencias(texto) {
  const vistos = new Set();
  const salida = [];
  for (const m of texto.matchAll(RE_REF)) {
    const despues = texto.slice(m.index + m[0].length);
    if (RE_ENCABEZADO.test(despues) || RE_OTRA_NORMA.test(despues)) continue;
    const ley = despues.match(RE_LEY)?.[1].replace(/\./g, '') ?? null;
    for (const numero of separar(m[1])) {
      const clave = `${numero}|${ley}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push({ numero, ley });
    }
  }
  return salida;
}

// Siglas de normas que no se pueden deducir del texto. Cada idNorma está verificado en Ley Chile.
export const SIGLAS = {
  LIR: { idNorma: 6368, etiqueta: 'Ley sobre Impuesto a la Renta (DL 824)' },
};

const CODIGOS = ['Civil', 'Penal', 'del Trabajo', 'de Comercio', 'Tributario', 'Procesal Penal', 'de Procedimiento Civil',
  'de Procedimiento Penal', 'Orgánico de Tribunales', 'de Aguas', 'de Minería', 'Aeronáutico', 'Sanitario',
  'de Justicia Militar', 'de Derecho Internacional Privado'];
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const conMiles = (n) => (/^\d{4,}$/.test(n) ? n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : n);
const NUMERO_NORMA = '(?:n(?:[°ºo]|\\.os)?\\.?\\s*)?(\\d[\\d.]*\\d|\\d)';
const ANIO = '(?:,?\\s+de\\s+(\\d{4}))?';
const RE_MENCION = new RegExp([
  `(?:decreto con fuerza de ley|d\\.\\s?f\\.\\s?l\\.|dfl)\\s+${NUMERO_NORMA}${ANIO}`,
  `(?:decreto ley|d\\.\\s?l\\.)\\s+${NUMERO_NORMA}${ANIO}`,
  `\\bley\\s+${NUMERO_NORMA}`,
  `c[óo]digo\\s+(${CODIGOS.map((c) => c.replace(/[áéíóú]/g, '.')).join('|')})\\b`,
  `\\b(${Object.keys(SIGLAS).join('|')})\\b`,
].map((p) => `(${p})`).join('|'), 'gi');

function identificar(m) {
  const g = m.slice(1);
  if (g[0]) { const n = g[1].replace(/\./g, ''); return { ref: `dfl ${n}${g[2] ? ` ${g[2]}` : ''}`, etiqueta: `DFL ${conMiles(n)}${g[2] ? ` de ${g[2]}` : ''}` }; }
  if (g[3]) { const n = g[4].replace(/\./g, ''); return { ref: `decreto ley ${n}${g[5] ? ` ${g[5]}` : ''}`, etiqueta: `Decreto Ley ${conMiles(n)}${g[5] ? ` de ${g[5]}` : ''}` }; }
  if (g[6]) {
    const n = g[7].replace(/\./g, '');
    return n.length >= 3 ? { ref: `ley ${n}`, etiqueta: `Ley ${conMiles(n)}` } : null;
  }
  if (g[8]) {
    const nombre = CODIGOS.find((c) => sinTildes(c) === sinTildes(g[9]));
    return { ref: `codigo ${sinTildes(nombre)}`, etiqueta: `Código ${nombre}` };
  }
  if (g[10]) {
    const s = SIGLAS[g[11].toUpperCase()];
    if (!s || g[11] !== g[11].toUpperCase()) return null;
    return { ref: String(s.idNorma), etiqueta: s.etiqueta };
  }
  return null;
}

// Fin de oración o punto y coma: los artículos mencionados antes no pertenecen a esta mención.
const ULTIMO_CORTE = /(?:;|\.\s+(?=[A-ZÁÉÍÓÚÑ]))(?![\s\S]*(?:;|\.\s+[A-ZÁÉÍÓÚÑ]))/;

export function extraerNormasMencionadas(texto) {
  const porRef = new Map();
  let finAnterior = 0;
  for (const m of texto.matchAll(RE_MENCION)) {
    const id = identificar(m);
    const inicioVentana = Math.max(finAnterior, m.index - 200);
    finAnterior = m.index + m[0].length;
    if (!id) continue;
    let ventana = texto.slice(inicioVentana, m.index);
    const corte = ventana.search(ULTIMO_CORTE);
    if (corte !== -1) ventana = ventana.slice(corte + 1);
    const articulos = [...ventana.matchAll(RE_REF)]
      .filter((a) => !RE_ENCABEZADO.test(ventana.slice(a.index + a[0].length)))
      .flatMap((a) => separar(a[1]));
    if (!porRef.has(id.ref)) porRef.set(id.ref, { ...id, articulos: [] });
    const actual = porRef.get(id.ref);
    for (const a of articulos) if (!actual.articulos.includes(a)) actual.articulos.push(a);
  }
  return [...porRef.values()];
}
