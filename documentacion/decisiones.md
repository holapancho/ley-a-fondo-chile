# Decisiones de diseño

Qué busca el proyecto, qué deja fuera a propósito y por qué funciona como funciona. Sirve para no volver a discutir lo que ya se decidió y para saber qué hay que revisar si cambia algún supuesto.

## Objetivo

Que cualquier persona, no necesariamente abogada, pueda **entender a fondo una norma chilena** preguntándole a su agente de código, con cada afirmación citada y verificable en Ley Chile.

**Lo que más importa es que la respuesta sea correcta y que todo esté citado.** Una respuesta bien redactada con un artículo equivocado, una pena mal traducida o una afirmación sin cita es un fracaso, aunque técnicamente funcione.

## Metas

- Cargar una norma por su número, por el nombre de un código, o por su link o idNorma de BCN.
- Bajar automáticamente todos sus reglamentos.
- Un índice local persistente, consultable sobre varias normas a la vez o sobre una sola.
- Respuestas con cita en cada afirmación, texto literal en las penas y ejemplos marcados como hipotéticos.
- Funcionar en cualquier agente compatible con Agent Skills, con solo Node.js instalado.

## Fuera de alcance

- Historia de la Ley (debates en el Congreso).
- Jurisprudencia y fallos.
- Búsqueda semántica con embeddings.
- Historial de versiones de una norma: al reindexar, la versión nueva reemplaza a la anterior.
- Un modelo local: responde el agente del usuario.
- La API oficial de BCN con key (ver [fuentes-bcn.md](fuentes-bcn.md#api-oficial-no-se-usa)).

## Lo que haría fracasar al proyecto aunque funcione

- Afirmar algo sobre una ley sin cita verificable.
- Citar el artículo equivocado: "DFL 1, art. 1437" en vez de "Código Civil, art. 1437", o confundir el "18 bis" con el "18".
- Presentar la respuesta como interpretación oficial de la BCN.
- Descargar de forma masiva o replicar Ley Chile.
- Inventar cuando el texto cargado no responde la pregunta.

Varias decisiones de abajo existen para evitar justamente esto.

## Decisiones

### Datos y fuente

| Decisión | Por qué |
|---|---|
| Solo endpoints públicos de BCN, sin API key | Nadie tiene que pedir una key para usar la skill. La API oficial queda como alternativa si los endpoints públicos cambian |
| Bajar todos los reglamentos sin preguntar | Muchas respuestas dependen del reglamento (por ejemplo, el art. 4 de la Ley 20.000 se remite a lo que determine su reglamento, el Decreto 867) |
| Indexar siempre el Mensaje de los códigos | Explica la intención del código, y BCN lo entrega junto con la lista de códigos |
| No seguir reglamentos de reglamentos ni normas citadas | Las condiciones de uso de BCN prohíben la descarga masiva |
| Informar las normas mencionadas, pero cargarlas solo si el usuario acepta, y solo un nivel | Algunas respuestas dependen de otra norma, pero cargar todo lo mencionado sería descarga masiva |
| El Código Penal se carga con `--dependencia`, sin sus reglamentos | Solo se necesita su escala de penas para traducir grados como "presidio menor en su grado medio" a años |
| Pausa de 1 s entre solicitudes y User-Agent propio | Cortesía con BCN y forma de que identifiquen el tráfico |
| Ante una referencia ambigua, preguntar y no adivinar | Hay más de 30 "Decreto 867". Cargar el equivocado lleva a citar la norma equivocada |
| Copia local de la lista de códigos | Para resolver "código civil" aunque el servicio de códigos falle |

### Técnica

| Decisión | Por qué |
|---|---|
| Node.js sin paquetes npm | Node está en el ecosistema de los agentes (`npx`); Python no está garantizado. Sin dependencias no hay nada que instalar ni que se rompa |
| Node.js 24 como mínimo | `node:sqlite` trae FTS5 recién desde Node 22.16. Se prefirió exigir una versión mayor completa en vez de una versión menor específica de la 22 |
| SQLite con FTS5 y búsqueda léxica, no embeddings | Funciona sin red y sin modelos, y es predecible. El agente compensa la falta de sinónimos reformulando la pregunta en varias búsquedas |
| La parte de BCN como unidad, fragmentada si pasa de 4000 caracteres | La cita siempre apunta a un artículo completo con su link oficial, aunque el texto se haya dividido para buscar |
| El índice en `~/.ley-a-fondo-chile/` | Se comparte entre proyectos y sobrevive a reinstalar la skill |
| `SKILL.md` en `skills/ley-a-fondo-chile/` y no en la raíz | Para que las pruebas, los evals y la documentación no se instalen junto con la skill |
| `SKILL.md` sin herramientas propias de un agente | Todo se expresa como "ejecuta este comando y lee su salida", así sirve en Claude Code, Codex, Cursor y otros |
| Ejecución sincrónica, mostrando avance | Una carga tarda de 3 s a 2 min. Es más simple que un proceso en segundo plano y el agente ve cuándo termina |

### Respuestas y citas

| Decisión | Por qué |
|---|---|
| Toda afirmación sobre la norma lleva un link con `idNorma` e `idParte` | Cualquiera puede abrir el artículo exacto en BCN y comprobarlo |
| El agente copia los links que entrega el script; nunca escribe un `idParte` | Los idParte son correlativos: un dígito de diferencia apunta a otro artículo |
| Las penas van con el texto literal entre «» | La traducción de una pena es donde más fácil se equivoca un modelo |
| `verificar-citas` antes de entregar cada respuesta | Comprueba con código, no con confianza, que cada cita exista, que su etiqueta nombre el artículo correcto y que cada literal esté en el texto |
| Citar "Código Civil, art. 1437", nunca "DFL 1, art. 1437" | Es como lo nombra cualquier persona, y el DFL contiene seis cuerpos legales con su propia numeración |
| No mostrar nunca una fecha de versión de relleno | Usar la fecha real de vigencia; si no existe, la del artículo; si tampoco, "no disponible" con la fecha de obtención |
| Derogados guardados pero ocultos en las búsquedas | Casi nunca son la respuesta, pero a veces hay que citarlos, y entonces la cita debe decir que están derogados |
| Responder en el idioma de la pregunta, con los literales en español | Las citas tienen que poder compararse con el original |
| No inventar el valor de la UTM | Cambia cada mes |
| Formato: tabla resumen y luego detalle caso a caso | Se ve la respuesta de un vistazo y después cada caso con sus citas |
| Nombre `ley-a-fondo-chile`, sin "leychile" ni "bcn" | Para no parecer un producto oficial de la BCN |

## Cambios durante la construcción

Decisiones tomadas después del diseño inicial, el 2026-10-25:

- **Se eliminó el modo con API key**, junto con el contador de cuota de 500 solicitudes diarias y su código de salida. La v0.1 usa solo endpoints públicos.
- **Normas mencionadas**: se agregó la detección de otras normas mencionadas en el texto (leyes, DL, DFL, códigos y algunas siglas verificadas, como LIR para el DL 824). Se informan y el agente pregunta antes de cargarlas.
- **`verificar-citas` revisa también la etiqueta** de cada link, no solo que el link exista, y rechaza literales citados a un título o párrafo en vez de a un artículo.

Y una del 2026-10-28:

- **Node.js 24 como mínimo**, en vez de 22.13. Con Node 22.13 a 22.15, `node:sqlite` no trae FTS5 y la skill no funciona.

## Para después

- Historia de la Ley.
- Historial de versiones y comparar "qué decía antes".
- Concordancias y modificaciones como vínculos adicionales.
- Búsqueda semántica opcional.
- Usar la API oficial de BCN si los endpoints públicos dejan de funcionar.
