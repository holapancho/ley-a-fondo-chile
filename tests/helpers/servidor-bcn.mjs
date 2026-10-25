// Servidor HTTP local que imita los endpoints públicos de BCN sirviendo fixtures.
import http from 'node:http';
import { leerFixture } from './fixtures.mjs';

const IGNORAR = new Set(['cantidad', 'secret', 'npagina', 'itemsporpagina']);

// Clave canónica: ruta + parámetros relevantes ordenados.
export function claveDe(urlTexto) {
  const u = new URL(urlTexto, 'http://x');
  const params = [...u.searchParams].filter(([k]) => !IGNORAR.has(k)).sort(([a], [b]) => a.localeCompare(b));
  return `${u.pathname}?${params.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

export async function iniciarServidor(rutas) {
  const solicitudes = [];
  const tabla = new Map(Object.entries(rutas).map(([k, v]) => [claveDe(k), v]));
  const servidor = http.createServer((req, res) => {
    solicitudes.push(req.url);
    const r = tabla.get(claveDe(req.url));
    let status = 200, body;
    if (r === undefined) { status = 404; body = 'no encontrado'; }
    else if (typeof r === 'function') ({ status, body } = r(req));
    else body = r.startsWith('<') || r.startsWith('{') || r.startsWith('[') ? r : leerFixture(r);
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(body);
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  return {
    base: `http://127.0.0.1:${servidor.address().port}`,
    solicitudes,
    rutas: tabla,
    poner: (k, v) => tabla.set(claveDe(k), v),
    cerrar: () => new Promise((ok) => servidor.close(ok)),
  };
}

export function xmlSintetico(idNorma, tipo, numero, articulos, { fechaVersion = '2020-01-01', fechaPublicacion = '2019-01-01' } = {}) {
  const arts = articulos.map((a, i) => `<EstructuraFuncional tipoParte="Artículo" fechaVersion="${fechaVersion}" derogado="no derogado" transitorio="no transitorio" idParte="${idNorma * 1000 + i + 1}">
<Texto>${a.texto}</Texto><Metadatos><NombreParte presente="si">${a.numero}</NombreParte><TituloParte presente="no"> </TituloParte></Metadatos></EstructuraFuncional>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?><Norma normaId="${idNorma}" fechaVersion="${fechaVersion}" derogado="no derogado" esTratado="no tratado">
<Identificador fechaPublicacion="${fechaPublicacion}" fechaPromulgacion="${fechaPublicacion}"><TiposNumeros><TipoNumero><Tipo>${tipo}</Tipo><Numero>${numero}</Numero></TipoNumero></TiposNumeros>
<Organismos><Organismo>MINISTERIO DE PRUEBA</Organismo></Organismos></Identificador>
<Metadatos><TituloNorma>${tipo.toUpperCase()} ${numero} DE PRUEBA</TituloNorma></Metadatos>
<EstructurasFuncionales>${arts}</EstructurasFuncionales></Norma>`;
}
