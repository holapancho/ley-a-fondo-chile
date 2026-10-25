// Convierte el XML de una norma de Ley Chile (EsquemaIntercambioNorma v1.0) en partes indexables.
import { parseXml, hijo, hijos, textoDe } from './xml.mjs';
import { normalizarNumero } from './numeros.mjs';

export const MAX_FRAGMENTO = 4000;

const fechaValida = (f) => (f && /^\d{4}-\d{2}-\d{2}$/.test(f) && Number(f.slice(0, 4)) < 2100 ? f : null);
const limpiar = (s) => s.replace(/\s+/g, ' ').trim();
const SUFIJO_DOBLE = /\s*\(DEL ART\.?\s*[^)]*\)\s*$/i;

const MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'a', 'que', 'en', 'por', 'para', 'sobre', 'al', 'o']);
function tituloLegible(s) {
  return limpiar(s).toLowerCase().split(' ')
    .map((p, i) => (i > 0 && MENORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}
const parentesis = (s) => s.match(/\(([^)]+)\)\s*$/)?.[1];

export function fragmentar(texto, max = MAX_FRAGMENTO) {
  if (texto.length <= max) return [texto];
  const fragmentos = [];
  let actual = '';
  const empujar = () => { if (actual.trim()) fragmentos.push(actual.trim()); actual = ''; };
  for (const parrafo of texto.split(/\n\s*\n/)) {
    if (parrafo.length > max) {
      empujar();
      let resto = parrafo;
      while (resto.length > max) {
        let corte = resto.lastIndexOf(' ', max);
        if (corte <= 0) corte = max;
        fragmentos.push(resto.slice(0, corte).trim());
        resto = resto.slice(corte);
      }
      actual = resto;
    } else if (actual.length + parrafo.length + 2 > max) {
      empujar();
      actual = parrafo;
    } else {
      actual = actual ? `${actual}\n\n${parrafo}` : parrafo;
    }
  }
  empujar();
  return fragmentos;
}

export function parseNorma(xml) {
  const raiz = parseXml(xml);
  const ident = hijo(raiz, 'Identificador');
  const tipoNumero = hijo(hijo(ident, 'TiposNumeros'), 'TipoNumero');
  const fv = raiz.attrs.fechaVersion;
  const norma = {
    idNorma: Number(raiz.attrs.normaId),
    tipo: limpiar(textoDe(tipoNumero, 'Tipo')),
    numero: limpiar(textoDe(tipoNumero, 'Numero')),
    organismos: hijos(hijo(ident, 'Organismos'), 'Organismo').map((o) => limpiar(o.texto)),
    titulo: limpiar(textoDe(hijo(raiz, 'Metadatos'), 'TituloNorma')),
    fechaVersion: fechaValida(fv),
    fechaVersionRelleno: Boolean(fv) && !fechaValida(fv) && /^\d{4}/.test(fv),
    fechaPublicacion: ident?.attrs.fechaPublicacion ?? null,
    fechaPromulgacion: ident?.attrs.fechaPromulgacion ?? null,
    derogada: raiz.attrs.derogado === 'derogado',
    esTratado: raiz.attrs.esTratado === 'tratado',
    partes: [],
    imagenes: [],
  };

  // Las tablas suelen venir como imágenes base64 dentro de <Texto>, tanto en artículos como en anexos.
  const extraerImagenes = (textoNodo, idParte) => {
    for (const archivo of hijos(textoNodo, 'aem:ArchivoBinario')) {
      norma.imagenes.push({
        idParte,
        nombre: limpiar(textoDe(archivo, 'aem:Nombre')),
        tipoContenido: limpiar(textoDe(archivo, 'aem:TipoContenido')),
        datos: Buffer.from(textoDe(archivo, 'aem:DataCodificada').replace(/\s+/g, ''), 'base64'),
      });
    }
  };

  let orden = 0;
  const agregar = (base, texto) => {
    fragmentar(texto).forEach((t, fragmento) => norma.partes.push({ ...base, fragmento, orden: orden++, texto: t }));
  };

  const encabezado = hijo(raiz, 'Encabezado');
  if (encabezado) {
    agregar({ idParte: 0, idPadre: null, tipo: 'Encabezado', numeroOficial: null, numero: null, ruta: '',
      cuerpo: null, derogado: false, transitorio: false, fechaVersion: fechaValida(encabezado.attrs.fechaVersion) },
    textoDe(encabezado, 'Texto').trim());
  }

  const recorrer = (contenedor, padre, ruta, cuerpo) => {
    for (const ef of hijos(contenedor, 'EstructuraFuncional')) {
      const meta = hijo(ef, 'Metadatos');
      const nombre = hijo(meta, 'NombreParte');
      const titulo = hijo(meta, 'TituloParte');
      const tipo = ef.attrs.tipoParte;
      const nombreTxt = nombre?.attrs.presente === 'si' ? limpiar(nombre.texto) : '';
      const tituloTxt = titulo?.attrs.presente === 'si' ? limpiar(titulo.texto) : '';
      const numeroOficial = nombreTxt ? nombreTxt.replace(SUFIJO_DOBLE, '') : null;
      let cuerpoHijos = cuerpo;
      if (tipo === 'Doble Articulado') {
        // El nombre del cuerpo legal viene entre paréntesis ("del Artículo 3 (LEY SOBRE REGISTRO CIVIL)"
        // o "ARTÍCULO 2 (CÓDIGO CIVIL)"). Si BCN no lo da, se identifica por el artículo que lo contiene.
        const etiqueta = parentesis(nombreTxt) ?? (padre ? parentesis(padre.tituloTxt) : undefined);
        if (etiqueta) cuerpoHijos = tituloLegible(etiqueta);
        else if (padre?.numeroOficial) cuerpoHijos = `art. ${padre.numeroOficial}`;
      }
      const idParte = Number(ef.attrs.idParte);
      extraerImagenes(hijo(ef, 'Texto'), idParte);
      agregar({
        idParte, idPadre: padre?.idParte ?? null, tipo, numeroOficial,
        numero: numeroOficial ? normalizarNumero(numeroOficial) : null,
        ruta: ruta.join(' › '), cuerpo: tipo === 'Doble Articulado' ? cuerpoHijos : cuerpo,
        derogado: ef.attrs.derogado === 'derogado', transitorio: ef.attrs.transitorio === 'transitorio',
        fechaVersion: fechaValida(ef.attrs.fechaVersion),
      }, textoDe(ef, 'Texto').trim());
      const etiquetaRuta = tituloTxt || (nombreTxt && tipo !== 'Doble Articulado' ? `${tipo} ${nombreTxt}` : '');
      recorrer(hijo(ef, 'EstructurasFuncionales'), { idParte, tituloTxt, numeroOficial }, etiquetaRuta ? [...ruta, etiquetaRuta] : ruta, cuerpoHijos);
    }
  };
  recorrer(hijo(raiz, 'EstructurasFuncionales'), null, [], null);

  for (const anexo of hijos(hijo(raiz, 'Anexos'), 'Anexo')) {
    const idParte = Number(anexo.attrs.idParte);
    const textoNodo = hijo(anexo, 'Texto');
    extraerImagenes(textoNodo, idParte);
    const tituloAnexo = limpiar(textoDe(hijo(anexo, 'Metadatos'), 'Titulo')) || null;
    agregar({ idParte, idPadre: null, tipo: 'Anexo', numeroOficial: tituloAnexo, numero: null,
      ruta: tituloAnexo ? `Anexo › ${tituloAnexo}` : 'Anexo', cuerpo: null,
      derogado: anexo.attrs.derogado === 'derogado', transitorio: anexo.attrs.transitorio === 'transitorio',
      fechaVersion: fechaValida(anexo.attrs.fechaVersion) }, (textoNodo?.texto ?? '').trim());
  }

  return norma;
}
