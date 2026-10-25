# Evaluaciones de respuesta correcta

Estas pruebas miden si la skill **responde bien y con citas válidas**, no solo si el script funciona.

## Archivos

- `preguntas.json`: 8 preguntas. Para cada una indica qué norma cargar, qué artículos deben citarse (`articulosEsperados`) y qué texto debe o no debe aparecer en la respuesta.
- `esperadas/<id>.md`: la respuesta de referencia de cada pregunta. **Solo cuenta como verdad si el encabezado dice `Estado: APROBADA`**, y eso lo marca el dueño del proyecto después de revisarla.
- `verificar.mjs`: revisa una respuesta contra su pregunta. Comprueba la cobertura de artículos, el texto exigido y prohibido, y las citas (con `verificar-citas`).

## Cómo correrlas

1. Carga las normas de `preguntas.json` con el script de la skill.
2. Hazle cada pregunta a un agente (Claude Code como referencia) que tenga la skill instalada, y guarda cada respuesta en `evals/corridas/<fecha>/<id>.md`.
3. Verifica cada respuesta:

   ```bash
   node evals/verificar.mjs porte-droga evals/corridas/2026-10-25/porte-droga.md
   ```

4. Compara la explicación con la respuesta esperada aprobada y anota las diferencias en `evals/corridas/<fecha>/resumen.md`.

Una respuesta pasa cuando `verificar.mjs` sale con 0 **y** su contenido coincide con la respuesta esperada aprobada.
