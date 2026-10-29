# AGENTS.md

Instrucciones para agentes de código que trabajan en este repositorio. Si buscas cómo **usar** la skill, eso está en [`skills/ley-a-fondo-chile/SKILL.md`](skills/ley-a-fondo-chile/SKILL.md).

## Qué es

Una skill (formato [Agent Skills](https://agentskills.io)) que descarga normas chilenas desde Ley Chile – BCN, las indexa en SQLite local y le entrega al agente lo necesario para responder con citas verificables. Lo más importante del proyecto es que las respuestas sean correctas y estén citadas; ver [documentacion/decisiones.md](documentacion/decisiones.md).

## Estructura

| Ruta | Contenido |
|---|---|
| `skills/ley-a-fondo-chile/` | La skill: `SKILL.md`, `references/` (instrucciones para el agente), `scripts/` (el CLI y sus módulos en `lib/`) y `assets/`. Es lo único que va en el `.zip` |
| `tests/` | Pruebas con `node:test`. `fixtures/` tiene respuestas reales de BCN; `vivo/` prueba contra BCN real |
| `evals/` | Preguntas con respuesta esperada para medir la calidad de las respuestas del agente |
| `documentacion/` | Documentación para personas: comandos, arquitectura, fuentes de BCN y decisiones |
| `sitio/` | Página del proyecto en GitHub Pages, en español (`index.html`) y en inglés (`en/index.html`) |
| `.claude-plugin/` | Manifiestos del plugin y del marketplace de Claude Code |

## Comandos

```bash
npm test                                  # todas las pruebas; sin internet
npm run test:vivo                         # pruebas contra BCN real; usa internet
node tests/fixtures/descargar.mjs         # baja los fixtures que falten
npm run empaquetar                        # genera dist/ley-a-fondo-chile.zip
claude plugin validate . --strict         # valida el plugin y el marketplace
```

Corre `npm test` antes de cada commit. El CI exige que pasen `npm test (Node 24)` y la validación del plugin.

## Reglas

**Código**
- Node.js 24 o superior, **sin paquetes npm**. Solo módulos de Node (`node:sqlite`, `fetch`, `node:test`). No agregues dependencias.
- Módulos ES (`.mjs`). Nombres de variables, funciones, mensajes y comentarios **en español**, como el código existente.
- Los mensajes del CLI los lee un agente: deben decir qué pasó y qué hacer después. Respeta los códigos de salida (0 ok, 1 error, 2 ambiguo, 4 citas inválidas); `SKILL.md` depende de ellos.

**Pruebas**
- `npm test` no usa internet. Usa los fixtures de `tests/fixtures/` y el servidor simulado de `tests/helpers/servidor-bcn.mjs`.
- Si BCN cambia un formato, agrega la respuesta nueva como fixture (descárgala con `tests/fixtures/descargar.mjs`) y una prueba que la use. No reemplaces fixtures sin revisar qué pruebas cambian.
- Todo arreglo de un caso raro de BCN lleva su prueba.

**BCN**
- No descargues de forma masiva: las condiciones de uso de Ley Chile lo prohíben. Mantén la pausa entre solicitudes y no agregues cargas automáticas de normas que el usuario no pidió.
- Los endpoints y sus rarezas están en [documentacion/fuentes-bcn.md](documentacion/fuentes-bcn.md). Si cambias `fuentes.mjs` o `parser.mjs`, actualiza ese documento.

**La skill**
- `SKILL.md` debe tener menos de 500 líneas y su frontmatter debe seguir el formato de Agent Skills; hay pruebas que lo revisan.
- Dentro de `skills/` va solo lo que el agente necesita para usar la skill. La documentación para personas va en `documentacion/`: todo lo que está en `skills/` gasta contexto del agente y agranda el `.zip`.
- Si cambias un comando del CLI, actualiza `SKILL.md` y [documentacion/comandos.md](documentacion/comandos.md).
- En evals y ejemplos, los links de las citas se copian de la salida del script; nunca se escribe un `idParte` a mano.

**Página**
- Un cambio de contenido en `sitio/index.html` va también en `sitio/en/index.html`. Las dos páginas comparten el CSS, copiado en cada archivo.

## Versiones y publicación

- La versión está en `package.json`, `.claude-plugin/plugin.json` y `CHANGELOG.md`; un test revisa que coincidan. Anota los cambios en la sección `[Sin publicar]` del CHANGELOG.
- Para publicar, sigue "Publicar una versión" en el [README](README.md#publicar-una-versión). La publicación en npm (`npm publish`) es manual y la hace el dueño del proyecto.
- El campo `files` de `package.json` define qué va al paquete de npm. Si agregas una carpeta que el agente necesita, va dentro de `skills/`, no en la raíz.

## Git

- `main` está protegido: los cambios entran por PR y el merge exige el CI en verde.
- Mensajes de commit en español, con el verbo en tercera persona del presente y sin prefijos: "Agrega …", "Documenta …", "Exige …". El cuerpo explica el porqué.
