# Fuentes: Ley Chile – BCN

La skill obtiene todo de [Ley Chile](https://www.bcn.cl/leychile), de la Biblioteca del Congreso Nacional (BCN). Usa los mismos endpoints públicos que usa el sitio, sin API key. **No están documentados y pueden cambiar sin aviso**, así que este documento registra qué se usa y qué forma se espera. Todo está implementado en `scripts/lib/fuentes.mjs`.

## Endpoints

Verificados el 2026-10-25. Una prueba semanal (`tests/vivo/bcn.vivo.mjs`) revisa que sigan respondiendo igual.

| Para qué | Endpoint | Formato |
|---|---|---|
| Buscar por texto o número | `https://www.leychile.cl/Consulta/obtxml?opt=61&cadena=<texto>&cantidad=<n>` | XML |
| Texto completo de una norma | `https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=<id>` | XML |
| Reglamentos de una norma | `https://nuevo.leychile.cl/servicios/Vinculaciones/get_vinculaciones?idNorma=<id>&npagina=<p>&itemsporpagina=50&sentidoVinculacion=reglamentada_por&clase_vinculacion=reglamento` | JSON |
| Lista oficial de códigos | `https://nuevo.leychile.cl/servicios/Consulta/getCodigos` | JSON |
| Metadatos de vigencia | `https://nuevo.leychile.cl/servicios/Navegar/get_norma_json?idNorma=<id>` | JSON |

### Búsqueda (`opt=61`)

Devuelve elementos `<Norma>` ordenados por relevancia, cada uno con `IdNorma`, `TiposNumeros/TipoNumero` (`Descripcion`, `Numero`, `Compuesto`, p. ej. `LEY-16744` o `DTO-867`), `FechaPublicacion` en formato `01-FEB-1968` y `TituloNorma`.

Trae ruido: otras normas que mencionan el número buscado. Por eso `resolver.mjs` filtra por tipo y número exactos, y por año si se indicó. Los decretos no son únicos por número (hay más de 30 "Decreto 867"), así que sin año suele haber varios candidatos.

Algunos decretos ley no aparecen al buscarlos por número. En ese caso hay que cargarlos con su link.

### Texto de la norma (`opt=7`)

XML con el esquema `EsquemaIntercambioNorma-v1-0`. Tarda entre 0,2 y 2,6 segundos. De ahí salen:

- La estructura jerárquica (libros, títulos, párrafos, artículos) con el idParte de cada parte.
- Las fechas de versión de la norma y de cada parte.
- Las marcas de derogado y transitorio.
- Los anexos.
- Las imágenes, embebidas en base64 dentro de `<aem:ArchivoBinario>`. Un XML puede pesar casi 1 MB por las imágenes y tener solo unos KB de texto.
- Los cuerpos legales refundidos, como los seis del Código Civil dentro del DFL 1 de 2000.

Rarezas conocidas:

- **Fecha de versión de relleno**: el Código Civil trae `fechaVersion="2222-02-02"`. Cualquier fecha del año 2100 en adelante se trata como relleno y se reemplaza por la de los metadatos de vigencia.
- **Notas al margen** intercaladas al final de las líneas ("L. 19.585", "Art. 1º, Nº 112"). Se conservan en el texto, pero `verificar-citas` las ignora al comparar literales.
- **Tablas como imagen**, también dentro de artículos (la escala de penas del art. 56 del Código Penal). Su contenido no se puede buscar.

### Reglamentos (`get_vinculaciones`)

JSON con `cantidadAciertos` y `aciertos[]`. Cada acierto trae la norma reglamentaria (`IDNORMA`, `NORMA`, `TITULO_NORMA`, `FECHA_PUBLICACION`) y la parte que reglamenta (`idParteActual`, `parteActual`, p. ej. "Ley 16744 - Artículo 66 BIS"). Un mismo reglamento puede aparecer varias veces, una por cada parte que desarrolla.

Se pagina de 50 en 50 hasta cubrir `cantidadAciertos`. Los aciertos sin `IDNORMA` (normas que BCN vincula pero no publica) se ignoran.

### Códigos (`getCodigos`)

JSON con los 15 códigos de la República: `idNorma`, `idParte` (dónde empieza el código dentro de la norma), `idNormaMensaje` y `titulo`. Si el servicio falla, se usa la copia en `assets/codigos.json`. Conviene actualizar esa copia si BCN agrega un código.

### Metadatos (`get_norma_json`)

Se usa solo `metadatos.vigencia.inicio_vigencia`, para reemplazar la fecha de versión de relleno. Si falla, la norma se carga igual y la cita usa la fecha de cada artículo o la de obtención.

## Cómo se hacen las solicitudes

- **Pausa** de 1 segundo entre solicitudes. Se cambia con `LEY_A_FONDO_PAUSA_MS`.
- **User-Agent** que identifica la skill y el repositorio: `ley-a-fondo-chile/0.1 (+https://github.com/holapancho/ley-a-fondo-chile)`.
- **Un reintento** ante errores de conexión, `429` o `5xx`. Si vuelve a fallar, la norma se informa como error: en `cargar`, si es un reglamento, la carga sigue con los demás.
- **Respuestas HTML**: si BCN responde una página HTML en vez de XML o JSON, se trata como error ("el servicio pudo cambiar o no estar disponible").

BCN responde `429` cuando recibe muchas solicitudes seguidas. Con la Ley 20.000 (10 descargas) ya ocurrió con la pausa por omisión. Los reglamentos que faltan se completan con `reindexar`.

## Condiciones de uso

La skill sigue las condiciones de uso de Ley Chile (versión 1.1 de las de su API, revisadas al diseñar la skill):

- **Prohibido extraer de forma masiva o replicar Ley Chile.** La skill descarga solo lo que el usuario pide, sus reglamentos y las normas que el usuario autoriza. No sigue reglamentos de reglamentos.
- **Prohibido presentar resultados como interpretación oficial de la BCN.** Toda respuesta termina con un aviso de que no lo es.
- **Atribución**: citar "Ley Chile – Biblioteca del Congreso Nacional" y la fecha de obtención. La cita sugerida y el cierre de cada respuesta lo hacen.
- Los textos legales no están protegidos por derecho de autor.

## API oficial (no se usa)

BCN tiene una API oficial con key personal, en `https://www.bcn.cl/leychile/api/v1`, con un límite de 500 solicitudes cada 24 horas. La key se pide en `https://www.bcn.cl/leychile/privado/admin/api/solicitud` y la especificación OpenAPI está en `tests/fixtures/api-leychile-v1.yaml`.

La versión 0.1 no la usa: funciona solo con los endpoints públicos. Si los públicos dejaran de funcionar, la API sería el reemplazo. Antes de adoptarla habría que verificar con una key real:

- Que `/servicio/7/` y `/servicio/7.2/` entreguen las mismas estructuras que `opt=7` y `get_norma_json`.
- Si `/servicio/846/` entrega los mismos reglamentos que `get_vinculaciones`. Si no, los reglamentos seguirían saliendo del endpoint público.

## Si BCN cambia algo

1. La prueba semanal falla y abre un issue. Cada prueba de `tests/vivo/bcn.vivo.mjs` cubre un endpoint, así que el nombre de la que falló indica cuál cambió.
2. Reproduce la falla con `npm run test:vivo`.
3. Guarda la respuesta nueva como fixture en `tests/fixtures/`, ajusta `fuentes.mjs` o `parser.mjs`, y agrega una prueba con ese fixture.
4. Actualiza este documento.
