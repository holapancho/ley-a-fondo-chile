---
name: ley-a-fondo-chile
description: Explica a fondo normas chilenas (leyes, decretos, DFL, decretos ley, reglamentos y los códigos de la República) con citas verificables a cada artículo. Descarga la norma y todos sus reglamentos desde Ley Chile – Biblioteca del Congreso Nacional (BCN), los indexa en un índice local y responde citando norma, artículo, fecha de versión y link oficial. Úsala cuando pregunten qué dice, qué pena tiene o cómo se aplica una ley o decreto de Chile, o pidan ejemplos prácticos de una norma chilena. Chilean law, Chilean statutes and regulations.
license: MIT
compatibility: Requiere Node.js 24 o superior y acceso a internet (Ley Chile – BCN). No requiere API key ni paquetes npm.
---

# Ley a fondo (Chile)

Esta skill te permite responder preguntas sobre normas chilenas **con cada afirmación citada** y verificada contra el texto oficial de Ley Chile – BCN. Lo más importante es que la respuesta sea correcta: una respuesta bien escrita con un artículo equivocado o sin cita es un fracaso.

## El script

Todo se hace con un solo script, sin dependencias:

```bash
node <carpeta-de-esta-skill>/scripts/ley-a-fondo.mjs <comando> [argumentos]
```

| Comando | Para qué |
|---|---|
| `cargar <referencia>` | Descarga e indexa una norma **y todos sus reglamentos** (y el Mensaje si es un código). Tarda de 3 s a 2 min; espera a que termine. Al final lista las otras normas que menciona y que **no** cargó. |
| `cargar "codigo penal" --dependencia` | Carga solo el Código Penal, sin reglamentos, para traducir penas. |
| `listar` | Normas ya cargadas. |
| `buscar "<consulta>" [--norma <ref>] [--limite N] [--derogados]` | Búsqueda de texto completo (FTS5: admite `OR`, `"frases"` y prefijos `cultiv*`). |
| `articulo "<referencia>" "<número>" [--cuerpo "<cuerpo legal>"]` | Texto completo, cita sugerida, link, reglamentos, remisiones, otras normas mencionadas e imágenes. |
| `seccion <idParte>` | El párrafo o título completo donde está esa parte (para leer artículos vecinos, o abrir partes sin número). |
| `verificar-citas <archivo.md>` | Revisa que cada cita exista, que su etiqueta nombre la misma norma y artículo del link, y que cada literal «…» coincida con el texto oficial. |
| `reindexar <referencia>` o `reindexar --todas` | Vuelve a descargar y dice qué artículos cambiaron. |
| `estado` | Ubicación del índice y normas cargadas. |

Referencias válidas: `ley 20000`, `ley 16.744`, `codigo civil`, `código del trabajo`, `decreto 867 2008`, `dfl 1 2000`, un link de `bcn.cl/leychile` o un idNorma. Agrega `--json` a cualquier comando para obtener la salida como JSON.

**Códigos de salida:**
- `0`: ok.
- `1`: error. Cuéntale al usuario el mensaje. Si dice que no encontró la norma, pídele el link de BCN.
- `2`: hay varias opciones. En `cargar`, muéstrale al usuario la lista y **pregúntale cuál quiere; no adivines**. En `articulo`, repite con el `--cuerpo` que corresponda o, si la lista trae idParte, abre cada uno con `seccion <idParte>`.
- `4`: hay citas inválidas. Corrige la respuesta.

## Cómo responder una pregunta

1. **Revisa qué hay cargado** con `listar`. Si falta la norma por la que pregunta el usuario, cárgala con `cargar`. No cargues normas que nadie pidió.
2. **Reformula la pregunta en 2 a 4 búsquedas.** El buscador no entiende sinónimos ni conjugaciones, así que usa raíces con `*` y variantes con `OR`. Por ejemplo, "¿me pueden detener por tener 3 plantas?" se convierte en `cultiv* OR siembr* OR plant*`, `"consumo personal"`, `cannabis OR especies vegetales`. Usa `--norma` para acotar.
3. **Descarta el ruido.** Muchos resultados mencionan las palabras sin responder la pregunta.
4. **Abre completos los artículos relevantes** con `articulo`, y usa `seccion` para leer los artículos vecinos: ahí suelen estar las excepciones y las penas.
5. **Sigue los vínculos un nivel:**
   - Si `articulo` dice "Este artículo remite a: art. 1", ábrelo también. Ahí suele estar la pena.
   - Revisa los "Reglamentos que desarrollan este artículo".
   - Si `articulo` dice "Menciona otras normas" y la respuesta **depende** de una que está "no cargada", **pregúntale al usuario antes de cargarla**. Dile cuál es y por qué la necesitas, por ejemplo: "La circular remite al art. 107 de la Ley sobre Impuesto a la Renta (DL 824), que no está cargada. ¿La cargo?". Solo si acepta, usa el comando `cargar` que sugiere el script. Si no acepta, responde con lo que tienes y di qué parte queda sin respuesta. No cargues normas mencionadas por una norma que tú mismo cargaste de esta forma (un solo nivel).
6. **Si la respuesta involucra penas** expresadas en grados ("presidio menor en su grado medio"), carga el Código Penal con `cargar "codigo penal" --dependencia` y busca ahí la duración de esa pena (por ejemplo, `buscar "presidio menor" --norma "codigo penal"`). Cita también esos artículos; no traduzcas penas de memoria.
7. **Si la respuesta depende de una tabla en imagen** (`articulo` o `seccion` listan "Imágenes"), mírala si puedes leer imágenes. Advierte que el dato sale de una imagen y entrega el link a BCN.
8. **Redacta la respuesta** siguiendo [references/formato-respuesta.md](references/formato-respuesta.md).
9. **Verifica antes de entregar.** Guarda el borrador en un archivo temporal y ejecuta `verificar-citas <archivo>`. Si sale con código 4, corrige y repite hasta que salga 0.
10. **Entrega la respuesta.**

## Reglas que no se rompen

- **Toda afirmación sobre lo que dice una norma lleva cita**, con un link que incluya `idNorma` e `idParte`. Usa la "cita sugerida" que entrega el script, que ya trae las fechas de versión.
- **Copia cada link tal cual lo entrega `articulo` o `buscar`. Nunca escribas ni adivines un `idParte`:** los números son correlativos y un dígito de diferencia apunta a otro artículo. Si no tienes el link de un artículo, ábrelo con `articulo`.
- **Las penas van con el texto literal** entre «», seguido de su cita.
- **Los ejemplos prácticos van rotulados como hipotéticos** y separados de lo que dice la ley.
- **Si el texto cargado no responde la pregunta, dilo.** No completes con conocimiento general como si fuera de la norma.
- **Nunca presentes la respuesta como interpretación oficial de la BCN** ni como asesoría legal. Toda respuesta termina con el cierre que indica el formato.
- **Responde en el idioma de la pregunta**, pero deja las citas literales en español, tal como en el original.
- **No inventes el valor de la UTM** ni de otras unidades que cambian mes a mes. Di que hay que consultarlo.
- **Los artículos derogados no aparecen en las búsquedas.** Si citas uno (con `--derogados`), dilo explícitamente.
- **No descargues de forma masiva:** solo lo que el usuario pide, sus reglamentos, el Código Penal cuando hacen falta las penas y las normas mencionadas que el usuario autorice. Las condiciones de uso de BCN prohíben replicar Ley Chile.

## Casos especiales

Los artículos transitorios ("4 transitorio"), los cuerpos legales dentro de un código (`--cuerpo`), los anexos, las tablas en imagen, la numeración bis/ter/quáter y las fechas de versión están explicados en [references/casos-especiales.md](references/casos-especiales.md).
