# Formato de respuesta

## Estructura

1. **Resumen en tabla.** Una fila por caso o situación, con la regla o pena y su cita. Ejemplo: situación → qué dice la norma → artículo.
2. **Detalle caso a caso.** Para cada fila: qué dice la norma (con el texto literal cuando sea una pena, un plazo o un requisito), la explicación en lenguaje simple y las excepciones.
3. **Ejemplos prácticos** (opcionales), rotulados como hipotéticos.
4. **Lo que no está en las normas cargadas**, si aplica.
5. **Cierre obligatorio.**

## Cómo se cita

Una cita es un link markdown al artículo en BCN, con `idNorma` e `idParte`:

```markdown
[Ley 20.000, art. 4 (texto desde 2005-02-16; versión de la norma 2026-05-23)](https://www.bcn.cl/leychile/navegar?idNorma=235507&idParte=8652182)
```

- Usa como texto del link la **cita sugerida** que entrega `articulo` o `buscar`, y el link exacto que entregan. Nunca escribas un `idParte` de memoria.
- En las listas, cada elemento que tenga una cita textual «…» lleva su propia cita en la misma línea.
- En los códigos, cita el cuerpo legal ("Código Civil, art. 1437"), nunca "DFL 1, art. 1437".
- El texto del link debe nombrar la **misma norma y el mismo artículo** al que apunta el link. `verificar-citas` lo revisa y rechaza, por ejemplo, "[Código Penal, art. 3]" con un link a la Ley 20.000.
- No cites un literal a un título o párrafo: cita el artículo donde está el texto.
- Si citas una parte derogada, el texto del link debe decir "derogado".

## Cómo se cita textual

Un literal va entre «» y **en el mismo párrafo debe venir después su cita**:

```markdown
La ley castiga a quien porte «pequeñas cantidades de sustancias o drogas estupefacientes o sicotrópicas» sin autorización ([Ley 20.000, art. 4 (…)](https://www.bcn.cl/leychile/navegar?idNorma=235507&idParte=8652182)).
```

- El texto entre «» debe ser idéntico al oficial. Solo se ignoran los espacios y los saltos de línea.
- Para omitir un tramo usa `…` dentro del literal: «pequeñas cantidades de sustancias … productoras de dependencia física o síquica».
- Usa «» solo para citas textuales. Para cualquier otra cosa usa comillas normales.
- `verificar-citas` rechaza los literales que no coinciden y los que no tienen cita en su párrafo.

## Ejemplos hipotéticos

Van en una sección propia con este encabezado:

```markdown
### Ejemplos prácticos (hipotéticos)
```

Cada ejemplo explica qué artículo aplica y por qué, y lleva cita. Nunca se presenta como un caso real ni como jurisprudencia.

## Cierre obligatorio

Toda respuesta termina con este texto, con la fecha de obtención que muestra `listar`:

> Esta respuesta no es una interpretación oficial de la Biblioteca del Congreso Nacional ni asesoría legal. Fuente: Ley Chile – Biblioteca del Congreso Nacional (https://www.bcn.cl/leychile), texto obtenido el AAAA-MM-DD.

## Antes de entregar

Guarda el borrador en un archivo y ejecuta:

```bash
node <carpeta-de-esta-skill>/scripts/ley-a-fondo.mjs verificar-citas borrador.md
```

Si sale con código 0, entrega la respuesta. Si sale con código 4, corrige cada error que muestra y vuelve a verificar.
