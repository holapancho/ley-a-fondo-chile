// Evalúa una respuesta contra una pregunta de evals/preguntas.json.
// Uso: node evals/verificar.mjs <id> <respuesta.md>   (usa el índice de LEY_A_FONDO_HOME o ~/.ley-a-fondo-chile)
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verificarCitas } from '../skills/ley-a-fondo-chile/scripts/lib/citas.mjs';

const RE_LINK = /navegar\?idNorma=(\d+)&(?:amp;)?idParte=(\d+)/g;

export function evaluar(pregunta, markdown, indice) {
  const citados = new Set([...markdown.matchAll(RE_LINK)].map((m) => `${m[1]}:${m[2]}`));
  const faltantes = [];
  for (const e of pregunta.articulosEsperados) {
    const d = indice.articulo(e.idNorma, e.numero, { cuerpo: e.cuerpo });
    const idParte = d && !d.ambiguo ? d.partes[0].idParte : null;
    if (!idParte || !citados.has(`${e.idNorma}:${idParte}`)) faltantes.push(`${e.idNorma} art. ${e.numero}`);
  }
  if (pregunta.anexoEsperado) {
    const id = pregunta.anexoEsperado.idNorma;
    const citaAnexo = [...citados].some((c) => {
      const [n, p] = c.split(':').map(Number);
      return n === id && indice.parte(n, p)?.tipo === 'Anexo';
    });
    if (!citaAnexo) faltantes.push(`${id} Anexo`);
  }
  const sinContenido = (pregunta.debeContener ?? []).filter((re) => !new RegExp(re, 'i').test(markdown));
  const prohibido = (pregunta.noDebeContener ?? []).filter((re) => new RegExp(re, 'i').test(markdown));
  const citas = verificarCitas(markdown, indice);
  const total = pregunta.articulosEsperados.length + (pregunta.anexoEsperado ? 1 : 0);
  return {
    ok: !faltantes.length && !sinContenido.length && !prohibido.length && citas.ok,
    cobertura: `${total - faltantes.length}/${total}`,
    faltantes, sinContenido, prohibido, citas,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [id, archivo] = process.argv.slice(2);
  if (!id || !archivo) { console.error('Uso: node evals/verificar.mjs <id> <respuesta.md>'); process.exit(1); }
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const pregunta = JSON.parse(readFileSync(path.join(aqui, 'preguntas.json'), 'utf8')).find((p) => p.id === id);
  if (!pregunta) { console.error(`No existe la pregunta ${id}`); process.exit(1); }
  const emitir = process.emitWarning;
  process.emitWarning = (aviso, ...resto) => (/SQLite/i.test(String(aviso?.message ?? aviso)) ? undefined : emitir.call(process, aviso, ...resto));
  const { abrirIndice } = await import('../skills/ley-a-fondo-chile/scripts/lib/indice.mjs');
  const home = process.env.LEY_A_FONDO_HOME ?? path.join(os.homedir(), '.ley-a-fondo-chile');
  const indice = abrirIndice(path.join(home, 'indice.db'), path.join(home, 'normas'));
  const r = evaluar(pregunta, readFileSync(archivo, 'utf8'), indice);
  indice.cerrar();
  console.log(`${id}: ${r.ok ? 'OK' : 'FALLA'} · cobertura ${r.cobertura} · ${r.citas.citas} citas, ${r.citas.literales} literales`);
  for (const f of r.faltantes) console.log(`  falta citar: ${f}`);
  for (const s of r.sinContenido) console.log(`  falta mencionar: /${s}/`);
  for (const p of r.prohibido) console.log(`  no debería decir: /${p}/`);
  for (const e of r.citas.errores) console.log(`  ✗ ${e.tipo}: ${e.detalle}`);
  process.exitCode = r.ok ? 0 : 1;
}
