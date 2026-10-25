// Verifica las citas de una respuesta contra el índice local.
// Cita: [texto](https://www.bcn.cl/leychile/navegar?idNorma=N&idParte=P)
// Cita literal: «…» seguida, en el mismo párrafo, de una cita. "…" dentro del literal marca una elisión.

import { nombreDeParte, esCitable } from './nombres.mjs';

const RE_LINK =/\[([^\]]+)\]\((https?:\/\/(?:www\.)?bcn\.cl\/leychile\/navegar\?idNorma=(\d+)&(?:amp;)?idParte=(\d+))\)/g;
const RE_LITERAL = /«([^»]+)»/g;

const normalizar = (s) => s
  .replace(/[“”„"]/g, '"').replace(/[‘’']/g, "'")
  .replace(/\s+/g, ' ').trim().toLowerCase();

// BCN deja notas al margen ("L. 19.585", "Art. 1º, Nº 112") al final de la línea, separadas por muchos espacios.
const sinNotasAlMargen = (texto) => texto.split('\n').map((l) => l.replace(/(\S)[ \t]{4,}\S.*$/, '$1')).join('\n');

const comparable = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[º°ª]/g, '').replace(/\s+/g, ' ');
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');

// La etiqueta del link debe nombrar la misma norma (o cuerpo legal) y el mismo artículo al que apunta el link.
function etiquetaCoincide(etiqueta, norma, parte) {
  const e = comparable(etiqueta);
  if (!e.includes(comparable(nombreDeParte(norma, parte)))) return false;
  if (!parte.tipo.startsWith('Art') || norma.tipo === 'Mensaje' || !parte.numero) return true;
  return new RegExp(`\\bart(?:iculo|\\.)?\\s*${escapar(comparable(parte.numero))}(?![a-z0-9ñ])`).test(e);
}

function contieneEnOrden(texto, literal) {
  let desde = 0;
  for (const tramo of literal.split(/…|\.\.\./).map((t) => normalizar(t)).filter(Boolean)) {
    const i = texto.indexOf(tramo, desde);
    if (i === -1) return false;
    desde = i + tramo.length;
  }
  return true;
}

export function verificarCitas(markdown, indice) {
  const errores = [];
  let citas = 0, literales = 0;
  const textos = new Map();
  const textoDe = (idNorma, idParte) => {
    const k = `${idNorma}:${idParte}`;
    if (!textos.has(k)) textos.set(k, normalizar(sinNotasAlMargen(indice.textoParteCompleto(idNorma, idParte))));
    return textos.get(k);
  };

  const limpio = markdown.split('\n').map((l) => l.replace(/^\s*>\s?/, '')).join('\n');
  for (const parrafo of limpio.split(/\n\s*\n/)) {
    const links = [...parrafo.matchAll(RE_LINK)].map((m) => ({
      etiqueta: m[1], url: m[2], idNorma: Number(m[3]), idParte: Number(m[4]), pos: m.index,
    }));
    for (const l of links) {
      citas++;
      const parte = indice.parte(l.idNorma, l.idParte);
      const norma = parte && indice.norma(l.idNorma);
      if (!parte) errores.push({ tipo: 'parte-inexistente', detalle: `${l.etiqueta} → ${l.url}` });
      else {
        if (parte.derogado && !/derogad/i.test(l.etiqueta)) {
          errores.push({ tipo: 'parte-derogada', detalle: `${l.etiqueta} cita una parte derogada sin decirlo` });
        }
        if (!etiquetaCoincide(l.etiqueta, norma, parte)) {
          errores.push({ tipo: 'etiqueta-no-coincide', detalle: `"${l.etiqueta}" no corresponde a lo que apunta el link (${nombreDeParte(norma, parte)}${parte.numeroOficial ? `, ${parte.numeroOficial}` : ''})` });
        }
      }
      l.existe = Boolean(parte);
      l.citable = Boolean(parte) && esCitable(parte);
    }
    for (const m of parrafo.matchAll(RE_LITERAL)) {
      literales++;
      const fin = m.index + m[0].length;
      const cita = links.find((l) => l.pos >= fin);
      const corto = m[1].length > 80 ? `${m[1].slice(0, 77)}...` : m[1];
      if (!cita) { errores.push({ tipo: 'literal-sin-cita', detalle: `«${corto}»` }); continue; }
      if (!cita.existe) continue;
      if (!cita.citable) { errores.push({ tipo: 'literal-en-contenedor', detalle: `«${corto}» se cita a ${cita.etiqueta}, que es un título o párrafo; cita el artículo` }); continue; }
      if (!contieneEnOrden(textoDe(cita.idNorma, cita.idParte), m[1])) {
        errores.push({ tipo: 'literal-no-coincide', detalle: `«${corto}» no aparece en ${cita.etiqueta}` });
      }
    }
  }
  if (!citas) errores.push({ tipo: 'sin-citas', detalle: 'La respuesta no tiene ninguna cita a BCN.' });
  return { ok: errores.length === 0, citas, literales, errores };
}
