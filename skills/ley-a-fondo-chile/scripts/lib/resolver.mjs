// Traduce lo que escribe el usuario ("ley 20.000", "código civil", "decreto 867 2008", un link) a un idNorma.

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PALABRAS_VACIAS = new Set(['codigo', 'de', 'del', 'la', 'el', 'los', 'las']);
const claveCodigo = (s) => sinTildes(s).split(/\s+/).filter((p) => p && !PALABRAS_VACIAS.has(p)).join(' ');

const TIPOS = [
  [/^(decreto con fuerza de ley|d\.?f\.?l\.?)$/, 'Decreto con Fuerza de Ley'],
  [/^(decreto ley|d\.?l\.?)$/, 'Decreto Ley'],
  [/^(decreto|dto\.?|ds|d\.s\.)$/, 'Decreto'],
  [/^ley$/, 'Ley'],
];
const RE_TIPADA = /^(decreto con fuerza de ley|decreto ley|decreto|d\.?f\.?l\.?|d\.?l\.?|dto\.?|d\.s\.|ds|ley)\s+(?:n[°ºo]?\.?\s*)?([\d.]+)(?:\s+(\d{4}))?(?:\s+(.+))?$/;

// Igual que resolverReferencia, pero solo entre normas ya cargadas en el índice (sin red).
// normas: [{ idNorma, nombre, tipo, numero, fechaPublicacion, nombreComun }]
export function resolverLocal(entrada, normas) {
  const texto = entrada.trim();
  const unico = (lista) => (lista.length === 1 ? { tipo: 'unico', idNorma: lista[0].idNorma }
    : lista.length ? { tipo: 'ambiguo', candidatos: lista } : { tipo: 'no-encontrado', entrada });
  const id = texto.match(/[?&]idNorma=(\d+)/i)?.[1] ?? (/^\d+$/.test(texto) ? texto : null);
  if (id) return unico(normas.filter((n) => n.idNorma === Number(id)));
  const normal = sinTildes(texto).replace(/\s+/g, ' ');
  if (normal.startsWith('codigo ')) {
    const buscado = claveCodigo(normal);
    return unico(normas.filter((n) => n.nombreComun && claveCodigo(n.nombreComun) === buscado));
  }
  const m = normal.match(RE_TIPADA);
  if (m) {
    const tipo = TIPOS.find(([re]) => re.test(m[1]))[1];
    const numero = m[2].replace(/\./g, '');
    return unico(normas.filter((n) => n.tipo === tipo && n.numero === numero
      && (!m[3] || n.fechaPublicacion?.startsWith(m[3]))));
  }
  return unico(normas.filter((n) => sinTildes(n.nombre) === normal));
}

const datosCodigo = (c) => ({ tipo: 'unico', idNorma: c.idNorma, nombreComun: c.titulo, idParteInicio: c.idParte,
  ...(c.idNormaMensaje ? { idNormaMensaje: c.idNormaMensaje } : {}) });

// Un código pedido por su idNorma o link debe citarse igual que si se pidiera por nombre.
async function porId(idNorma, fuentes) {
  const codigo = (await fuentes.codigos()).find((c) => c.idNorma === idNorma);
  return codigo ? datosCodigo(codigo) : { tipo: 'unico', idNorma };
}

export async function resolverReferencia(entrada, fuentes) {
  const texto = entrada.trim();
  const idEnLink = texto.match(/[?&]idNorma=(\d+)/i);
  if (idEnLink) return porId(Number(idEnLink[1]), fuentes);
  if (/^\d+$/.test(texto)) return porId(Number(texto), fuentes);

  const normal = sinTildes(texto).replace(/\s+/g, ' ');
  if (normal.startsWith('codigo ')) {
    const buscado = claveCodigo(normal);
    const codigos = await fuentes.codigos();
    let hallado = codigos.filter((c) => claveCodigo(c.titulo) === buscado);
    if (!hallado.length) {
      const palabras = buscado.split(' ');
      hallado = codigos.filter((c) => palabras.every((p) => claveCodigo(c.titulo).split(' ').includes(p)));
    }
    if (hallado.length !== 1) return { tipo: 'no-encontrado', entrada };
    return datosCodigo(hallado[0]);
  }

  const m = normal.match(RE_TIPADA);
  if (!m) return { tipo: 'no-encontrado', entrada };
  const tipo = TIPOS.find(([re]) => re.test(m[1]))[1];
  const numero = m[2].replace(/\./g, '');
  const anio = m[3];
  const resto = m[4];
  const resultados = await fuentes.buscar(resto ? `${numero} ${resto}` : numero, 100);
  let candidatos = resultados.filter((r) => r.tipo === tipo && r.numero === numero);
  if (anio) {
    const delAnio = candidatos.filter((c) => c.fechaPublicacion?.startsWith(anio));
    if (delAnio.length) candidatos = delAnio;
  }
  candidatos.sort((a, b) => (b.fechaPublicacion ?? '').localeCompare(a.fechaPublicacion ?? ''));
  if (!candidatos.length) return { tipo: 'no-encontrado', entrada };
  if (candidatos.length === 1) return { tipo: 'unico', idNorma: candidatos[0].idNorma };
  return { tipo: 'ambiguo', candidatos };
}
