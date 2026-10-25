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

- **Node.js 22.13 o superior** (usa `node:sqlite`, que viene incluido). No requiere paquetes npm.
- Acceso a internet hacia `leychile.cl` y `nuevo.leychile.cl`.
- No requiere API key. Usa los endpoints públicos que usa el propio sitio de Ley Chile. Como no están documentados, podrían cambiar.

## Instalación

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

Para ver todos los comandos, ejecuta `node scripts/ley-a-fondo.mjs ayuda`.

## Aviso legal

- Las respuestas **no son interpretación oficial de la BCN ni asesoría legal**.
- Los textos legales vienen de Ley Chile – Biblioteca del Congreso Nacional. Los contenidos de Ley Chile se publican bajo licencia CC BY-NC-ND 4.0, y los textos legales mismos están fuera del ámbito del derecho de autor. Cada respuesta cita la fuente y la fecha de obtención.
- La skill descarga solo lo que pides, más los reglamentos de esa norma. No replica Ley Chile, porque sus condiciones de uso lo prohíben.

## Desarrollo

```bash
npm test                                  # pruebas (node --test, sin dependencias)
node tests/fixtures/descargar.mjs --todos # vuelve a bajar los fixtures desde BCN
```

## Licencia

El código es MIT (ver [LICENSE](LICENSE)). Los textos legales descargados se rigen por las condiciones de Ley Chile – BCN.
