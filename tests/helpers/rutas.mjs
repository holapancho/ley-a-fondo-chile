// Rutas del servidor simulado de BCN compartidas por los tests de carga y del CLI.
import { xmlSintetico } from './servidor-bcn.mjs';
import { leerFixture } from './fixtures.mjs';

export const VIN = (id) => `/servicios/Vinculaciones/get_vinculaciones?idNorma=${id}&sentidoVinculacion=reglamentada_por&clase_vinculacion=reglamento`;
export const XML = (id) => `/Consulta/obtxml?opt=7&idNorma=${id}`;
export const vin20000 = JSON.parse(leerFixture('vinculaciones-20000.json'));
export const REGLAMENTOS_20000 = [...new Set(vin20000.aciertos.map((a) => Number(a.IDNORMA)))];
export const vacio = JSON.stringify({ cantidadAciertos: '0', aciertos: [] });
export const unReglamento = (idRegl, idParte) => JSON.stringify({ cantidadAciertos: '1', aciertos: [
  { IDNORMA: String(idRegl), NORMA: `Decreto ${idRegl}`, TITULO_NORMA: 'REGLAMENTO DE PRUEBA', FECHA_PUBLICACION: '01-ENE-2020',
    idParteActual: idParte ? String(idParte) : '', parteActual: idParte ? 'Artículo 1 ' : 'Norma' }] });

export function rutasBase() {
  const rutas = {
    '/Consulta/obtxml?opt=61&cadena=20000': 'busqueda-20000.xml',
    '/Consulta/obtxml?opt=61&cadena=867': 'busqueda-decreto-867.xml',
    [XML(235507)]: 'ley-20000.xml',
    [VIN(235507)]: 'vinculaciones-20000.json',
    [XML(269323)]: 'decreto-867-2007.xml',
    '/servicios/Consulta/getCodigos': 'codigos.json',
    [XML(172986)]: 'codigo-civil.xml',
    [VIN(172986)]: vacio,
    '/servicios/Navegar/get_norma_json?idNorma=172986': 'norma-json-172986.json',
    [XML(1080094)]: 'mensaje-codigo-civil.xml',
    [XML(1984)]: 'codigo-penal.xml',
    [VIN(1984)]: unReglamento(900001, null),
    '/servicios/Navegar/get_norma_json?idNorma=1984': 'norma-json-1984.json',
    [XML(900001)]: xmlSintetico(900001, 'Decreto', '900001', [{ numero: '1', texto: 'Artículo 1.- Reglamento del código penal.' }]),
  };
  for (const id of REGLAMENTOS_20000.filter((x) => x !== 269323)) {
    rutas[XML(id)] = xmlSintetico(id, 'Decreto', String(id), [{ numero: '1', texto: `Artículo 1.- Reglamento ${id}.` }]);
  }
  return rutas;
}
