// Índice local en SQLite (node:sqlite) con búsqueda de texto completo FTS5.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { extraerReferencias, extraerNormasMencionadas } from './referencias.mjs';
import { normalizarNumero } from './numeros.mjs';

const RANGO_ROL = { reglamento: 1, mensaje: 1, dependencia: 2, principal: 3 };
const quitarTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const linkParte = (idNorma, idParte) => `https://www.bcn.cl/leychile/navegar?idNorma=${idNorma}&idParte=${idParte}`;

import { nombreNorma, nombreDeParte, etiquetaCuerpo, cuerpoSinNombre } from './nombres.mjs';

export { nombreNorma, nombreDeParte, etiquetaCuerpo };

const nombreArchivo = (nombre) => nombre.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 80) || 'imagen';

export function citaSugerida(norma, parte) {
  const sinNombre = cuerpoSinNombre(parte.cuerpo);
  const nombre = nombreDeParte(norma, parte);
  let ubicacion = '';
  if (parte.tipo === 'Anexo') ubicacion = `, Anexo${parte.numeroOficial ? ` "${parte.numeroOficial}"` : ''}`;
  else if (parte.tipo === 'Encabezado') ubicacion = ', encabezado';
  else if (norma.tipo !== 'Mensaje' && parte.numeroOficial) {
    const transitorio = parte.transitorio && !/transitorio/i.test(parte.numeroOficial) ? ' transitorio' : '';
    ubicacion = parte.tipo.startsWith('Artículo') ? `, art. ${parte.numeroOficial}${transitorio}` : `, ${parte.tipo} ${parte.numeroOficial}`;
  }
  if (sinNombre && parte.tipo !== 'Doble Articulado') ubicacion += ` del ${parte.cuerpo}`;
  const versionNorma = norma.fechaVersionReal ?? norma.fechaVersion;
  let fechas;
  if (parte.fechaVersion && versionNorma) fechas = `texto desde ${parte.fechaVersion}; versión de la norma ${versionNorma}`;
  else if (parte.fechaVersion) fechas = `texto desde ${parte.fechaVersion}; versión de la norma no disponible; obtenido ${norma.fechaObtencion}`;
  else if (versionNorma) fechas = `versión de la norma ${versionNorma}`;
  else fechas = `fecha de versión no disponible; obtenido ${norma.fechaObtencion}`;
  let cita = `${nombre}${ubicacion} (${fechas})`;
  if (parte.derogado) cita += ' [DEROGADO]';
  if (norma.derogada) cita += ' [NORMA DEROGADA]';
  return cita;
}

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS normas (
  idNorma INTEGER PRIMARY KEY, tipo TEXT, numero TEXT, titulo TEXT, organismos TEXT,
  fechaVersion TEXT, fechaVersionReal TEXT, fechaPublicacion TEXT, fechaObtencion TEXT,
  derogada INTEGER, esTratado INTEGER, rol TEXT, nombreComun TEXT);
CREATE TABLE IF NOT EXISTS partes (
  rid INTEGER PRIMARY KEY, idNorma INTEGER, idParte INTEGER, fragmento INTEGER, idPadre INTEGER, orden INTEGER,
  tipo TEXT, numeroOficial TEXT, numero TEXT, ruta TEXT, cuerpo TEXT, texto TEXT,
  derogado INTEGER, transitorio INTEGER, fechaVersion TEXT, hash TEXT,
  UNIQUE (idNorma, idParte, fragmento));
CREATE INDEX IF NOT EXISTS partes_numero ON partes (idNorma, numero);
CREATE INDEX IF NOT EXISTS partes_padre ON partes (idNorma, idPadre);
CREATE TABLE IF NOT EXISTS vinculos (
  idPrincipal INTEGER, idRelacionada INTEGER, rol TEXT, partes TEXT, PRIMARY KEY (idPrincipal, idRelacionada));
CREATE TABLE IF NOT EXISTS referencias (idNorma INTEGER, idParte INTEGER, numero TEXT, ley TEXT);
CREATE INDEX IF NOT EXISTS referencias_numero ON referencias (numero);
CREATE TABLE IF NOT EXISTS imagenes (idNorma INTEGER, idParte INTEGER, nombre TEXT, ruta TEXT);
CREATE TABLE IF NOT EXISTS menciones (idNorma INTEGER, idParte INTEGER, ref TEXT, etiqueta TEXT, articulos TEXT);
CREATE INDEX IF NOT EXISTS menciones_parte ON menciones (idNorma, idParte);
CREATE VIRTUAL TABLE IF NOT EXISTS busqueda USING fts5 (texto, ruta, titulo, tokenize = 'unicode61 remove_diacritics 2');
`;

const aNorma = (r) => r && { ...r, organismos: JSON.parse(r.organismos ?? '[]'), derogada: Boolean(r.derogada), esTratado: Boolean(r.esTratado) };
const aParte = (r) => r && { ...r, derogado: Boolean(r.derogado), transitorio: Boolean(r.transitorio) };

export function abrirIndice(rutaDb, rutaImagenes) {
  mkdirSync(path.dirname(rutaDb), { recursive: true });
  const db = new DatabaseSync(rutaDb);
  // WAL: las búsquedas no se bloquean mientras otro proceso carga una norma.
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(ESQUEMA);

  const q = (sql) => db.prepare(sql);
  const transaccion = (fn) => {
    db.exec('BEGIN');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };

  const norma = (idNorma) => {
    const n = aNorma(q('SELECT * FROM normas WHERE idNorma = ?').get(idNorma));
    if (!n) return null;
    n.conCuerpos = Boolean(q('SELECT 1 FROM partes WHERE idNorma = ? AND cuerpo IS NOT NULL LIMIT 1').get(idNorma));
    return n;
  };

  const borrarContenido = (idNorma) => {
    q('DELETE FROM busqueda WHERE rowid IN (SELECT rid FROM partes WHERE idNorma = ?)').run(idNorma);
    q('DELETE FROM partes WHERE idNorma = ?').run(idNorma);
    q('DELETE FROM referencias WHERE idNorma = ?').run(idNorma);
    q('DELETE FROM imagenes WHERE idNorma = ?').run(idNorma);
    q('DELETE FROM menciones WHERE idNorma = ?').run(idNorma);
  };
  // Los archivos se tocan solo después de confirmar la transacción, para no perder imágenes si algo falla.
  const reemplazarImagenes = (idNorma, archivos) => {
    const dirImg = path.join(rutaImagenes, String(idNorma));
    rmSync(dirImg, { recursive: true, force: true });
    if (!archivos.length) return;
    mkdirSync(dirImg, { recursive: true });
    for (const a of archivos) writeFileSync(path.join(rutaImagenes, a.ruta), a.datos);
  };

  function guardarNorma(n, meta) {
    const archivos = [];
    const resultado = transaccion(() => {
      const previa = norma(n.idNorma);
      const hashesPrevios = new Map(q('SELECT idParte, hash, numeroOficial FROM partes WHERE idNorma = ? AND fragmento = 0').all(n.idNorma)
        .map((r) => [r.idParte, r]));
      borrarContenido(n.idNorma);

      const rol = previa && RANGO_ROL[previa.rol] > RANGO_ROL[meta.rol] ? previa.rol : meta.rol;
      const nombreComun = meta.nombreComun ?? previa?.nombreComun ?? null;
      q(`INSERT OR REPLACE INTO normas VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        n.idNorma, n.tipo, n.numero, n.titulo, JSON.stringify(n.organismos), n.fechaVersion,
        meta.fechaVersionReal ?? null, n.fechaPublicacion, meta.fechaObtencion, n.derogada ? 1 : 0, n.esTratado ? 1 : 0,
        rol, nombreComun);
      const fila = norma(n.idNorma);
      const nombre = nombreNorma(fila);

      const textos = new Map();
      for (const p of n.partes) textos.set(p.idParte, (textos.get(p.idParte) ?? '') + p.texto);
      const hashes = new Map([...textos].map(([id, t]) => [id, createHash('sha1').update(t).digest('hex')]));

      const insParte = q(`INSERT INTO partes (idNorma, idParte, fragmento, idPadre, orden, tipo, numeroOficial, numero, ruta, cuerpo,
        texto, derogado, transitorio, fechaVersion, hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      const insFts = q('INSERT INTO busqueda (rowid, texto, ruta, titulo) VALUES (?,?,?,?)');
      for (const p of n.partes) {
        const r = insParte.run(n.idNorma, p.idParte, p.fragmento, p.idPadre, p.orden, p.tipo, p.numeroOficial, p.numero,
          p.ruta, p.cuerpo, p.texto, p.derogado ? 1 : 0, p.transitorio ? 1 : 0, p.fechaVersion, hashes.get(p.idParte));
        if (p.texto) insFts.run(r.lastInsertRowid, p.texto, p.ruta, `${p.cuerpo ?? nombre} ${n.titulo}`);
      }

      const insRef = q('INSERT INTO referencias VALUES (?,?,?,?)');
      const insMencion = q('INSERT INTO menciones VALUES (?,?,?,?,?)');
      const propias = new Set([String(n.idNorma), `${quitarTildes(n.tipo)} ${n.numero}`,
        ...(nombreComun ? [quitarTildes(nombreComun)] : [])]);
      for (const [idParte, texto] of textos) {
        for (const ref of extraerReferencias(texto)) insRef.run(n.idNorma, idParte, ref.numero, ref.ley);
        for (const m of extraerNormasMencionadas(texto)) {
          if (!propias.has(m.ref)) insMencion.run(n.idNorma, idParte, m.ref, m.etiqueta, JSON.stringify(m.articulos));
        }
      }

      // Nombre único por parte y posición: BCN repite nombres ("tabla.jpg") entre artículos.
      const insImg = q('INSERT INTO imagenes VALUES (?,?,?,?)');
      n.imagenes.forEach((img, i) => {
        const ruta = path.join(String(n.idNorma), `${img.idParte}-${i}-${nombreArchivo(img.nombre)}`);
        archivos.push({ ruta, datos: img.datos });
        insImg.run(n.idNorma, img.idParte, img.nombre, ruta);
      });

      const cambiados = [];
      if (hashesPrevios.size) {
        const primeras = new Map(n.partes.filter((p) => p.fragmento === 0).map((p) => [p.idParte, p]));
        for (const [id, p] of primeras) {
          if (hashesPrevios.get(id)?.hash !== hashes.get(id) && p.numeroOficial) cambiados.push(p.numeroOficial);
        }
        for (const [id, prev] of hashesPrevios) if (!primeras.has(id) && prev.numeroOficial) cambiados.push(prev.numeroOficial);
      }
      return { cambiados };
    });
    reemplazarImagenes(n.idNorma, archivos);
    return resultado;
  }

  function vincular(idPrincipal, idRelacionada, rol, partes) {
    q('INSERT OR REPLACE INTO vinculos VALUES (?,?,?,?)').run(idPrincipal, idRelacionada, rol, JSON.stringify(partes));
  }
  function desvincular(idPrincipal, idRelacionada) {
    q('DELETE FROM vinculos WHERE idPrincipal = ? AND idRelacionada = ?').run(idPrincipal, idRelacionada);
  }
  function eliminarHuerfanas() {
    const huerfanas = q(`SELECT idNorma FROM normas WHERE rol IN ('reglamento','mensaje')
      AND idNorma NOT IN (SELECT idRelacionada FROM vinculos)`).all().map((r) => r.idNorma);
    transaccion(() => {
      for (const id of huerfanas) {
        borrarContenido(id);
        q('DELETE FROM vinculos WHERE idPrincipal = ?').run(id);
        q('DELETE FROM normas WHERE idNorma = ?').run(id);
      }
    });
    for (const id of huerfanas) reemplazarImagenes(id, []);
    return huerfanas;
  }

  const normasCache = new Map();
  const normaDe = (id) => { if (!normasCache.has(id)) normasCache.set(id, norma(id)); return normasCache.get(id); };

  function buscar(consulta, op = {}) {
    const { idNormas, limite = 8, derogados = false } = op;
    normasCache.clear();
    const filtros = [];
    const params = [];
    if (idNormas?.length) { filtros.push(`p.idNorma IN (${idNormas.map(() => '?').join(',')})`); params.push(...idNormas); }
    if (!derogados) filtros.push('p.derogado = 0');
    const sql = `SELECT p.*, snippet(busqueda, 0, '[', ']', '…', 24) AS extracto, bm25(busqueda, 1.0, 3.0, 2.0) AS puntaje
      FROM busqueda JOIN partes p ON p.rid = busqueda.rowid
      WHERE busqueda MATCH ? ${filtros.map((f) => `AND ${f}`).join(' ')} ORDER BY puntaje LIMIT ?`;
    const correr = (m) => q(sql).all(m, ...params, limite);
    // Solo los errores de sintaxis de la consulta se reintentan; un error real (base bloqueada, cerrada) se informa.
    const esDeSintaxis = (e) => /fts5|syntax|no such column|unterminated|unknown special query/i.test(e?.message ?? '');
    let filas;
    if (!consulta.trim()) return [];
    try {
      filas = correr(consulta);
    } catch (e) {
      if (!esDeSintaxis(e)) throw e;
      const terminos = consulta.split(/\s+/).filter(Boolean).map((t) => `"${t.replace(/"/g, '""')}"`);
      if (!terminos.length) return [];
      try { filas = correr(terminos.join(' OR ')); } catch (e2) { if (!esDeSintaxis(e2)) throw e2; return []; }
    }
    return filas.map((f) => {
      const n = normaDe(f.idNorma);
      return { idNorma: f.idNorma, idParte: f.idParte, fragmento: f.fragmento, citaSugerida: citaSugerida(n, aParte(f)),
        ruta: f.ruta, extracto: f.extracto.replace(/\s+/g, ' ').trim(), puntaje: f.puntaje, link: linkParte(f.idNorma, f.idParte) };
    });
  }

  const fragmentosDe = (idNorma, idParte) => q('SELECT * FROM partes WHERE idNorma = ? AND idParte = ? ORDER BY fragmento')
    .all(idNorma, idParte).map(aParte);
  const imagenesDe = (idNorma, idParte) => q('SELECT ruta FROM imagenes WHERE idNorma = ? AND idParte = ?')
    .all(idNorma, idParte).map((r) => path.resolve(rutaImagenes, r.ruta));
  const mencionesDe = (idNorma, idParte) => q('SELECT ref, etiqueta, articulos FROM menciones WHERE idNorma = ? AND idParte = ?')
    .all(idNorma, idParte).map((r) => ({ ref: r.ref, etiqueta: r.etiqueta, articulos: JSON.parse(r.articulos) }));
  const resumenMenciones = (idNorma) => q(`SELECT ref, etiqueta, COUNT(DISTINCT idParte) AS veces FROM menciones
    WHERE idNorma = ? GROUP BY ref ORDER BY veces DESC, ref`).all(idNorma).map((r) => ({ ref: r.ref, etiqueta: r.etiqueta, veces: r.veces }));

  function articulo(idNorma, numero, op = {}) {
    const n = norma(idNorma);
    if (!n) return null;
    let num = normalizarNumero(numero);
    const transitorio = / transitorio$/.test(num);
    if (transitorio) num = num.replace(/ transitorio$/, '');
    let candidatas = q(`SELECT * FROM partes WHERE idNorma = ? AND numero = ? AND fragmento = 0 AND tipo LIKE 'Art%'
      AND transitorio = ?`).all(idNorma, num, transitorio ? 1 : 0).map(aParte);
    if (op.cuerpo) {
      const c = quitarTildes(op.cuerpo);
      candidatas = candidatas.filter((p) => quitarTildes(etiquetaCuerpo(n, p)) === c);
    }
    if (!candidatas.length) return null;
    if (candidatas.length > 1) {
      const nombres = candidatas.map((p) => etiquetaCuerpo(n, p));
      // Si los nombres no alcanzan para distinguir, se muestran la ruta y el idParte (se abren con `seccion`).
      if (new Set(nombres).size === nombres.length) return { ambiguo: nombres };
      return { ambiguo: candidatas.map((p, i) => `${nombres[i]} — ${p.ruta || 'sin ruta'} (idParte ${p.idParte})`), porIdParte: true };
    }
    const parte = candidatas[0];
    const vinculos = q('SELECT * FROM vinculos WHERE idPrincipal = ?').all(idNorma);
    const reglamentos = [];
    for (const v of vinculos) {
      const partesV = JSON.parse(v.partes);
      const p = partesV.find((x) => x.idParte === parte.idParte);
      const rel = norma(v.idRelacionada);
      if (p && rel) reglamentos.push({ idNorma: rel.idNorma, nombre: nombreNorma(rel), titulo: rel.titulo, descripcion: p.descripcion });
    }
    const cita = [...new Set(q('SELECT numero FROM referencias WHERE idNorma = ? AND idParte = ? AND ley IS NULL')
      .all(idNorma, parte.idParte).map((r) => r.numero))];
    const citadoPor = q(`SELECT DISTINCT r.idNorma, p.numero FROM referencias r
      JOIN partes p ON p.idNorma = r.idNorma AND p.idParte = r.idParte AND p.fragmento = 0
      WHERE r.numero = ? AND ((r.ley IS NULL AND r.idNorma = ? AND (p.cuerpo IS ? OR p.cuerpo = ?)) OR (r.ley = ? AND ? = 'Ley'))
        AND NOT (r.idNorma = ? AND r.idParte = ?)`)
      .all(num, idNorma, parte.cuerpo, parte.cuerpo, n.numero, n.tipo, idNorma, parte.idParte)
      .filter((r) => r.numero);
    return {
      norma: n, partes: fragmentosDe(idNorma, parte.idParte), link: linkParte(idNorma, parte.idParte),
      citaSugerida: citaSugerida(n, parte), reglamentos, cita, citadoPor,
      imagenes: imagenesDe(idNorma, parte.idParte), menciones: mencionesDe(idNorma, parte.idParte),
    };
  }

  function descendientes(idNorma, idParte) {
    const todas = q('SELECT * FROM partes WHERE idNorma = ? ORDER BY orden').all(idNorma).map(aParte);
    const ids = new Set([idParte]);
    for (const p of todas) if (p.idPadre !== null && ids.has(p.idPadre)) ids.add(p.idParte);
    return todas.filter((p) => ids.has(p.idParte));
  }

  function seccion(idParte) {
    const p = aParte(q('SELECT * FROM partes WHERE idParte = ? AND idParte > 0 AND fragmento = 0').get(idParte));
    if (!p) return null;
    const raiz = p.tipo.startsWith('Art') && p.idPadre !== null ? p.idPadre : p.idParte;
    const partes = descendientes(p.idNorma, raiz);
    return { idNorma: p.idNorma, ruta: partes[0]?.ruta ?? p.ruta, partes };
  }

  const textoParteCompleto = (idNorma, idParte) => descendientes(idNorma, idParte).map((p) => p.texto).join('\n');

  function listar() {
    return q('SELECT * FROM normas ORDER BY rol DESC, idNorma').all().map(aNorma).map((n) => ({
      idNorma: n.idNorma, nombre: nombreNorma(n), titulo: n.titulo, rol: n.rol, tipo: n.tipo, numero: n.numero,
      fechaPublicacion: n.fechaPublicacion, nombreComun: n.nombreComun,
      fechaVersion: n.fechaVersionReal ?? n.fechaVersion, fechaObtencion: n.fechaObtencion, derogada: n.derogada,
      partes: q('SELECT COUNT(DISTINCT idParte) AS c FROM partes WHERE idNorma = ?').get(n.idNorma).c,
      de: q('SELECT idPrincipal FROM vinculos WHERE idRelacionada = ?').all(n.idNorma).map((r) => r.idPrincipal),
    }));
  }

  const parte = (idNorma, idParte) => fragmentosDe(idNorma, idParte)[0] ?? null;
  const vinculosDe = (idPrincipal) => q('SELECT * FROM vinculos WHERE idPrincipal = ?').all(idPrincipal)
    .map((v) => ({ ...v, partes: JSON.parse(v.partes) }));

  return {
    guardarNorma, vincular, desvincular, eliminarHuerfanas, buscar, articulo, seccion, listar, norma, parte,
    imagenesDe, mencionesDe, resumenMenciones, textoParteCompleto, vinculosDe, cerrar: () => db.close(),
  };
}
