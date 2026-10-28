# ley-a-fondo-chile

Skill para agentes de IA (formato [Agent Skills](https://agentskills.io)) que ayuda a **entender a fondo normas chilenas**: leyes, decretos, DFL, decretos ley, reglamentos y los códigos de la República. Cada afirmación lleva su cita, verificada contra el texto oficial de **Ley Chile – Biblioteca del Congreso Nacional (BCN)**.

Funciona con Claude Code, Codex, Cursor y otros agentes compatibles con Agent Skills.

## Qué hace

1. Le pides al agente, por ejemplo, "carga la ley 20.000" o "carga el código del trabajo".
2. La skill descarga la norma desde BCN **junto con todos sus reglamentos** (y el Mensaje, si es un código) y los guarda en un índice local en `~/.ley-a-fondo-chile/`.
3. Le preguntas, por ejemplo, "¿cuáles son las penas por porte de droga?".
4. El agente busca en el índice, lee los artículos completos, sigue las remisiones y los reglamentos, y responde con:
   - una tabla resumen y el detalle caso a caso,
   - **citas a cada artículo**, con su fecha de versión y el link oficial,
   - el texto literal de las penas,
   - ejemplos prácticos marcados como hipotéticos.
5. Si la respuesta depende de **otra norma que el texto menciona** (por ejemplo, "el artículo 107 de la LIR"), el agente **te pregunta antes de cargarla**. Solo sigue un nivel de menciones.
6. Antes de responder, el agente verifica sus citas con `verificar-citas`. Revisa tres cosas:
   - que cada artículo citado exista;
   - que la etiqueta de cada link nombre la misma norma y el mismo artículo al que apunta;
   - que cada texto entre «» coincida exactamente con el oficial.

## Limitaciones conocidas

- **Solo la versión vigente:** no se pueden consultar versiones anteriores de una norma.
- **Tablas en imagen:** algunas tablas, como la escala de penas del art. 56 del Código Penal, están publicadas como imagen. Sus datos no se pueden verificar como texto, y el agente lo advierte.
- **Normas fuera de Ley Chile:** las normas que no están en Ley Chile (por ejemplo, las de la CMF) no se pueden cargar. De algunas circulares, BCN solo publica un extracto.
- **Decretos ley:** la búsqueda de BCN no siempre encuentra un decreto ley por su número; en ese caso hay que usar el link de la norma.

## Requisitos

- **Node.js 24 o superior** (usa `node:sqlite` con FTS5, que viene incluido). No requiere paquetes npm.
- Acceso a internet hacia `leychile.cl` y `nuevo.leychile.cl`.
- No requiere API key. Usa los endpoints públicos que usa el propio sitio de Ley Chile. Como no están documentados, podrían cambiar.

## Instalación

Página del proyecto: **https://holapancho.github.io/ley-a-fondo-chile/**

### Claude Code (plugin)

Este repositorio es también un marketplace de plugins de Claude Code. Dentro de Claude Code:

```
/plugin marketplace add holapancho/ley-a-fondo-chile
/plugin install ley-a-fondo-chile@ley-a-fondo-chile
```

En Claude Code 2.1.275 o superior también funciona en un solo paso:

```
/plugin install ley-a-fondo-chile --marketplace holapancho/ley-a-fondo-chile
```

### Codex, Cursor y otros agentes (Agent Skills)

Con el instalador [`npx skills`](https://github.com/vercel-labs/skills), que necesita Node.js 22.20 o superior:

```bash
npx skills add holapancho/ley-a-fondo-chile                 # detecta tus agentes
npx skills add holapancho/ley-a-fondo-chile -a codex -g     # solo Codex, para todos tus proyectos
npx skills add holapancho/ley-a-fondo-chile -a cursor       # solo Cursor, en este proyecto
```

Para fijar una versión: `npx skills add https://github.com/holapancho/ley-a-fondo-chile/tree/v0.1.0`.

### claude.ai

Descarga [`ley-a-fondo-chile.zip`](https://github.com/holapancho/ley-a-fondo-chile/releases/latest/download/ley-a-fondo-chile.zip) y súbelo en la sección de Skills de la configuración de claude.ai. La ejecución de código tiene que tener acceso a internet hacia `leychile.cl` y `nuevo.leychile.cl`.

### Manual

Copia la carpeta [`skills/ley-a-fondo-chile`](skills/ley-a-fondo-chile) a la carpeta de skills de tu agente. Por ejemplo, en Claude Code: `~/.claude/skills/ley-a-fondo-chile` (para todos tus proyectos) o `.claude/skills/ley-a-fondo-chile` (para un proyecto).

Prueba que funciona:

```bash
node ~/.claude/skills/ley-a-fondo-chile/scripts/ley-a-fondo.mjs estado
```

## Uso directo del script

```bash
node scripts/ley-a-fondo.mjs cargar ley 20000
node scripts/ley-a-fondo.mjs buscar "pequeñas cantidades" --norma "ley 20000"
node scripts/ley-a-fondo.mjs articulo "ley 20000" "4"
node scripts/ley-a-fondo.mjs articulo "codigo civil" "1437" --cuerpo "Código Civil"
node scripts/ley-a-fondo.mjs reindexar --todas
```

Para ver todos los comandos, ejecuta `node scripts/ley-a-fondo.mjs ayuda`. La referencia completa, con opciones, ejemplos de salida y códigos de salida, está en [documentacion/comandos.md](documentacion/comandos.md).

## Documentación

- [Comandos](documentacion/comandos.md): referencia de cada comando del script.
- [Arquitectura](documentacion/arquitectura.md): cómo se carga, guarda y consulta una norma por dentro.
- [Fuentes de BCN](documentacion/fuentes-bcn.md): los endpoints que usa la skill, sus rarezas y qué hacer si cambian.
- [Decisiones de diseño](documentacion/decisiones.md): qué busca el proyecto, qué deja fuera y por qué.

## Aviso legal

- Las respuestas **no son interpretación oficial de la BCN ni asesoría legal**.
- Los textos legales vienen de Ley Chile – Biblioteca del Congreso Nacional. Los contenidos de Ley Chile se publican bajo licencia CC BY-NC-ND 4.0, y los textos legales mismos están fuera del ámbito del derecho de autor. Cada respuesta cita la fuente y la fecha de obtención.
- La skill descarga solo lo que pides, más los reglamentos de esa norma. No replica Ley Chile, porque sus condiciones de uso lo prohíben.

## Desarrollo

```bash
npm test                                  # pruebas (node --test, sin dependencias ni internet)
npm run test:vivo                         # pruebas contra Ley Chile – BCN real (usa internet)
node tests/fixtures/descargar.mjs --todos # vuelve a bajar los fixtures desde BCN
npm run empaquetar                        # genera dist/ley-a-fondo-chile.zip
claude plugin validate . --strict         # valida el marketplace y el plugin de Claude Code
```

GitHub Actions corre `npm test` y valida el plugin en cada push y PR (`.github/workflows/pruebas.yml`). Además corre `npm run test:vivo` cada lunes y abre un issue si BCN cambió algo (`bcn-vivo.yml`).

### Publicar una versión

1. Sube la versión en `package.json` y en `.claude-plugin/plugin.json`, y agrega su sección en `CHANGELOG.md`. Un test revisa que las tres coincidan.
2. Haz merge a `main` y crea el tag: `git tag v0.2.0 && git push origin v0.2.0`.
3. El workflow `publicar.yml` corre las pruebas y crea el release con el `.zip` y las notas del CHANGELOG.

La página (`docs/`) se publica sola en GitHub Pages con cada cambio en `main` (`pagina.yml`).

## Licencia

El código es MIT (ver [LICENSE](LICENSE)). Los textos legales descargados se rigen por las condiciones de Ley Chile – BCN.
