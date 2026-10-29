# Política de privacidad / Privacy policy

Última actualización: 2026-10-28 · Last updated: 2026-10-28

[English below](#english)

## Español

La skill **ley-a-fondo-chile** no recopila, guarda ni envía datos personales al autor ni a terceros.

**Qué se conecta a internet.** El script de la skill solo hace solicitudes a Ley Chile – Biblioteca del Congreso Nacional (`www.leychile.cl` y `nuevo.leychile.cl`), y solo al cargar o reindexar una norma. Lo único que envía es la referencia de la norma que pediste (por ejemplo, "ley 20000" o un idNorma) para encontrarla y descargarla. Las solicitudes se identifican con un User-Agent con el nombre de la skill y la dirección del repositorio. Tus preguntas y tus búsquedas dentro de las normas no se envían a BCN: se resuelven en tu equipo.

**Qué se guarda en tu equipo.** El texto de las normas que cargas, sus imágenes y un índice de búsqueda, en `~/.ley-a-fondo-chile/` (o en la carpeta que indiques con `LEY_A_FONDO_HOME`). Puedes borrar esa carpeta cuando quieras.

**Qué no hace.** No usa telemetría, analítica, cuentas ni API keys. No lee credenciales ni archivos fuera de su carpeta de datos, salvo el archivo de respuesta que le pidas revisar con `verificar-citas`.

**Servicios de terceros.** El agente de IA que usa la skill (por ejemplo, Claude) procesa tus preguntas según su propia política de privacidad. Las solicitudes a Ley Chile quedan sujetas a las políticas de la Biblioteca del Congreso Nacional.

**Contacto.** Para dudas o reportes, abre un issue en https://github.com/holapancho/ley-a-fondo-chile/issues.

## English

The **ley-a-fondo-chile** skill does not collect, store or send personal data to the author or to third parties.

**What connects to the internet.** The skill's script only makes requests to Ley Chile – Biblioteca del Congreso Nacional (`www.leychile.cl` and `nuevo.leychile.cl`), and only when loading or reindexing a law. The only thing it sends is the reference of the law you asked for (for example, "ley 20000" or an idNorma) to find and download it. Requests carry a User-Agent with the skill's name and repository address. Your questions and your searches within the laws are not sent to BCN: they run on your computer.

**What is stored on your computer.** The text of the laws you load, their images and a search index, in `~/.ley-a-fondo-chile/` (or the folder you set with `LEY_A_FONDO_HOME`). You can delete that folder at any time.

**What it does not do.** It uses no telemetry, analytics, accounts or API keys. It does not read credentials or files outside its data folder, except the answer file you ask it to check with `verificar-citas`.

**Third-party services.** The AI agent that uses the skill (for example, Claude) processes your questions under its own privacy policy. Requests to Ley Chile are subject to the policies of the National Congress Library.

**Contact.** For questions or reports, open an issue at https://github.com/holapancho/ley-a-fondo-chile/issues.
