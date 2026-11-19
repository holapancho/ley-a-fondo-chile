# Cambios

Todos los cambios relevantes de la skill se anotan aquí. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Eliminado

- El plugin de Claude Code y el marketplace del repositorio (`.claude-plugin/`). En Claude Code la skill se instala ahora con `npx skills add holapancho/ley-a-fondo-chile -a claude-code -g`, como en los demás agentes. Si la instalaste como plugin, desinstálala con `claude plugin uninstall ley-a-fondo-chile@ley-a-fondo-chile` y quita el marketplace con `claude plugin marketplace remove ley-a-fondo-chile`.

## [0.1.0] - 2026-10-28

### Agregado

- Skill `ley-a-fondo-chile`: carga normas de Ley Chile – BCN con sus reglamentos, las indexa localmente (SQLite FTS5) y responde con citas verificables.
- Comandos `cargar`, `listar`, `buscar`, `articulo`, `seccion`, `verificar-citas`, `reindexar` y `estado`.
- Requiere Node.js 24 o superior: el `node:sqlite` de versiones anteriores a Node 22.16 no trae FTS5.
- Instalación con `npx skills add`, como plugin de Claude Code (`.claude-plugin/`) y como `.zip` para claude.ai.
- Publicada en npm como [`ley-a-fondo-chile`](https://www.npmjs.com/package/ley-a-fondo-chile), para que aparezca en las búsquedas del registro. El paquete incluye solo la skill, el README, la licencia y el CHANGELOG.
- Página del proyecto en GitHub Pages (`sitio/`), en español y en inglés (`sitio/en/`), con una sección sobre el autor.
- Documentación en `documentacion/`: referencia de comandos, arquitectura, fuentes de BCN y decisiones de diseño.
- CI: pruebas en cada push y PR, y prueba semanal contra BCN real que abre un issue si falla.

[Sin publicar]: https://github.com/holapancho/ley-a-fondo-chile/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/holapancho/ley-a-fondo-chile/releases/tag/v0.1.0
