// Carga y reindexación: descarga normas desde BCN y las guarda en el índice.
import { parseNorma } from './parser.mjs';
import { resolverReferencia } from './resolver.mjs';
import { nombreNorma } from './indice.mjs';
import { ErrorBcn } from './http.mjs';

const cuentaArticulos = (n) => new Set(n.partes.filter((p) => p.tipo.startsWith('Art')).map((p) => p.idParte)).size;

// Descarga, parsea y guarda una norma. Lanza ErrorBcn si BCN falla al entregar el texto.
async function bajarYGuardar(idNorma, meta, ctx, advertencias = []) {
  const n = parseNorma(await ctx.fuentes.xmlNorma(idNorma));
  if (!n.idNorma) throw new ErrorBcn(`BCN no devolvió una norma válida para idNorma ${idNorma}`, { url: String(idNorma) });
  let fechaVersionReal;
  if (n.fechaVersionRelleno) {
    // La fecha real es un dato extra: si su servicio falla, la norma se carga igual.
    try { fechaVersionReal = (await ctx.fuentes.metadatos(idNorma)).inicioVigencia ?? undefined; }
    catch (e) {
      if (!(e instanceof ErrorBcn)) throw e;
      advertencias.push(`No se pudo obtener la fecha de versión real de idNorma ${idNorma}; las citas usarán la fecha de cada artículo o la de obtención.`);
    }
  }
  const { cambiados } = ctx.indice.guardarNorma(n, { ...meta, fechaObtencion: ctx.hoy, fechaVersionReal });
  const fila = ctx.indice.norma(n.idNorma);
  return { norma: n, fila, cambiados, nombre: nombreNorma(fila), articulos: cuentaArticulos(n) };
}

export async function cargar(entrada, ctx, { dependencia = false } = {}) {
  const res = await resolverReferencia(entrada, ctx.fuentes);
  if (res.tipo === 'ambiguo') return { estado: 'ambiguo', candidatos: res.candidatos };
  if (res.tipo === 'no-encontrado') return { estado: 'no-encontrado', entrada };

  const previa = ctx.indice.norma(res.idNorma);
  if (dependencia && previa && ['principal', 'dependencia'].includes(previa.rol)) {
    return { estado: 'ok', normas: [], advertencias: [], yaCargada: true };
  }

  const advertencias = [];
  let reglamentos = [];
  if (!dependencia) {
    try { reglamentos = await ctx.fuentes.reglamentos(res.idNorma); }
    catch (e) {
      if (!(e instanceof ErrorBcn)) throw e;
      advertencias.push(`No se pudo obtener la lista de reglamentos: ${e.message}`);
    }
  }
  const conMensaje = !dependencia && res.idNormaMensaje;
  const total = 1 + reglamentos.length + (conMensaje ? 1 : 0);
  let i = 0;
  const normas = [];
  const linea = (nombre, detalle) => ctx.avisar(`[${++i}/${total}] ${nombre}… ${detalle}`);

  const rol = dependencia ? 'dependencia' : 'principal';
  const p = await bajarYGuardar(res.idNorma, { rol, nombreComun: res.nombreComun }, ctx, advertencias);
  linea(p.nombre, `${p.articulos} artículos ✓`);
  normas.push({ idNorma: p.norma.idNorma, nombre: p.nombre, rol: p.fila.rol, partes: p.articulos });
  if (p.norma.derogada) advertencias.push(`${p.nombre} está DEROGADA.`);

  const secundarias = [
    ...reglamentos.map((r) => ({ idNorma: r.idNorma, rol: 'reglamento', partes: r.partes, etiqueta: r.nombre || `idNorma ${r.idNorma}` })),
    ...(conMensaje ? [{ idNorma: res.idNormaMensaje, rol: 'mensaje', partes: [], etiqueta: `Mensaje del ${res.nombreComun}` }] : []),
  ];
  for (const s of secundarias) {
    try {
      const r = await bajarYGuardar(s.idNorma, { rol: s.rol }, ctx, advertencias);
      ctx.indice.vincular(res.idNorma, s.idNorma, s.rol, s.partes);
      linea(r.nombre, `${r.articulos} artículos ✓`);
      normas.push({ idNorma: s.idNorma, nombre: r.nombre, rol: r.fila.rol, partes: r.articulos });
    } catch (e) {
      if (!(e instanceof ErrorBcn)) throw e;
      linea(s.etiqueta, `✗ ${e.message}`);
      advertencias.push(`No se pudo cargar ${s.etiqueta} (idNorma ${s.idNorma}): ${e.message}`);
    }
  }
  return { estado: 'ok', normas, advertencias, menciones: ctx.indice.resumenMenciones(res.idNorma) };
}

export async function reindexar(entrada, ctx) {
  let principales;
  if (entrada) {
    const res = await resolverReferencia(entrada, ctx.fuentes);
    const n = res.tipo === 'unico' ? ctx.indice.norma(res.idNorma) : null;
    if (!n) return { normas: [], reglamentosNuevos: [], reglamentosQuitados: [], noCargada: true };
    principales = [n];
  } else {
    principales = ctx.indice.listar().filter((n) => ['principal', 'dependencia'].includes(n.rol)).map((n) => ctx.indice.norma(n.idNorma));
  }

  const resultado = { normas: [], reglamentosNuevos: [], reglamentosQuitados: [] };
  const hechas = new Set();
  const actualizar = async (idNorma, meta) => {
    if (hechas.has(idNorma)) return;
    hechas.add(idNorma);
    const previa = ctx.indice.norma(idNorma);
    try {
      const r = await bajarYGuardar(idNorma, { rol: meta.rol, nombreComun: previa?.nombreComun ?? undefined }, ctx);
      const cambioFecha = previa && (previa.fechaVersionReal ?? previa.fechaVersion) !== (r.fila.fechaVersionReal ?? r.fila.fechaVersion);
      const estado = previa && !cambioFecha && !r.cambiados.length ? 'sin-cambios' : 'actualizada';
      resultado.normas.push({ idNorma, nombre: r.nombre, estado, cambiados: r.cambiados });
    } catch (e) {
      if (!(e instanceof ErrorBcn)) throw e;
      resultado.normas.push({ idNorma, nombre: previa ? nombreNorma(previa) : `idNorma ${idNorma}`, estado: 'error', cambiados: [], error: e.message });
    }
  };

  for (const principal of principales) {
    await actualizar(principal.idNorma, { rol: principal.rol });
    const vinculos = ctx.indice.vinculosDe(principal.idNorma);
    if (principal.rol === 'principal') {
      let lista;
      try { lista = await ctx.fuentes.reglamentos(principal.idNorma); }
      catch (e) { if (!(e instanceof ErrorBcn)) throw e; lista = null; }
      if (lista) {
        const actuales = new Set(vinculos.filter((v) => v.rol === 'reglamento').map((v) => v.idRelacionada));
        const nuevos = new Set(lista.map((r) => r.idNorma));
        for (const id of actuales) {
          if (!nuevos.has(id)) { ctx.indice.desvincular(principal.idNorma, id); resultado.reglamentosQuitados.push(id); }
        }
        for (const r of lista) {
          if (!actuales.has(r.idNorma)) resultado.reglamentosNuevos.push(r.idNorma);
          await actualizar(r.idNorma, { rol: 'reglamento' });
          if (ctx.indice.norma(r.idNorma)) ctx.indice.vincular(principal.idNorma, r.idNorma, 'reglamento', r.partes);
        }
      } else {
        for (const v of vinculos.filter((x) => x.rol === 'reglamento')) await actualizar(v.idRelacionada, { rol: 'reglamento' });
      }
    }
    for (const v of vinculos.filter((x) => x.rol === 'mensaje')) await actualizar(v.idRelacionada, { rol: 'mensaje' });
  }
  ctx.indice.eliminarHuerfanas();
  return resultado;
}
