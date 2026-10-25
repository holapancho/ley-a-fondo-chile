# Casos especiales

| Caso | Ejemplo | Qué hacer |
|---|---|---|
| Artículos transitorios con el mismo número | La Ley 20.000 tiene un art. 4 permanente y un art. 4 transitorio | `articulo "ley 20000" "4"` trae el permanente. Para el transitorio usa `"4 transitorio"`. |
| Cuerpos legales dentro de un código (doble articulado) | El Código Civil es el DFL 1 de 2000 (Justicia), que contiene seis cuerpos legales; cada uno tiene su propio art. 1 | Si `articulo` sale con código 2, repite con `--cuerpo "Código Civil"` (u otro cuerpo de la lista). Cita el cuerpo legal, no el DFL. |
| Ley sin nombre propio dentro de un artículo | La Ley sobre Prenda sin Desplazamiento es el art. 14 de la Ley 20.190 y numera sus propios arts. 1 a 42 | El cuerpo se llama "art. 14": `articulo "ley 20190" "1" --cuerpo "art. 14"`. La cita queda "Ley 20.190, art. 1 del art. 14", que es como lo nombra BCN. Explica en la respuesta qué ley es (aparece en el texto del art. 14). |
| Numeración bis/ter/quáter… | Código del Trabajo: 18 bis, 18 ter, 18 quáter, 18 quinquies | Da lo mismo cómo se escriba ("18 quater", "18-quáter", "18 QUÁTER"): es el mismo artículo. Cita la forma oficial que entrega el script. |
| Contenido en anexos | Decreto 199 de 2026 (RREE): el acuerdo está en el Anexo, no en los artículos | Busca normalmente: los anexos están indexados. La cita dice "Anexo". |
| Tablas en imagen | El mismo decreto trae 5 tablas como JPEG | El texto de las tablas no se puede buscar. `articulo`/`seccion` entregan la ruta de cada imagen. Si respondes con datos de una imagen, adviértelo y entrega el link a BCN. |
| Fecha de versión de relleno | BCN entrega `2222-02-02` para el Código Civil | El script nunca la muestra: usa la fecha de vigencia real o, si no la hay, la del artículo o la de obtención. Copia la cita sugerida tal cual. |
| Mismo número, distintas normas | El Código Civil y el Código del Trabajo son ambos "DFL 1"; hay más de 30 "Decreto 867" | Carga los códigos por su nombre. Para decretos indica el año (`decreto 867 2008`) y, si sale con código 2, pregúntale al usuario cuál quiere. |
| Normas derogadas | Una norma o un artículo con la marca DEROGADO | Los artículos derogados no aparecen en `buscar`, salvo con `--derogados`. Si citas algo derogado, dilo. |
| Remisiones | El art. 3 de la Ley 20.000 dice que se aplican "las penas establecidas en el artículo 1º" | `articulo` muestra "Este artículo remite a…": abre esos artículos antes de responder. |
| Artículos de otra norma dentro del texto | La Ley 20.000 art. 20 cita el "artículo 11 del Código Penal" | No es una remisión interna: aparece en "Menciona otras normas", no en "remite a". Si la respuesta depende de esa norma y no está cargada, pregúntale al usuario antes de cargarla. |
| Siglas | "artículo 107 de la LIR" | El script reconoce algunas siglas verificadas (LIR = Ley sobre Impuesto a la Renta, DL 824, idNorma 6368). Si ves una sigla que no reconoce, búscala o pídele al usuario el link. |
| Ñ en la numeración | Código del Trabajo: art. 183 N y art. 183 Ñ son distintos | Escribe la Ñ tal cual: `articulo "codigo del trabajo" "183 Ñ"`. |
| Partes sin número | Circular 10 de 2012 del SII: un solo bloque de texto sin número | `articulo` no puede abrirlas; usa el idParte que entrega `buscar` con `seccion <idParte>`. |
| Normas publicadas solo como extracto | Muchas circulares: BCN publica un extracto y el texto completo está en el sitio del organismo | Dilo en la respuesta y entrega el sitio que indica el extracto. No respondas como si tuvieras el texto completo. |
| Normas fuera de Ley Chile | Normas de Carácter General de la CMF, oficios del SII | No se pueden cargar con la skill. Dilo y no inventes su contenido. |
| Decretos ley difíciles de encontrar | La búsqueda de BCN no siempre trae un DL por su número | Pídele al usuario el link de la norma en bcn.cl/leychile y cárgala con ese link. |
