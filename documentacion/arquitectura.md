# Arquitectura

Cómo funciona la skill por dentro: qué pasa al cargar una norma, cómo se guarda y cómo se consulta. Para el uso de cada comando, ver [comandos.md](comandos.md). Para los servicios de BCN que se usan, ver [fuentes-bcn.md](fuentes-bcn.md).

## Piezas

La skill tiene dos partes:

- **`SKILL.md` y `references/`**: instrucciones para el agente. Le dicen cómo buscar, qué abrir, cómo citar y cómo verificar antes de responder.
- **`scripts/ley-a-fondo.mjs`**: un CLI en Node.js, sin paquetes npm, que descarga, indexa y consulta. El agente lo ejecuta y lee su salida, así que funciona con cualquier agente compatible con Agent Skills.

El script se apoya en módulos pequeños en `scripts/lib/`:

| Módulo | Responsabilidad |
|---|---|
| `http.mjs` | Cliente HTTP: pausa entre solicitudes, un reintento ante `429` o `5xx`, User-Agent propio y detección de respuestas HTML (señal de que BCN cambió algo) |
| `fuentes.mjs` | Los endpoints de BCN: búsqueda, XML de la norma, reglamentos, lista de códigos y metadatos de vigencia |
| `resolver.mjs` | Convierte lo que escribe el usuario ("ley 20.000", "código civil", un link) en un idNorma |
| `xml.mjs` | Parser XML mínimo, sin dependencias |
| `parser.mjs` | Convierte el XML de una norma en partes indexables: artículos, anexos, imágenes, cuerpos legales y fechas |
| `numeros.mjs` | Normaliza números de artículo ("18-quáter", "18 QUATER" y "18 quater" son el mismo) |
| `referencias.mjs` | Extrae del texto las remisiones a otros artículos y las menciones a otras normas |
| `nombres.mjs` | Arma el nombre con que se cita cada norma y cada parte |
| `indice.mjs` | El índice SQLite: guardar, buscar, abrir artículos y secciones, vínculos |
| `cargar.mjs` | Orquesta `cargar` y `reindexar` |
| `citas.mjs` | `verificar-citas` |

## Cargar una norma

```
referencia ──▶ resolver ──▶ idNorma ──▶ XML de la norma ──▶ parser ──▶ índice
                                   └──▶ lista de reglamentos ──▶ XML de cada uno ──▶ parser ──▶ índice
                                   └──▶ Mensaje (solo códigos) ─────────────────────▶ parser ──▶ índice
```

1. **Resolver la referencia.** Un link o un idNorma se usan directo. Un código se busca por nombre en la lista oficial de códigos de BCN (y, si falla, en la copia local `assets/codigos.json`). Para "ley 20000" o "decreto 867 2008" se usa la búsqueda de BCN y se filtra por tipo, número y año. Si queda más de un candidato, el script **no adivina**: devuelve la lista con código de salida 2 para que el agente le pregunte al usuario.
2. **Pedir la lista de reglamentos** de la norma, paginando de 50 en 50. Los vínculos sin idNorma (normas que BCN vincula pero no publica) se ignoran.
3. **Descargar y guardar la norma principal.** Si BCN entrega una fecha de versión de relleno (año 2100 o posterior, como `2222-02-02` en el Código Civil), se pide la fecha real a los metadatos de vigencia. Si eso falla, la norma se carga igual y queda una advertencia.
4. **Descargar y guardar cada reglamento** y, si es un código, su Mensaje, y vincularlos a la principal. Si uno falla, se anota la advertencia y se sigue con el resto.
5. **Informar las normas mencionadas** en el texto que no están cargadas. No se cargan solas: la skill le pregunta al usuario, y solo sigue un nivel.

No se siguen reglamentos de reglamentos ni normas citadas, para no descargar de forma masiva (lo prohíben las condiciones de uso de BCN).

Con `--dependencia` solo se hace el paso 3: sirve para normas de apoyo, como el Código Penal cuando hay que traducir los grados de una pena. El agente lo carga así siguiendo `SKILL.md`; el script no lo carga por su cuenta.

### Roles

Cada norma guardada tiene un rol:

| Rol | Origen |
|---|---|
| `principal` | La pidió el usuario con `cargar` |
| `reglamento` | Reglamento de una principal |
| `mensaje` | Mensaje de un código |
| `dependencia` | Cargada con `--dependencia` |

Si una norma llega por dos caminos, conserva el rol de más rango (`principal` > `dependencia` > `reglamento`/`mensaje`). Un reglamento compartido por dos normas se guarda una sola vez, con un vínculo a cada una.

## Reindexar

`reindexar` vuelve a descargar cada norma y la compara con lo guardado:

- **Qué cambió**: se calcula un hash SHA-1 del texto de cada parte. Una parte con hash distinto, o que desapareció, aparece como artículo cambiado. Un cambio de fecha de versión también marca la norma como actualizada.
- **Reglamentos**: para una principal, se vuelve a pedir la lista a BCN. Los nuevos se cargan y los que BCN ya no vincula se desvinculan. Así también se completan los reglamentos que fallaron en `cargar`.
- **Limpieza**: al final se borran los reglamentos y Mensajes que ya no están vinculados a ninguna norma.
- **Atomicidad**: cada norma se reemplaza dentro de una transacción. Si su descarga falla, la versión anterior queda intacta y el reporte dice `ERROR`.

No se guarda historial: la versión nueva reemplaza a la anterior.

## El índice

Vive en `~/.ley-a-fondo-chile/` (o en `LEY_A_FONDO_HOME`):

- `indice.db`: base SQLite (`node:sqlite`) en modo WAL, para que las búsquedas no se bloqueen mientras otro proceso carga una norma.
- `normas/<idNorma>/`: imágenes de tablas, con un nombre único por parte, porque BCN repite nombres como `tabla.jpg` entre artículos. Se escriben después de confirmar la transacción, para no perderlas si algo falla.

### Tablas

| Tabla | Contenido |
|---|---|
| `normas` | Una fila por norma: tipo, número, título, organismos, fechas (versión, versión real, publicación, obtención), derogada, rol y nombre común si es un código |
| `partes` | Una fila por fragmento de cada parte: idParte, padre, orden, tipo, número oficial y normalizado, ruta jerárquica, cuerpo legal, texto, derogado, transitorio, fecha de versión y hash |
| `busqueda` | Tabla virtual FTS5 sobre texto, ruta y título |
| `vinculos` | Norma principal → reglamento o Mensaje, con las partes que el reglamento desarrolla |
| `referencias` | Remisiones de una parte a otros artículos ("artículo 5°", "artículos 15 y 16") |
| `menciones` | Otras normas que menciona una parte, con los artículos citados |
| `imagenes` | Ruta local de cada imagen y la parte a la que pertenece |

### Unidad de indexación

La unidad es la **parte** que define BCN: artículo, anexo, título, párrafo, encabezado. Una parte de más de 4000 caracteres se divide en fragmentos, cortando entre párrafos cuando se puede. Todos los fragmentos conservan el idParte y el número del artículo, así que la cita siempre apunta al artículo completo.

### Búsqueda

- Tokenizador `unicode61 remove_diacritics 2`: no importan las tildes ni las mayúsculas.
- Ranking BM25 con más peso a la ruta (3,0) y al título (2,0) que al texto (1,0), para que un artículo dentro de un título que nombra el tema suba en los resultados.
- Las partes derogadas se excluyen salvo con `--derogados`.
- Si la consulta tiene un error de sintaxis FTS5, se reintenta como un `OR` de sus palabras entre comillas.

La búsqueda es léxica: no entiende sinónimos ni conjugaciones. El agente compensa reformulando la pregunta en varias búsquedas con prefijos (`cultiv*`) y alternativas (`OR`), como indica `SKILL.md`.

## Consultar y verificar

El flujo de una respuesta lo dirige el agente, siguiendo `SKILL.md`:

1. `listar` y, si falta la norma, `cargar`.
2. Dos a cuatro `buscar` con la pregunta reformulada.
3. `articulo` para abrir completos los artículos relevantes y `seccion` para leer sus vecinos.
4. Seguir un nivel las remisiones, los reglamentos del artículo y, con permiso del usuario, las normas mencionadas.
5. Redactar con el formato de `references/formato-respuesta.md`.
6. `verificar-citas` sobre el borrador, y corregir hasta que salga con código 0.

`verificar-citas` compara cada literal «…» con el texto completo de la parte citada, incluidos sus descendientes. Antes de comparar normaliza espacios, comillas y mayúsculas, y quita las notas al margen que BCN pone al final de algunas líneas ("L. 19.585").

## Pruebas

- `npm test`: pruebas del script con XML y JSON reales de BCN guardados en `tests/fixtures/`. No usan internet.
- `npm run test:vivo`: prueba contra BCN real que cada endpoint siga respondiendo con la forma esperada, y una carga de punta a punta. Corre cada semana en CI y abre un issue si falla.
- `evals/`: preguntas con respuesta conocida para medir si el agente responde bien y con citas válidas. Ver [evals/README.md](../evals/README.md).
