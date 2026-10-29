# Referencia de comandos

Todo se hace con un solo script, sin dependencias:

```bash
node skills/ley-a-fondo-chile/scripts/ley-a-fondo.mjs <comando> [argumentos] [--json]
```

Si instalaste la skill, el script está en la carpeta de la skill, por ejemplo `~/.claude/skills/ley-a-fondo-chile/scripts/ley-a-fondo.mjs`. En los ejemplos de este documento se abrevia como `ley-a-fondo`.

Requiere **Node.js 24 o superior**. Con una versión anterior el script se detiene con un mensaje que indica la versión instalada.

| Comando | Usa internet | Para qué |
|---|---|---|
| [`cargar`](#cargar) | Sí | Descarga e indexa una norma con sus reglamentos |
| [`reindexar`](#reindexar) | Sí | Vuelve a descargar normas cargadas y dice qué cambió |
| [`listar`](#listar) | No | Normas cargadas |
| [`buscar`](#buscar) | No | Búsqueda de texto completo en lo cargado |
| [`articulo`](#articulo) | No | Un artículo completo, con su cita y sus vínculos |
| [`seccion`](#seccion) | No | El párrafo o título que contiene una parte |
| [`verificar-citas`](#verificar-citas) | No | Revisa las citas de una respuesta en Markdown |
| [`estado`](#estado) | No | Ubicación del índice, versión de Node y normas cargadas |

Sin comando, con `ayuda` o con `--help`, el script muestra la ayuda y termina con código 0. Con un comando que no existe, muestra la ayuda y termina con código 1.

## Referencias a normas

Los comandos que reciben una norma (`cargar`, `reindexar`, `buscar --norma`, `articulo`) aceptan:

| Forma | Ejemplos |
|---|---|
| Tipo y número | `ley 20000`, `ley 20.000`, `ley N° 16.744` |
| Tipo, número y año de publicación | `decreto 867 2008`, `dfl 1 2000` |
| Código, por su nombre | `codigo civil`, `código del trabajo`, `codigo penal` |
| Link de Ley Chile | `https://www.bcn.cl/leychile/navegar?idNorma=235507` |
| idNorma | `235507` |

Tipos reconocidos: `ley`; `decreto`, `dto.`, `ds`, `d.s.`; `decreto ley`, `dl`, `d.l.`; `decreto con fuerza de ley`, `dfl`, `d.f.l.`. No importan las mayúsculas, las tildes ni los puntos del número.

Un código pedido por su idNorma o por su link se cita igual que si se pidiera por su nombre.

`cargar` busca la referencia en Ley Chile. Los demás comandos la buscan **solo entre las normas ya cargadas**, sin usar internet. Si la norma no está cargada, responden con código 1 y sugieren el `cargar` que corresponde.

## Opciones comunes

- `--json`: entrega el resultado como JSON por la salida estándar. El progreso de `cargar` y `reindexar` pasa a la salida de error, para no mezclarse con el JSON.

## Códigos de salida

| Código | Significado | Qué hacer |
|---|---|---|
| `0` | Todo bien | |
| `1` | Error: norma no encontrada o no cargada, argumentos inválidos, falla de BCN | Leer el mensaje. Si no encontró la norma, probar con su link de BCN o su idNorma |
| `2` | Hay varias opciones y hay que elegir | En `cargar`, elegir un idNorma de la lista. En `articulo`, repetir con `--cuerpo` o abrir cada parte con `seccion` |
| `4` | `verificar-citas` encontró citas inválidas | Corregir la respuesta y volver a verificar |

## Dónde se guardan los datos

El índice vive en `~/.ley-a-fondo-chile/` (en Windows, `C:\Users\<usuario>\.ley-a-fondo-chile\`):

- `indice.db`: base SQLite con el texto de cada parte, un índice de búsqueda FTS5 y los vínculos entre normas.
- `normas/`: imágenes de las tablas que BCN publica como imagen.

Se puede cambiar con variables de entorno:

| Variable | Valor por omisión | Para qué |
|---|---|---|
| `LEY_A_FONDO_HOME` | `~/.ley-a-fondo-chile` | Carpeta del índice |
| `LEY_A_FONDO_PAUSA_MS` | `1000` | Milisegundos de pausa entre solicitudes a BCN |

Para empezar de cero, borra la carpeta del índice.

---

## cargar

```
cargar <referencia> [--dependencia]
```

Descarga una norma desde Ley Chile y la indexa junto con **todos sus reglamentos**. Si es un código, también carga su Mensaje (la exposición de motivos). Tarda de 3 segundos a 2 minutos, según la cantidad de reglamentos, porque espera `LEY_A_FONDO_PAUSA_MS` entre solicitudes.

Al terminar, lista las otras normas que la norma menciona y que **no** se cargaron, con el comando para cargar cada una. No las carga solo: la skill le pregunta al usuario antes.

```console
$ ley-a-fondo cargar ley 20000
[1/10] Ley 20.000… 84 artículos ✓
[2/10] Decreto 194… ✗ BCN respondió HTTP 429
[3/10] Decreto 169… ✗ BCN respondió HTTP 429
[4/10] Decreto 820 de 2012… 25 artículos ✓
…
[10/10] Decreto 142 de 2005… 1 artículos ✓
Listo: 8 norma(s) cargada(s) en /home/usuario/.ley-a-fondo-chile.
Advertencia: No se pudo cargar Decreto 194 (idNorma 1210887): BCN respondió HTTP 429
Advertencia: No se pudo cargar Decreto 169 (idNorma 1086742): BCN respondió HTTP 429
Esta norma menciona otras normas que NO se cargaron (pregúntale al usuario antes de cargar alguna):
  - Código Procesal Penal (en 20 parte(s)) → cargar "codigo procesal penal"
  - Ley 19.366 (en 9 parte(s)) → cargar "ley 19366"
  - Código Penal (en 6 parte(s)) → cargar "codigo penal"
  …
  … y 11 más.
```

**Opciones**

- `--dependencia`: carga solo la norma, sin reglamentos ni Mensaje. Sirve para normas de apoyo, como el Código Penal cuando hay que traducir los grados de una pena. Si la norma ya estaba cargada, no hace nada.

**Comportamiento**

- Si la norma ya estaba cargada, avisa "La norma ya estaba cargada.".
- Si un reglamento falla (por ejemplo, BCN responde `429` por exceso de solicitudes), la carga sigue con los demás y termina con código 0, pero deja una advertencia por cada reglamento que faltó. Para completarlos, ejecuta [`reindexar`](#reindexar) sobre la misma norma. Si pasa seguido, sube `LEY_A_FONDO_PAUSA_MS`.
- Si la norma principal está derogada, lo advierte.

**Salidas**

- `0`: cargada.
- `1`: no la encontró en Ley Chile. Prueba con el link de la norma o su idNorma.
- `2`: la referencia coincide con varias normas, por ejemplo un decreto sin año. Muestra los candidatos con su idNorma, tipo, número, fecha de publicación y título. Repite con el idNorma que corresponda.

## reindexar

```
reindexar <referencia>
reindexar --todas
```

Vuelve a descargar normas ya cargadas y compara. Por cada norma informa `sin cambios`, `actualizada` (con los artículos que cambiaron) o `ERROR`. Para una norma principal, además revisa su lista de reglamentos en BCN: carga los nuevos y desvincula los que BCN ya no asocia.

```console
$ ley-a-fondo reindexar "ley 20000"
Ley 20.000: sin cambios
Decreto 194 de 2025: actualizada
Decreto 169 de 2016: actualizada
Decreto 820 de 2012: sin cambios
…
Reglamentos nuevos: 1210887, 1086742
```

En este ejemplo, los dos reglamentos que habían fallado en `cargar` aparecen como nuevos y quedan cargados.

**Opciones**

- `--todas`: reindexa todas las normas principales y de dependencia, con sus reglamentos.

**Salidas**

- `0`: terminó sin errores.
- `1`: la norma no está cargada, o alguna descarga falló.

## listar

```
listar
```

Muestra las normas cargadas: nombre, idNorma, rol, si está derogada, fecha de la versión, fecha en que se descargó, cantidad de partes y, para los reglamentos, el idNorma de la norma a la que pertenecen.

```console
$ ley-a-fondo listar
Decreto 539 de 2006 (idNorma 254655) · reglamento · DEROGADA · versión 2006-10-28 · obtenido 2026-10-28 · 31 partes · de 235507
Decreto 867 de 2008 (idNorma 269323) · reglamento · versión 2023-09-16 · obtenido 2026-10-28 · 19 partes · de 235507
…
Ley 20.000 (idNorma 235507) · principal · versión 2026-05-23 · obtenido 2026-10-28 · 105 partes
```

Los roles son:

- `principal`: la norma que se pidió con `cargar`.
- `reglamento`: un reglamento de una norma principal.
- `mensaje`: el Mensaje de un código.
- `dependencia`: una norma cargada con `--dependencia`.

## buscar

```
buscar "<consulta>" [--norma <referencia>] [--limite N] [--derogados]
```

Busca texto en todas las normas cargadas con FTS5 de SQLite. Ordena por relevancia y devuelve, por cada resultado, la cita sugerida, la ruta dentro de la norma, el idNorma, el idParte, el link a BCN y un extracto con los términos encontrados entre `[corchetes]`.

```console
$ ley-a-fondo buscar "cultiv* OR siembr*" --norma "ley 20000" --limite 3
1. Ley 20.000, art. 8 (texto desde 2023-05-23; versión de la norma 2026-05-23)
   Ruta: TITULO I De los delitos y sanciones › Párrafo 1º De los crímenes y simples delitos
   idNorma 235507 · idParte 8652186 · https://www.bcn.cl/leychile/navegar?idNorma=235507&idParte=8652186
   Artículo 8º.- El que, careciendo de la debida autorización, [siembre], plante, [cultive] o coseche especies vegetales del género cannabis u otras productoras de sustancias…
```

**Sintaxis de la consulta**

El buscador no entiende sinónimos ni conjugaciones. Usa:

| Sintaxis | Ejemplo | Encuentra |
|---|---|---|
| Palabras sueltas | `consumo personal` | Partes que tienen ambas palabras |
| Frase exacta | `"consumo personal"` | La frase tal cual |
| Prefijo | `cultiv*` | cultivo, cultive, cultivar… |
| Alternativas | `cannabis OR marihuana` | Cualquiera de las dos |

Si la consulta tiene un error de sintaxis FTS5, el script la reintenta como una búsqueda de cualquiera de sus palabras (`OR`), cada una entre comillas.

**Opciones**

- `--norma <referencia>`: busca solo en esa norma. Debe estar cargada.
- `--limite N`: cantidad máxima de resultados. Por omisión, 8.
- `--derogados`: incluye partes derogadas, que por omisión se excluyen.

Sin resultados, sugiere probar con sinónimos, prefijos u `OR`, y termina con código 0.

## articulo

```
articulo "<referencia>" "<número>" [--cuerpo "<cuerpo legal>"]
```

Muestra un artículo completo. La referencia y el número van entre comillas, cada uno como un solo argumento.

```console
$ ley-a-fondo articulo "ley 20000" "4"
Cita sugerida: Ley 20.000, art. 4 (texto desde 2026-05-23; versión de la norma 2026-05-23)
Link: https://www.bcn.cl/leychile/navegar?idNorma=235507&idParte=8652182
Ruta: TITULO I De los delitos y sanciones › Párrafo 1º De los crímenes y simples delitos

Artículo 4º.- El que, sin la competente autorización
posea, transporte, guarde o porte consigo pequeñas
cantidades de sustancias o drogas estupefacientes o
…

Este artículo remite a: art. 1
Citado por: art. 5, art. 6, art. 7
Menciona otras normas:
  - Ley 19.366 — no cargada; si la respuesta depende de ella, pregunta al usuario y luego: cargar "ley 19366"
```

Además del texto, puede incluir:

- **Reglamentos que desarrollan este artículo**, según los vínculos que publica BCN.
- **Este artículo remite a**: otros artículos de la misma norma que el texto menciona.
- **Citado por**: artículos que mencionan a este.
- **Menciona otras normas**: cada una indica si está cargada y, si no, cómo cargarla.
- **Imágenes**: rutas locales de tablas publicadas como imagen, que no se pueden buscar como texto.

**Número del artículo**

- Admite `1`, `1º`, `18 quater`, `18 quáter`, `5 bis`, etc.
- Para un artículo transitorio, agrega `transitorio`: `"4 transitorio"`.

**Opciones**

- `--cuerpo "<cuerpo legal>"`: elige el cuerpo legal cuando una norma contiene varios con el mismo número de artículo. Por ejemplo, el Código Civil es el DFL 1 de 2000, que contiene seis cuerpos legales con su propia numeración: `articulo "codigo civil" "1437" --cuerpo "Código Civil"`. El nombre no distingue mayúsculas ni tildes.

Otros casos (leyes dentro de un artículo, partes sin número, la Ñ en la numeración) están en [casos especiales](../skills/ley-a-fondo-chile/references/casos-especiales.md).

**Salidas**

- `0`: encontrado.
- `1`: el artículo no existe en esa norma, o la norma no está cargada.
- `2`: hay varias partes con ese número. Si se distinguen por cuerpo legal, lista los cuerpos para repetir con `--cuerpo`. Si no, lista la ruta y el idParte de cada una para abrirlas con [`seccion`](#seccion).

## seccion

```
seccion <idParte>
```

Muestra el párrafo o título completo que contiene una parte. Si la parte es un artículo, muestra todo el párrafo donde está, con los artículos vecinos. Sirve para leer el contexto (las excepciones y penas suelen estar en artículos cercanos) y para abrir partes sin número.

Cada parte va precedida de su idParte, y se marca si es un fragmento o si está derogada.

```console
$ ley-a-fondo seccion 8652186
Ley 20.000 › TITULO I De los delitos y sanciones

[idParte 8652179]
Párrafo 1º

      De los crímenes y simples delitos

[idParte 8652177]
Artículo 1º.- Los que elaboren, fabriquen,
…
```

El idParte se obtiene de `buscar`, de `articulo` o del link de BCN (`…&idParte=8652186`).

**Salidas**

- `0`: encontrada.
- `1`: no existe ninguna parte con ese idParte entre las normas cargadas.

## verificar-citas

```
verificar-citas <archivo.md>
```

Revisa una respuesta escrita en Markdown contra el índice local. La skill lo usa antes de entregar cada respuesta.

Una **cita** es un link a Ley Chile con `idNorma` e `idParte`:

```markdown
[Ley 20.000, art. 8](https://www.bcn.cl/leychile/navegar?idNorma=235507&idParte=8652186)
```

Un **literal** es un texto entre «comillas latinas», seguido en el mismo párrafo por su cita. Dentro del literal, `…` o `...` marca una omisión.

```markdown
El art. 8 castiga a quien «siembre, plante, cultive o coseche especies vegetales del género cannabis» sin autorización ([Ley 20.000, art. 8](https://www.bcn.cl/leychile/navegar?idNorma=235507&idParte=8652186)).
```

**Qué revisa**

| Error | Cuándo aparece |
|---|---|
| `sin-citas` | La respuesta no tiene ninguna cita a BCN |
| `parte-inexistente` | El link apunta a una parte que no está en el índice |
| `etiqueta-no-coincide` | El texto del link nombra otra norma u otro artículo que el que abre el link |
| `parte-derogada` | Cita una parte derogada y la etiqueta no lo dice |
| `literal-sin-cita` | Un literal «…» no tiene una cita después, en el mismo párrafo |
| `literal-en-contenedor` | El literal se cita a un título o párrafo en vez de al artículo |
| `literal-no-coincide` | El literal no aparece en el texto de la parte citada |

La comparación de literales ignora mayúsculas, espacios repetidos, el tipo de comillas y las notas al margen que BCN agrega al final de algunas líneas. Las líneas citadas con `>` se revisan igual.

```console
$ ley-a-fondo verificar-citas respuesta.md
2 cita(s), 2 literal(es).
✗ literal-no-coincide: «el que cultive tomates» no aparece en Ley 20.000, art. 10
```

**Salidas**

- `0`: todas las citas son válidas.
- `4`: hay al menos un error.

## estado

```
estado
```

Muestra el modo de funcionamiento, la carpeta del índice, la versión de Node.js y cuántas normas hay cargadas, con las principales.

```console
$ ley-a-fondo estado
Modo: sin API key (endpoints públicos de Ley Chile – BCN)
Índice: /home/usuario/.ley-a-fondo-chile
Node.js: 24.14.1
Normas cargadas: 8 (principales: Ley 20.000)
```

Con `--json`:

```json
{
  "modo": "sin API key (endpoints públicos de Ley Chile – BCN)",
  "indice": "/home/usuario/.ley-a-fondo-chile",
  "node": "24.14.1",
  "normas": 8,
  "principales": ["Ley 20.000"]
}
```
