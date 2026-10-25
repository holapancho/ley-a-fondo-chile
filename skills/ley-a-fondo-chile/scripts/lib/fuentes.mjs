// Endpoints públicos de Ley Chile – BCN (no requieren API key; no están documentados y pueden cambiar).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseXml, hijo, hijos, textoDe } from './xml.mjs';
import { ErrorBcn } from './http.mjs';

export const BASES = {
  publica: process.env.LEY_A_FONDO_BASE_PUBLICA ?? 'https://www.leychile.cl',
  nuevo: process.env.LEY_A_FONDO_BASE_NUEVO ?? 'https://nuevo.leychile.cl/servicios',
};

const CODIGOS_LOCALES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'codigos.json');
const MESES = { ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06', JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12' };

// "01-FEB-1968" → "1968-02-01"
export function fechaIso(s) {
  const m = s?.trim().match(/^(\d{2})-([A-Z]{3})-(\d{4})$/i);
  return m ? `${m[3]}-${MESES[m[2].toUpperCase()]}-${m[1]}` : null;
}

const limpiar = (s) => s.replace(/\s+/g, ' ').trim();

export function crearFuentes(cliente, { bases = BASES } = {}) {
  const { publica, nuevo } = { ...BASES, ...bases };

  async function buscar(texto, cantidad = 50) {
    const xml = await cliente.texto(`${publica}/Consulta/obtxml?opt=61&cadena=${encodeURIComponent(texto)}&cantidad=${cantidad}`);
    return hijos(parseXml(xml), 'Norma').map((n) => {
      const tn = hijo(hijo(n, 'TiposNumeros'), 'TipoNumero');
      return {
        idNorma: Number(textoDe(n, 'IdNorma')),
        tipo: limpiar(textoDe(tn, 'Descripcion')),
        numero: limpiar(textoDe(tn, 'Numero')),
        compuesto: limpiar(textoDe(tn, 'Compuesto')),
        fechaPublicacion: fechaIso(textoDe(n, 'FechaPublicacion')),
        titulo: limpiar(textoDe(n, 'TituloNorma')),
      };
    });
  }

  const xmlNorma = (idNorma) => cliente.texto(`${publica}/Consulta/obtxml?opt=7&idNorma=${idNorma}`);

  async function reglamentos(idNorma) {
    const porNorma = new Map();
    for (let pagina = 1; ; pagina++) {
      const j = await cliente.json(`${nuevo}/Vinculaciones/get_vinculaciones?idNorma=${idNorma}&npagina=${pagina}`
        + '&itemsporpagina=50&sentidoVinculacion=reglamentada_por&clase_vinculacion=reglamento');
      const aciertos = j.aciertos ?? [];
      for (const a of aciertos) {
        const id = Number(a.IDNORMA);
        if (!id) continue; // BCN a veces vincula normas que no tiene publicadas (sin idNorma).
        if (!porNorma.has(id)) {
          porNorma.set(id, { idNorma: id, nombre: limpiar(a.NORMA ?? ''), titulo: limpiar(a.TITULO_NORMA ?? a.titulo ?? ''),
            fechaPublicacion: fechaIso(a.FECHA_PUBLICACION), partes: [] });
        }
        const idParte = a.idParteActual ? Number(a.idParteActual) : null;
        const descripcion = idParte ? limpiar(a.parteActual ?? '') : 'Norma completa';
        const partes = porNorma.get(id).partes;
        if (!partes.some((p) => p.idParte === idParte)) partes.push({ idParte, descripcion });
      }
      if (aciertos.length < 50 || pagina * 50 >= Number(j.cantidadAciertos ?? 0)) break;
    }
    return [...porNorma.values()];
  }

  async function codigos() {
    let lista;
    try {
      lista = await cliente.json(`${nuevo}/Consulta/getCodigos`);
    } catch (e) {
      if (!(e instanceof ErrorBcn)) throw e;
      lista = JSON.parse(readFileSync(CODIGOS_LOCALES, 'utf8'));
    }
    return lista.map((c) => ({
      idNorma: Number(c.idNorma), idParte: Number(c.idParte),
      idNormaMensaje: c.idNormaMensaje ? Number(c.idNormaMensaje) : null, titulo: limpiar(c.titulo),
    }));
  }

  async function metadatos(idNorma) {
    const j = await cliente.json(`${nuevo}/Navegar/get_norma_json?idNorma=${idNorma}`);
    return { inicioVigencia: j.metadatos?.vigencia?.inicio_vigencia || null };
  }

  return { modo: 'publico', buscar, xmlNorma, reglamentos, codigos, metadatos };
}
