// Parser XML mínimo, suficiente para el esquema de intercambio de normas de Ley Chile.
// No valida; tolera lo que BCN entrega. Recorre el texto una sola vez.

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodificar(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENTIDADES[e] ?? m;
  });
}

const RE_ATTR = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

function leerAttrs(s) {
  const attrs = {};
  for (const m of s.matchAll(RE_ATTR)) attrs[m[1]] = decodificar(m[3] ?? m[4]);
  return attrs;
}

export function parseXml(texto) {
  const raiz = { nombre: '#documento', attrs: {}, hijos: [], texto: '' };
  const pila = [raiz];
  let i = 0;
  const n = texto.length;
  while (i < n) {
    const lt = texto.indexOf('<', i);
    const finTexto = lt === -1 ? n : lt;
    if (finTexto > i) pila[pila.length - 1].texto += decodificar(texto.slice(i, finTexto));
    if (lt === -1) break;
    if (texto.startsWith('<!--', lt)) {
      const fin = texto.indexOf('-->', lt + 4);
      i = fin === -1 ? n : fin + 3;
    } else if (texto.startsWith('<![CDATA[', lt)) {
      const fin = texto.indexOf(']]>', lt + 9);
      pila[pila.length - 1].texto += texto.slice(lt + 9, fin === -1 ? n : fin);
      i = fin === -1 ? n : fin + 3;
    } else if (texto[lt + 1] === '?' || texto[lt + 1] === '!') {
      const fin = texto.indexOf('>', lt);
      i = fin === -1 ? n : fin + 1;
    } else if (texto[lt + 1] === '/') {
      const fin = texto.indexOf('>', lt);
      if (pila.length > 1) pila.pop();
      i = fin === -1 ? n : fin + 1;
    } else {
      const fin = buscarFinEtiqueta(texto, lt);
      let cuerpo = texto.slice(lt + 1, fin);
      const autocierre = cuerpo.endsWith('/');
      if (autocierre) cuerpo = cuerpo.slice(0, -1);
      const esp = cuerpo.search(/\s/);
      const nombre = esp === -1 ? cuerpo : cuerpo.slice(0, esp);
      const nodo = { nombre, attrs: esp === -1 ? {} : leerAttrs(cuerpo.slice(esp)), hijos: [], texto: '' };
      pila[pila.length - 1].hijos.push(nodo);
      if (!autocierre) pila.push(nodo);
      i = fin + 1;
    }
  }
  return raiz.hijos[0] ?? raiz;
}

// Busca el '>' que cierra la etiqueta, ignorando los que van dentro de valores de atributo.
function buscarFinEtiqueta(texto, desde) {
  let comilla = null;
  for (let j = desde + 1; j < texto.length; j++) {
    const c = texto[j];
    if (comilla) { if (c === comilla) comilla = null; }
    else if (c === '"' || c === "'") comilla = c;
    else if (c === '>') return j;
  }
  return texto.length;
}

export const hijo = (n, nombre) => n?.hijos.find((h) => h.nombre === nombre);
export const hijos = (n, nombre) => (n ? n.hijos.filter((h) => h.nombre === nombre) : []);
export const textoDe = (n, nombre) => hijo(n, nombre)?.texto ?? '';
