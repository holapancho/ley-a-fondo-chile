// Cómo se nombra una norma o una parte de ella en las citas.

const conMiles = (n) => (/^\d{4,}$/.test(n) ? n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : n);

export function nombreNorma(norma) {
  if (norma.nombreComun) return norma.nombreComun;
  if (norma.tipo === 'Ley') return `Ley ${conMiles(norma.numero)}`;
  if (norma.tipo === 'Mensaje') return `Mensaje del ${norma.numero}`;
  const anio = norma.fechaPublicacion?.slice(0, 4);
  return `${norma.tipo} ${conMiles(norma.numero)}${anio ? ` de ${anio}` : ''}`;
}

// Un cuerpo "art. 14" es una ley sin nombre propio contenida en ese artículo de la norma (doble articulado).
export const cuerpoSinNombre = (cuerpo) => Boolean(cuerpo?.startsWith('art. '));

// Nombre con que se cita una parte. En una norma que contiene cuerpos legales (el DFL 1 que contiene el Código Civil),
// los artículos propios de la norma se citan con su nombre técnico y no con el del código.
export function nombreDeParte(norma, parte) {
  if (parte.cuerpo && !cuerpoSinNombre(parte.cuerpo)) return parte.cuerpo;
  if (!parte.cuerpo && norma.conCuerpos) return nombreNorma({ ...norma, nombreComun: null });
  return nombreNorma(norma);
}

// Nombre del cuerpo legal para --cuerpo: el cuerpo explícito o el nombre de la parte.
export const etiquetaCuerpo = (norma, parte) => parte.cuerpo ?? nombreDeParte(norma, parte);

// Partes que pueden llevar una cita textual (las demás son contenedores: títulos, párrafos, libros…).
export const esCitable = (parte) => parte.tipo.startsWith('Art') || parte.tipo === 'Anexo' || parte.tipo === 'Encabezado';
