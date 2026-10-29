#!/usr/bin/env node
// ley-a-fondo-chile: descarga normas de Ley Chile – BCN, las indexa localmente y entrega citas verificables.
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const [MAYOR] = process.versions.node.split('.').map(Number);
if (MAYOR < 24) {
  console.error(`Se necesita Node.js 24 o superior (tienes ${process.versions.node}).`);
  process.exit(1);
}

// node:sqlite emite un ExperimentalWarning que no le sirve al usuario.
const emitirOriginal = process.emitWarning;
process.emitWarning = function (aviso, ...resto) {
  const texto = typeof aviso === 'string' ? aviso : aviso?.message ?? '';
  if (/SQLite/i.test(texto)) return;
  return emitirOriginal.call(process, aviso, ...resto);
};

const { abrirIndice, nombreNorma } = await import('./lib/indice.mjs');
const { crearCliente, ErrorBcn } = await import('./lib/http.mjs');
const { crearFuentes } = await import('./lib/fuentes.mjs');
const { cargar, reindexar } = await import('./lib/cargar.mjs');
const { resolverLocal } = await import('./lib/resolver.mjs');
const { verificarCitas } = await import('./lib/citas.mjs');

const AYUDA = `Uso: node ley-a-fondo.mjs <comando> [argumentos] [--json]

  cargar <referencia> [--dependencia]   Descarga e indexa una norma y todos sus reglamentos.
                                        Referencias: "ley 20000", "codigo civil", "decreto 867 2008",
                                        un link de BCN o un idNorma.
  reindexar <referencia> | --todas      Vuelve a descargar y reporta qué cambió.
  listar                                Normas cargadas.
  buscar "<consulta>" [--norma <ref>] [--limite N] [--derogados]
  articulo "<referencia>" "<número>" [--cuerpo "<cuerpo legal>"]
  seccion <idParte>                     Párrafo o título completo que contiene esa parte.
  verificar-citas <archivo.md>          Revisa que cada cita exista y que los literales «…» coincidan.
  estado                                Modo, ubicación del índice y normas cargadas.`;

const SALIDA = { ok: 0, error: 1, ambiguo: 2, citasInvalidas: 4 };

function parsearArgs(argv) {
  const flags = {}, posicionales = [];
  const conValor = new Set(['norma', 'limite', 'cuerpo']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const nombre = a.slice(2);
      flags[nombre] = conValor.has(nombre) ? argv[++i] : true;
    } else posicionales.push(a);
  }
  return { comando: posicionales.shift(), posicionales, flags };
}

const { comando, posicionales, flags } = parsearArgs(process.argv.slice(2));
const comoJson = Boolean(flags.json);
const home = process.env.LEY_A_FONDO_HOME ?? path.join(os.homedir(), '.ley-a-fondo-chile');
const hoy = new Date().toLocaleDateString('sv-SE');
const imprimir = (s = '') => process.stdout.write(`${s}\n`);
const json = (obj) => imprimir(JSON.stringify(obj, null, 2));

let indice;
const abrir = () => (indice ??= abrirIndice(path.join(home, 'indice.db'), path.join(home, 'normas')));
const contexto = () => ({
  indice: abrir(),
  fuentes: crearFuentes(crearCliente({ pausaMs: Number(process.env.LEY_A_FONDO_PAUSA_MS ?? 1000) })),
  avisar: (l) => (comoJson ? process.stderr : process.stdout).write(`${l}\n`),
  hoy,
});

function normaLocal(ref) {
  const r = resolverLocal(ref, abrir().listar());
  if (r.tipo === 'unico') return r.idNorma;
  if (r.tipo === 'ambiguo') {
    imprimir(`"${ref}" coincide con varias normas cargadas:`);
    for (const c of r.candidatos) imprimir(`  - ${c.nombre} (idNorma ${c.idNorma})`);
    imprimir('Usa el idNorma para elegir una.');
    throw new Salida(SALIDA.ambiguo);
  }
  imprimir(`"${ref}" no está cargada. Cárgala primero con: cargar ${ref}`);
  throw new Salida(SALIDA.error);
}

const estaCargada = (ref) => resolverLocal(ref, abrir().listar()).tipo === 'unico';

async function cmdCargar() {
  const ref = posicionales.join(' ');
  if (!ref) throw new UsoInvalido('Falta la referencia de la norma.');
  const r = await cargar(ref, contexto(), { dependencia: Boolean(flags.dependencia) });
  if (comoJson) json(r);
  if (r.estado === 'ambiguo') {
    if (!comoJson) {
      imprimir(`"${ref}" coincide con ${r.candidatos.length} normas. Elige una y cárgala por su idNorma:`);
      r.candidatos.forEach((c, i) => imprimir(`  ${i + 1}. idNorma ${c.idNorma} — ${c.tipo} ${c.numero} (publicado ${c.fechaPublicacion ?? '¿?'}): ${c.titulo}`));
    }
    return SALIDA.ambiguo;
  }
  if (r.estado === 'no-encontrado') {
    if (!comoJson) {
      imprimir(`No encontré "${ref}" en Ley Chile.`);
      imprimir('Prueba con el link de la norma en https://www.bcn.cl/leychile o con su idNorma.');
    }
    return SALIDA.error;
  }
  if (!comoJson) {
    if (r.yaCargada) imprimir('La norma ya estaba cargada.');
    else imprimir(`Listo: ${r.normas.length} norma(s) cargada(s) en ${home}.`);
    for (const a of r.advertencias) imprimir(`Advertencia: ${a}`);
    const pendientes = (r.menciones ?? []).filter((m) => !estaCargada(m.ref));
    if (pendientes.length) {
      imprimir(`Esta norma menciona otras normas que NO se cargaron (pregúntale al usuario antes de cargar alguna):`);
      for (const m of pendientes.slice(0, 10)) imprimir(`  - ${m.etiqueta} (en ${m.veces} parte(s)) → cargar "${m.ref}"`);
      if (pendientes.length > 10) imprimir(`  … y ${pendientes.length - 10} más.`);
    }
  }
  return SALIDA.ok;
}

async function cmdReindexar() {
  const ref = posicionales.join(' ');
  if (!ref && !flags.todas) throw new UsoInvalido('Indica una referencia o usa --todas.');
  const r = await reindexar(flags.todas ? null : ref, contexto());
  if (comoJson) { json(r); return r.noCargada ? SALIDA.error : SALIDA.ok; }
  if (r.noCargada) { imprimir(`"${ref}" no está cargada.`); return SALIDA.error; }
  for (const n of r.normas) {
    if (n.estado === 'sin-cambios') imprimir(`${n.nombre}: sin cambios`);
    else if (n.estado === 'actualizada') imprimir(`${n.nombre}: actualizada${n.cambiados.length ? ` (cambiaron: ${n.cambiados.join(', ')})` : ''}`);
    else imprimir(`${n.nombre}: ERROR ${n.error}`);
  }
  if (r.reglamentosNuevos.length) imprimir(`Reglamentos nuevos: ${r.reglamentosNuevos.join(', ')}`);
  if (r.reglamentosQuitados.length) imprimir(`Reglamentos que BCN ya no vincula (quitados): ${r.reglamentosQuitados.join(', ')}`);
  return r.normas.some((n) => n.estado === 'error') ? SALIDA.error : SALIDA.ok;
}

function cmdListar() {
  const lista = abrir().listar();
  if (comoJson) { json(lista); return SALIDA.ok; }
  if (!lista.length) { imprimir('No hay normas cargadas.'); return SALIDA.ok; }
  for (const n of lista) {
    const de = n.de.length ? ` · de ${n.de.join(', ')}` : '';
    imprimir(`${n.nombre} (idNorma ${n.idNorma}) · ${n.rol}${n.derogada ? ' · DEROGADA' : ''} · versión ${n.fechaVersion ?? 'no disponible'} · obtenido ${n.fechaObtencion} · ${n.partes} partes${de}`);
  }
  return SALIDA.ok;
}

function cmdBuscar() {
  const consulta = posicionales.join(' ');
  if (!consulta) throw new UsoInvalido('Falta la consulta.');
  const idNormas = flags.norma ? [normaLocal(flags.norma)] : undefined;
  const r = abrir().buscar(consulta, { idNormas, limite: flags.limite ? Number(flags.limite) : 8, derogados: Boolean(flags.derogados) });
  if (comoJson) { json(r); return SALIDA.ok; }
  if (!r.length) { imprimir('Sin resultados. Prueba con sinónimos, raíces (cultiv*) u OR entre términos.'); return SALIDA.ok; }
  r.forEach((x, i) => {
    imprimir(`${i + 1}. ${x.citaSugerida}`);
    if (x.ruta) imprimir(`   Ruta: ${x.ruta}`);
    imprimir(`   idNorma ${x.idNorma} · idParte ${x.idParte} · ${x.link}`);
    imprimir(`   ${x.extracto}`);
  });
  return SALIDA.ok;
}

function cmdArticulo() {
  if (posicionales.length !== 2) throw new UsoInvalido('Uso: articulo "<referencia>" "<número>" (usa comillas, p. ej. articulo "ley 20000" "18 quater").');
  const [ref, numero] = posicionales;
  const id = normaLocal(ref);
  const d = abrir().articulo(id, numero, { cuerpo: flags.cuerpo });
  if (!d) {
    if (comoJson) json(null); else imprimir(`No encontré el artículo ${numero} en ${ref}. Para transitorios usa "${numero} transitorio".`);
    return SALIDA.error;
  }
  if (d.ambiguo) {
    if (comoJson) json(d);
    else if (d.porIdParte) {
      imprimir(`Hay varias partes numeradas como artículo ${numero} en esta norma:`);
      for (const c of d.ambiguo) imprimir(`  - ${c}`);
      imprimir('Ábrelas con: seccion <idParte>');
    } else {
      imprimir(`El artículo ${numero} existe en varios cuerpos legales de esta norma:`);
      for (const c of d.ambiguo) imprimir(`  - ${c}`);
      imprimir(`Repite con --cuerpo "<nombre>", p. ej. --cuerpo "${d.ambiguo.find((c) => !/^(Decreto|Ley)/.test(c)) ?? d.ambiguo[0]}".`);
    }
    return SALIDA.ambiguo;
  }
  if (comoJson) { json(d); return SALIDA.ok; }
  const p = d.partes[0];
  imprimir(`Cita sugerida: ${d.citaSugerida}`);
  imprimir(`Link: ${d.link}`);
  if (p.ruta) imprimir(`Ruta: ${p.ruta}`);
  imprimir('');
  imprimir(d.partes.map((x) => x.texto).join('\n\n'));
  imprimir('');
  if (d.reglamentos.length) {
    imprimir('Reglamentos que desarrollan este artículo:');
    for (const r of d.reglamentos) imprimir(`  - ${r.nombre} (idNorma ${r.idNorma}): ${r.titulo}`);
  }
  if (d.cita.length) imprimir(`Este artículo remite a: art. ${d.cita.join(', art. ')}`);
  if (d.citadoPor.length) imprimir(`Citado por: ${d.citadoPor.map((c) => `art. ${c.numero}${c.idNorma !== id ? ` (idNorma ${c.idNorma})` : ''}`).join(', ')}`);
  if (d.menciones.length) {
    imprimir('Menciona otras normas:');
    for (const m of d.menciones) {
      const arts = m.articulos.length ? ` (art. ${m.articulos.join(', art. ')})` : '';
      imprimir(`  - ${m.etiqueta}${arts} — ${estaCargada(m.ref) ? 'cargada' : `no cargada; si la respuesta depende de ella, pregunta al usuario y luego: cargar "${m.ref}"`}`);
    }
  }
  if (d.imagenes.length) {
    imprimir('Imágenes (tablas no buscables como texto):');
    for (const r of d.imagenes) imprimir(`  - ${r}`);
  }
  return SALIDA.ok;
}

function cmdSeccion() {
  const idParte = Number(posicionales[0]);
  if (!idParte) throw new UsoInvalido('Falta el idParte.');
  const s = abrir().seccion(idParte);
  if (!s) { imprimir(`No encontré la parte ${idParte}.`); return SALIDA.error; }
  if (comoJson) { json(s); return SALIDA.ok; }
  const n = abrir().norma(s.idNorma);
  imprimir(`${nombreNorma(n)} › ${s.ruta || '(raíz)'}`);
  for (const p of s.partes) {
    if (!p.texto) continue;
    imprimir('');
    imprimir(`[idParte ${p.idParte}${p.fragmento ? ` · fragmento ${p.fragmento}` : ''}${p.derogado ? ' · DEROGADO' : ''}]`);
    imprimir(p.texto);
  }
  const imgs = [...new Set(s.partes.map((p) => p.idParte))].flatMap((id) => abrir().imagenesDe(s.idNorma, id));
  if (imgs.length) { imprimir(''); imprimir('Imágenes:'); for (const r of imgs) imprimir(`  - ${r}`); }
  return SALIDA.ok;
}

function cmdVerificar() {
  const archivo = posicionales[0];
  if (!archivo) throw new UsoInvalido('Falta el archivo a verificar.');
  const r = verificarCitas(readFileSync(archivo, 'utf8'), abrir());
  if (comoJson) json(r);
  else {
    imprimir(`${r.citas} cita(s), ${r.literales} literal(es).`);
    if (r.ok) imprimir('Todas las citas son válidas.');
    for (const e of r.errores) imprimir(`✗ ${e.tipo}: ${e.detalle}`);
  }
  return r.ok ? SALIDA.ok : SALIDA.citasInvalidas;
}

function cmdEstado() {
  const lista = abrir().listar();
  const estado = { modo: 'sin API key (endpoints públicos de Ley Chile – BCN)', indice: home, node: process.versions.node,
    normas: lista.length, principales: lista.filter((n) => n.rol === 'principal').map((n) => n.nombre) };
  if (comoJson) { json(estado); return SALIDA.ok; }
  imprimir(`Modo: ${estado.modo}`);
  imprimir(`Índice: ${estado.indice}`);
  imprimir(`Node.js: ${estado.node}`);
  imprimir(`Normas cargadas: ${estado.normas}${estado.principales.length ? ` (principales: ${estado.principales.join(', ')})` : ''}`);
  return SALIDA.ok;
}

class UsoInvalido extends Error {}
class Salida extends Error { constructor(codigo) { super(`salida ${codigo}`); this.codigo = codigo; } }

const COMANDOS = {
  cargar: cmdCargar, reindexar: cmdReindexar, listar: cmdListar, buscar: cmdBuscar, articulo: cmdArticulo,
  seccion: cmdSeccion, 'verificar-citas': cmdVerificar, estado: cmdEstado,
};

let codigo;
try {
  const fn = COMANDOS[comando];
  if (!fn) {
    if (comando && comando !== 'ayuda' && comando !== '--help') console.error(`Comando desconocido: ${comando}\n`);
    imprimir(AYUDA);
    codigo = comando && comando !== 'ayuda' && comando !== '--help' ? SALIDA.error : SALIDA.ok;
  } else codigo = await fn();
} catch (e) {
  codigo = SALIDA.error;
  if (e instanceof Salida) codigo = e.codigo;
  else if (e instanceof ErrorBcn) console.error(`Error de BCN: ${e.message}${e.url ? ` (${e.url})` : ''}`);
  else if (e instanceof UsoInvalido) { console.error(e.message); imprimir(AYUDA); }
  else console.error(`Error inesperado: ${e.stack ?? e}`);
} finally {
  indice?.cerrar();
}
process.exitCode = codigo;
