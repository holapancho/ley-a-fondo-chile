// Cliente HTTP con pausa entre solicitudes, un reintento y detección de respuestas HTML.

export const USER_AGENT = 'ley-a-fondo-chile/0.1 (+https://github.com/holapancho/ley-a-fondo-chile)';

export class ErrorBcn extends Error {
  constructor(mensaje, { status = null, url }) {
    super(mensaje);
    this.name = 'ErrorBcn';
    this.status = status;
    this.url = url;
  }
}

const esHtml = (t) => /^\s*(<!doctype html|<html)/i.test(t);
const reintentable = (status) => status === 429 || status >= 500;

export function crearCliente({ pausaMs = 1000, ahora = () => Date.now(), dormir = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let ultima = null;
  const cliente = { solicitudesHechas: 0 };

  async function pedir(url) {
    if (ultima !== null) {
      const espera = pausaMs - (ahora() - ultima);
      if (espera > 0) await dormir(espera);
    }
    ultima = ahora();
    cliente.solicitudesHechas++;
    return fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  }

  cliente.texto = async (url) => {
    let ultimoError;
    for (let intento = 0; intento < 2; intento++) {
      let res;
      try {
        res = await pedir(url);
      } catch (e) {
        ultimoError = new ErrorBcn(`No se pudo conectar con BCN (${e.cause?.code ?? e.message})`, { url });
        continue;
      }
      if (res.ok) {
        const t = await res.text();
        if (esHtml(t)) throw new ErrorBcn('BCN respondió una página HTML en vez de datos; el servicio pudo cambiar o no estar disponible', { status: res.status, url });
        return t;
      }
      ultimoError = new ErrorBcn(`BCN respondió HTTP ${res.status}`, { status: res.status, url });
      if (!reintentable(res.status)) break;
    }
    throw ultimoError;
  };

  cliente.json = async (url) => {
    const t = await cliente.texto(url);
    try { return JSON.parse(t); } catch { throw new ErrorBcn('BCN respondió algo que no es JSON', { url }); }
  };

  return cliente;
}
