# AGENTS — it-project-orchestrator

Instrucciones operativas y gobernanza global para cualquier agente o subagente que opere en este repositorio.

---

## 1. Visión y Capacidades del Orquestador

Este proyecto es un sistema multi-agente agnóstico diseñado para cubrir el ciclo de vida completo de proyectos IT en dos grandes etapas:

1. **Ciclo Idea-to-Backlog (Definición de Producto y Trabajo Técnico):**
   - `_skills/product-discovery/`: Convierte ideas, pitches o necesidades en un PRD consensuado e historias INVEST con criterios de aceptación Given/When/Then puramente funcionales.
   - `_skills/stories-to-tickets/`: Convierte historias en tickets técnicos atómicos de media jornada, genera grafo de dependencias, sizing, matriz de priorización y materializa issues en GitHub o Linear.
   - `orchestrator/`: Orquesta el ciclo completo punta a punta cuando un rol o agente tiene acceso total al proyecto y gestiona el versionado Git.
2. **Ciclo de Desarrollo SDD (Specification-Driven Development):**
   - `_skills/sdd-init/`: Inicializa la estructura OpenSpec y `config.yaml` contextual en el repositorio de desarrollo sin instalar herramientas locales (usadas vía plugin).
   - `_skills/db-sdd/`: Ciclo SDD de Base de Datos guiado por especificaciones, DB-TDD y validaciones mecánicas deterministas.
   - `_skills/backend-sdd/`: Ciclo SDD de la capa Backend guiado por especificaciones, contratos de API, Backend-TDD y 4 Gates deterministas.
   - `sdd/`: Implementación de código guiada por especificaciones técnicas rigurosas a partir de tickets priorizados del backlog y especificaciones OpenSpec.

---

## 2. Punto de Entrada

Cuando el usuario invoque el orquestador sin un subcomando específico, presentar las grandes opciones del sistema:

```
👋 ¡Hola! ¿En qué etapa del proyecto vamos a trabajar hoy?
  [1] Idea a PRD y User Stories (Product Discovery)
  [2] User Stories a Tickets técnicos e Issues (Stories to Tickets)
  [3] Ciclo completo Idea-to-Backlog (Discovery + Tickets de punta a punta)
  [4] Desarrollo con SDD (Implementación guiada por especificaciones)
```

Según la elección, invocar el recurso correspondiente antes de continuar:
- `[1]` → `_skills/product-discovery/SKILL.md`
- `[2]` → `_skills/stories-to-tickets/SKILL.md`
- `[3]` → `orchestrator/ORCHESTRATOR.md`
- `[4]` → Si `openspec/config.yaml` no existe en el repositorio de destino: `_skills/sdd-init/SKILL.md`. Si ya está inicializado, el orquestador solicita el ticket o requerimiento técnico y activa el **Dispatcher por Capa**:
  - `capa:db` → `_skills/db-sdd/SKILL.md` (Ciclo SDD de Base de Datos con equipo multi-agente en `agents/db/`)
  - `capa:backend` → `_skills/backend-sdd/SKILL.md` (Ciclo SDD de Backend con equipo multi-agente en `agents/backend/`)
  - `capa:frontend` → Ciclo SDD correspondiente

---

## 3. Mapa de Componentes

| Tipo | Ubicación | Responsabilidad |
|---|---|---|
| **Subagentes Core** | `agents/<nombre>.md` | Discovery, análisis de producto, backlog, tickets y materialización |
| **Subagentes de Base de Datos** | `agents/db/<nombre>.md` | Equipo especializado de BD: Architect, Developer, Security DBA, Mutation Tester y QA |
| **Subagentes de Backend** | `agents/backend/<nombre>.md` | Equipo especializado de Backend: API Architect, Backend Developer, Backend QA y Mutation Tester |
| **Skills** | `_skills/<nombre>/SKILL.md` | Runbooks y procedimientos operativos paso a paso con interacción humana |
| **Orquestador** | `orchestrator/ORCHESTRATOR.md` | Secuenciación de flujos completos punta a punta, dispatching de tickets y gobernanza Git |
| **Especificaciones SDD** | `openspec/` y `sdd/` | Framework OpenSpec, planes y especificaciones técnicas de desarrollo guiado |
| **Scripts Deterministas** | `scripts/` | Validaciones mecánicas automatizadas (`validate-db-migrations.js`, `validate-backend.js`: FKs, simetría up/down, RLS, contratos OpenAPI, No-DB-Diff) |
| **Templates** | `templates/` y `docs/` | Plantillas oficiales para issues (GitHub/Linear) y documentos (briefings, tool-config) |

---

## 4. Reglas de Oro Globales (Invariantes del Sistema)

1. **Gobernanza de Git:** Ningún subagente ni skill ejecuta commits directamente. Solo el orquestador principal interactúa con Git, y **siempre tras confirmación explícita del usuario**.
2. **Validación Humana Obligatoria:** Nunca avanzar de etapa ni sobrescribir acuerdos sin confirmación del usuario (respetar rigurosamente las pausas `⏸️` y `🛑`).
3. **Separación Estricta de Responsabilidades:**
   - `agents/<nombre>.md`: Contiene la personalidad, modelo mental y restricciones ontológicas del agente (quién es y qué tiene prohibido hacer).
   - `_skills/<nombre>/SKILL.md`: Contiene el flujo de trabajo procedural (cuándo se le invoca, qué insumos se le entregan y cómo se procesa la salida).
   - `orchestrator/`: Conecta múltiples skills en secuencia y gestiona la persistencia y commits en el repositorio.
4. **Trazabilidad y Honestidad Intelectual:**
   - Todo dato no verificado o propuesto por el agente se marca explícitamente como `[SUPUESTO]`.
   - Todo requerimiento o idea descartada se marca explícitamente como `[FUERA DE ALCANCE]`.
5. **Criterio Proactivo:** Proponer siempre con sustento funcional/técnico. Si una elección del usuario presenta riesgos conocidos, dependencias críticas o deuda técnica, advertirlo antes de continuar.
6. **Grounding en Disco:** Cuando un paso indique leer archivos persistidos, leer siempre desde disco; no confiar en la memoria volátil de la conversación.
7. **Única Fuente de Verdad para Agentes (SSOT):** La definición canónica de cada subagente (rol, guardrails estrictos y contratos) reside exclusivamente en `agents/<nombre>.md`. Cualquier integración de plataforma externa debe actuar como un puntero o referencia directa al archivo canónico en `agents/`. Queda prohibido duplicar el contenido de los prompts para evitar desfasajes y costos de mantenimiento.
8. **Límite Duro de Turno en Pausas (Hard Turn Boundaries):** Toda pausa `⏸️` o `🛑` en cualquier skill u orquestador es un **LÍMITE ESTRICTO DE FIN DE TURNO**. Al emitir el entregable, las preguntas o la propuesta del paso actual, el agente DEBE finalizar inmediatamente su turno de respuesta.
   - **QUEDA TERMINANTEMENTE PROHIBIDO:**
     1. Ejecutar más de un paso en el mismo turno o mensaje.
     2. Simular, asumir, autocompletar o responder por cuenta propia preguntas dirigidas al usuario.
     3. Invocar al siguiente subagente o continuar al siguiente paso sin haber recibido un nuevo mensaje explícito del usuario en la conversación.
     4. Escribir archivos de pasos posteriores antes de que los pasos previos hayan sido aprobados individualmente por el usuario.
9. **Concisión en Chat vs. Persistencia en Disco (No Duplicar Contenido):**
   - **Si `tiene_repositorio = true`:**
     - Todo documento formal (alcance, PRD, historias de usuario, tickets, backlog) **se escribe directamente a su archivo Markdown en disco**.
     - **QUEDA TERMINANTEMENTE PROHIBIDO** volcar el texto completo del documento `.md` en el mensaje de chat.
     - El chat debe contener únicamente un **resumen ejecutivo de alto nivel**: enlace al archivo generado (`[archivo.md](file:///...)`), métricas clave (cantidad de épicas/historias/tickets), supuestos o exclusiones críticas a validar, y la pregunta de validación.
   - **Si `tiene_repositorio = false` (modo conversación / PDF):**
     - El contenido completo sí se muestra en el chat, ya que no existe persistencia local en disco y el usuario necesita leerlo para validar y para la generación posterior de los PDFs entregables.
10. **Numeración Incremental y Trazabilidad Evolutiva (Sin Colisiones):**
    Para soportar proyectos evolutivos con múltiples entregas, features o sprints sucesivos sin sobrescritura de archivos ni IDs repetidos:
    - **Prefijo de Avance (`NNNN-`):** Antes de crear archivos, inspeccionar `docs/prd/` y `docs/backlog/` para detectar el mayor prefijo numérico existente de 4 dígitos (`0001-`, `0002-`, etc.). Si no hay ninguno previo, arrancar en `0001-`. Todo archivo de alcance, PRD y backlog priorizado debe llevar este prefijo (`docs/prd/<NNNN>-alcance-<sufijo>.md`, `docs/prd/<NNNN>-<proyecto>-<sufijo>.md`).
    - **Subcarpeta de Backlog Aislada (`docs/backlog/<NNNN>-<proyecto>-<sufijo>/`):** Para mantener orden absoluto entre ciclos de entrega, todos los archivos de backlog (épicas, historias, tickets y backlog priorizado) se agrupan dentro de una subcarpeta cuyo nombre es idéntico al PRD correspondiente (`docs/backlog/<NNNN>-<proyecto>-<sufijo>/`).
    - **Épicas Incrementales (`E<N>`):** Al definir épicas en el PRD, inspeccionar `docs/backlog/` y PRDs previos para detectar la última épica numerada (`E1`, `E2`, etc.). Las nuevas épicas continúan correlativamente (`E3`, `E4`, ...) para evitar colisiones entre avances.
    - **Historias de Usuario (`US-<XX>`):** Al descomponer historias, inspeccionar `docs/backlog/**/us-*.md` para obtener el último código `US-<XX>`. Las nuevas historias continúan correlativamente (`US-07`, `US-08`, ...) garantizando unicidad global en el proyecto.
    - **Tickets Atómicos (`US-<XX>-T<N>`):** Heredan el ID unívoco de su historia padre, garantizando unicidad y evitando duplicados en GitHub Issues y Linear.
11. **Gobernanza de Pull Requests y Uso de Plantillas:**
    Al abrir cualquier Pull Request (mediante `gh pr create` o en GitHub):
    - **Uso estricto de plantillas:** El cuerpo del PR (`--body`) debe estructurarse obligatoriamente usando la plantilla correspondiente:
      - Features/fixes hacia `develop`: [`.github/pull_request_template.md`](.github/pull_request_template.md).
      - Releases hacia `master`: [`.github/PULL_REQUEST_TEMPLATE/release.md`](.github/PULL_REQUEST_TEMPLATE/release.md).
    - **Convenciones de ramas, títulos y commits:** Deben respetar estrictamente las normas definidas en [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md).
12. **Neutralidad del Orquestador en Handoffs (Prohibición de Inyección de Sesgo):**
    Al invocar a cualquier subagente o transferir el control entre skills, el agente orquestador actúa como un **canal transparente y neutral**:
    - **QUEDA TERMINANTEMENTE PROHIBIDO** que el orquestador pase contexto, interpretaciones, preferencias técnicas/funcionales, reformulaciones sesgadas o suposiciones producto de su propio sesgo.
    - **ÚNICAMENTE PUEDE PASAR:**
      1. Las instrucciones, respuestas o contexto provistos **explícitamente por el usuario**.
      2. Las rutas o el contenido íntegro de los artefactos persistidos en disco y validados en pasos previos.
13. **Gobernanza de Tickets Multi-Capa y Bulk Archive:**
    Cuando un ticket técnico impacte 2 o más capas tecnológicas (ej. `db` + `backend` + `frontend`):
    - **Subcarpetas en OpenSpec por Capa:** Queda prohibido mezclar especificaciones heterogéneas en una única carpeta de change monolítica. El orquestador debe instruir la creación de una subcarpeta por cada capa afectada, compartiendo el identificador único del ticket: `openspec/changes/<ticket_id>-<capa>/` (ej: `E1-US03-T01-db/`, `E1-US03-T01-backend/`, `E1-US03-T01-frontend/`).
    - **Secuenciación Topológica Obligatoria:** Se ejecuta y valida primero la capa de datos (`-db`), luego la capa de servicios y lógica (`-backend`), y finalmente la interfaz de usuario (`-frontend`).
    - **Archivado Atómico en Lote (`Bulk Archive`):** Al finalizar la validación de todas las capas del ticket, el orquestador debe archivar en lote mediante **OpenSpec Bulk Archive** (`/opsx:bulk-archive` o `openspec bulk-archive`), garantizando la consolidación coherente de especificaciones en `openspec/specs/` y un único commit atómico de Git para la entrega completa.
14. **Scripts Deterministas en Node.js y Pasaje Explícito de Parámetros (Agnóstico de SO):**
    Todo script auxiliar de automatización o validador mecánico determinista incorporado en el proyecto (`scripts/`) DEBE implementarse en **Node.js nativo (`.js`)**:
    - **Independencia del Sistema Operativo:** Prohibido crear scripts en PowerShell (`.ps1`) o dependientes de shells exclusivas de un SO que fallen en Linux o macOS. Los scripts deben ejecutarse universalmente con `node "<plugin-root>/scripts/<script>.js"`.
    - **Sin Dependencias Externas:** Usar únicamente módulos estándar de Node.js (`fs`, `path`, etc.) para garantizar ejecución inmediata sin requerir `npm install` en el proyecto del usuario.
    - **Exploración Previa y Pasaje Explícito de Parámetros:** Queda prohibido hardcodear rutas rígidas en los scripts. Los skills deben explorar el repositorio destino en sus fases iniciales para detectar la infraestructura real (rutas, motor, carpetas) y pasar los parámetros explícitamente mediante flags CLI (ej. `--migrations-dir`, `--security-dir`, `--engine`).

---

## 5. Convenciones de Archivos en el Proyecto Destino

El orquestador organiza los artefactos generados bajo una estructura canónica estandarizada:

```text
<raiz-del-proyecto>/
├── docs/                                # Documentación de producto y backlog
│   ├── config-project-orchestrator/
│   │   └── tool-config.md               # Configuración de herramientas de issues y metodología
│   ├── tech-briefing.md                 # Contexto técnico inicial (brownfield)
│   ├── kickoff-brief.md                 # Contexto de negocio inicial (greenfield)
│   ├── prd/
│   │   ├── <NNNN>-alcance-<sufijo>.md   # Alcance consensuado (ej: 0001-alcance-registro-ventas-mvp.md)
│   │   └── <NNNN>-<proyecto>-<sufijo>.md # PRD estructurado (ej: 0001-sistema-ventas-registro-ventas-mvp.md)
│   └── backlog/
│       └── <NNNN>-<proyecto>-<sufijo>/  # Subcarpeta homónima al PRD para cada avance
│           ├── <NNNN>-backlog-priorizado.md # Grafo de dependencias, sizing y matriz
│           └── E<N>-<epica>/
│               ├── us-<historia>.md     # Historia INVEST (US-<XX>) con criterios Given/When/Then
│               └── tickets-<historia>.md # Tickets técnicos atómicos (US-<XX>-T<N>) con checklist DoD
├── database/                            # Ciclo de base de datos (o estructura propia del repo: supabase/, prisma/, src/db/)
│   ├── schemas/                         # Diagrama ERD consolidado (erd.md)
│   ├── tests/                           # Suites DB-TDD organizadas por dominio/módulo (<entidad>.test.sql, nunca por ticket)
│   ├── migrations/                      # Migraciones versionadas <timestamp>_<nombre>.up.sql y .down.sql (o forward-only)
│   ├── security/                        # Políticas RLS y permisos DCL (si rls_mode = 'dedicated')
│   └── seeds/                           # Fixtures de datos sintéticos DML (si requires_seeds = true)
├── backend/                             # Ciclo de capa backend (o estructura propia del repo: src/, app/, backend/)
│   ├── openapi.yaml                     # Contrato OpenAPI 3.x (si contract_style = 'openapi-first')
│   ├── schemas/                         # DTOs y esquemas de validación de entrada/salida (o dtos/)
│   ├── repositories/                    # Capa de acceso a datos y consultas parametrizadas / ORM
│   ├── services/                        # Capa de lógica de negocio y orquestación transaccional
│   ├── routers/                         # Controladores HTTP / Routers / Workers de entrada (o controllers/)
│   └── tests/                           # Suites Backend-TDD organizadas por dominio/módulo (<modulo>.test..., nunca por ticket)
├── openspec/                            # Especificaciones OpenSpec (specs/, changes/<change>/ con verification-report.md y mutation-report.md, config.yaml)
└── sdd/                                 # Specification-Driven Development (fase de desarrollo)
    └── <modulo-o-feature>/
        ├── spec.md                      # Especificación técnica detallada
        └── plan.md                      # Plan de implementación y tareas de código
```

---

## 6. Tono y Comunicación

El agente es un colaborador activo, empático y profesional, no un ejecutor autómata.

### Vocabulario de Emojis
| Emoji | Cuándo usarlo |
|---|---|
| 👋 | Saludo inicial y presentación del flujo |
| 🔍 | Explorando archivos, repositorios o analizando contexto |
| 💡 | Propuesta, sugerencia o insight del agente |
| ⏸️ | Pausa esperando validación humana antes de continuar |
| ✅ | Paso completado o confirmación recibida |
| 📄 | Documento generado y listo para revisar |
| 📦 | Output listo devuelto al agente principal |
| 🚀 | Handoff al siguiente skill o cierre del ciclo |
| ⚠️ | Advertencia — decisión con riesgo o supuesto importante |
| ❌ | Bloqueante o elemento fuera de alcance |
| ⭐ | Quick win identificado (alto impacto, baja complejidad) |
| 🗂️ | Resumen de archivos generados |

### Guía de Estilo
- **Conciso pero humano:** Una línea de contexto antes de mostrar un bloque técnico ayuda al usuario a saber qué está mirando.
- **Sin duplicar contenido en el chat:** Si un archivo ya se escribió a disco (`tiene_repositorio = true`), nunca vuelques su contenido en el mensaje; proporciona un resumen ejecutivo conciso y el enlace al archivo.
- **Diagramas Mermaid con Alto Contraste:** Todo diagrama Mermaid generado debe garantizar legibilidad en temas oscuros y claros evitando textos negros sobre fondos oscuros:
  - En diagramas de flujo (`flowchart` / `graph`): usar `classDef default fill:#1e293b,stroke:#38bdf8,stroke-width:1.5px,color:#ffffff;` y `linkStyle default stroke:#94a3b8,stroke-width:1.5px;`.
  - En diagramas entidad-relación (`erDiagram`): usar obligatoriamente la directiva de tema `%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#1e293b', 'primaryTextColor': '#ffffff', 'primaryBorderColor': '#38bdf8', 'lineColor': '#94a3b8' }}}%%`. Prohibido usar `linkStyle` en `erDiagram`, ya que no pertenece a su gramática y rompe el parser de Mermaid.
- **Proponer, no solo ejecutar:** Si el agente detecta algo cuestionable o con riesgo de scope creep, lo advierte antes de continuar.
- **Celebrar los hitos:** Al completar una fase importante, reconocerlo brevemente antes de seguir.
- **Sin jerga innecesaria:** Adaptar el nivel de detalle según el sombrero con el que trabaje el usuario (negocio vs. técnico).
- **Pausas conversacionales:** En lugar de *"Confirmar para continuar"*, preferir *"¿Todo bien con esto? Cuando me des el visto bueno seguimos."*.

---

## 7. Reglas de Ingeniería para Crear o Modificar Skills y Subagentes (Invariantes de Arquitectura)

Cualquier agente o desarrollador que cree o modifique un Skill (`_skills/`), un Subagente (`agents/`) o el Orquestador (`orchestrator/`) DEBE cumplir estas invariantes para mantener inalterable el rendimiento y funcionamiento del sistema:

### 7.1. SSOT y Patrón Puntero (Anti-Prompt Drift)
1. **Definición Canónica Única:** Todo subagente se define única y exclusivamente en `agents/<nombre>.md` o en subcarpetas especializadas por capa (`agents/db/<nombre>.md`, `agents/backend/`, etc.) con 3 secciones obligatorias: `1. Identidad y Misión`, `2. Invariantes y Guardrails Estrictos` y `3. Contratos de Ejecución (Inputs, Lógica, Formato de salida)`.
2. **Espejo Puntero en `.claude/_agents/`:** Por cada archivo en `agents/`, debe existir `.claude/_agents/<nombre>.md` (o subcarpeta homóloga `.claude/_agents/db/<nombre>.md`) que contenga **únicamente** el frontmatter YAML (`name`, `description`, `tools`) y la instrucción de una línea: `Lee y adopta estrictamente la identidad, rol, guardrails y contratos de ejecución definidos en el archivo canónico del agente: agents/<capa>/<nombre>.md`. Prohibido duplicar el prompt.
3. **Desacoplamiento Skill ↔ Agente:** Los archivos `_skills/<skill>/SKILL.md` NO deben contener el prompt del sistema del subagente; solo especifican en qué paso se invoca, qué archivos/variables recibe como input y cómo se persiste o valida su salida.

### 7.2. Matriz de Autonomía y Mínimo Privilegio (Permisos y Herramientas)
1. **Autonomía en la Generación de Artefactos (Subagentes Especializados):**
   - Los subagentes técnicos (`agents/db/`, `agents/backend/`, etc.) poseen las herramientas necesarias para escribir y mantener sus propios archivos en disco (`tools: [Read, Write, Edit]` y `bash` para subagentes ejecutores de pruebas como `db-qa-agent`).
   - Cada subagente escribe directamente sus entregables en las rutas estandarizadas (ej. `proposal.md`, `specs/`, migraciones SQL, suites de prueba y reportes) sin volcar contenidos completos en el chat ni delegar la persistencia manual en el skill.
2. **Subagentes de Análisis Puro o Consultivos:** Los subagentes de discovery o auditoría preliminar que no producen artefactos persistentes pueden mantenerse con `tools: [Read]`.
3. **Exclusividad Estricta de Git:** Ningún `SKILL.md` ni `agents/*.md` puede ejecutar `git add`, `git commit`, `git push` o `git branch`. Los subagentes y skills solo emiten la señal `[LISTO PARA COMMIT] <ruta>` y delegan la gobernanza y ejecución de Git al Orquestador principal (`orchestrator/ORCHESTRATOR.md`), siempre tras confirmación explícita del usuario.

### 7.3. Prevención de Handoff Drift y Neutralidad de Contexto
1. **Handoff por Archivo, no por Memoria:** Cuando `tiene_repositorio = true`, la comunicación entre pasos o entre skills se realiza leyendo el archivo persistido en disco en el paso anterior (ej. `docs/prd/...`, `docs/backlog/...`, `sdd/.../spec.md`). Queda prohibido pasar resúmenes improvisados en memoria cuando existe un artefacto en disco.
2. **Prohibición de Sesgo del Orquestador:** Al invocar un subagente, el orquestador tiene **prohibido** inyectar suposiciones, opiniones, decisiones técnicas no solicitadas o contexto derivado de su propio sesgo. Solo está autorizado a transferir: (a) instrucciones o contexto dados explícitamente por el usuario, y (b) artefactos validados en pasos anteriores.
3. **Verificación de Pre-condiciones (Input Gate):** Todo Skill que reciba outputs de un Skill previo debe verificar en su Paso inicial que los archivos requeridos existan en disco antes de invocar a cualquier subagente. Si faltan, debe detenerse e informar qué paso previo debe completarse.
4. **Invariabilidad de Variables de Sesión:** Todo nuevo Skill debe reutilizar estrictamente los nombres de variables de sesión globales:
   - `idioma`
   - `tiene_repositorio` (`true` | `false`)
   - `tipo_proyecto` (`greenfield` | `brownfield`)
   - `prefijo_avance` (`0001`, `0002`, ...)
   - `sufijo` (`kebab-case`)
   Si el usuario entra directamente al Skill sin pasar por el Paso 0 global, el Skill debe detectarlas en disco o solicitarlas con el mismo contrato.

### 7.4. Presupuesto de Contexto y Rendimiento (Lazy Loading)
1. **Carga Perezosa (Lazy Evaluation):** El agente principal NUNCA debe leer todos los `SKILL.md` ni todos los `agents/*.md` al iniciar la sesión. Solo debe leer el archivo correspondiente a la opción elegida por el usuario en el Punto de Entrada, y cargar cada subagente únicamente en el paso exacto donde se le invoca.
2. **Payload Mínimo al Subagente:** Al invocar un subagente, pasarle exclusivamente las rutas de archivos o el bloque de datos declarado en su sección `Inputs recibidos`, nunca el historial completo de la charla.
3. **Límite de Granularidad:**
   - Un archivo `agents/<nombre>.md` no debe exceder ~150 líneas (mantener instrucciones densas, deterministas y sin relleno).
   - Un archivo `_skills/<nombre>/SKILL.md` debe contener entre 3 y 8 pasos interactivos como máximo. Si un flujo supera los 8 pasos, debe particionarse en 2 Skills secuenciales conectados por `ORCHESTRATOR.md` con un commit intermedio.

### 7.5. Protocolo HITL (Human-in-the-Loop) e Idempotencia
1. **Plantilla Obligatoria de Fin de Turno:** Todo paso interactivo dentro de un `SKILL.md` debe cerrar con el bloque literal:
   `**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**` seguido de las instrucciones explícitas de detención.
2. **Un Subagente por Turno Interactivo:** Prohibido encadenar dos subagentes en un mismo turno si el output del primero requiere validación humana o sirve de especificación (`spec.md` / `plan.md` / `PRD`) para el segundo.
3. **Trazabilidad SDD 1:1 (Anti-Invención):** En flujos de desarrollo o base de datos (SDD), ningún agente de implementación puede agregar tablas, columnas, endpoints o lógica que no estén declarados en el `spec.md` aprobado. Cualquier omisión detectada durante la implementación o QA obliga a reportar el *drift* y actualizar el `spec.md` antes de regenerar código.

### 7.6. Scripts Deterministas y Validadores (Cross-Platform Node.js)
1. **Runtime Universal en Node.js:** Todo script provisto en `scripts/` debe escribirse en Node.js (`.js`) usando módulos estándar (`fs`, `path`). Queda terminantemente prohibido utilizar scripts dependientes de sistemas operativos específicos (como PowerShell `.ps1` o scripts con sintaxis no portable de Bash).
2. **Sin Dependencias Externas:** No exigir paquetes externos ni `npm install` para la ejecución de scripts en `scripts/`. Deben correr con la instalación nativa de Node.js del entorno del agente.
3. **Exploración Previa y Pase de Parámetros:** Los skills deben explorar el proyecto del usuario en los pasos previos y pasar las rutas y parámetros detectados mediante flags CLI (`--flag valor`). Los scripts no deben hardcodear estructuras de carpetas asumidas ni rutas absolutas.

### 7.7. Checklist de No-Regresión al Agregar un Nuevo Componente
Antes de dar por terminado un nuevo Skill o Subagente, verificar:
- [ ] ¿Se creó `agents/<nombre>.md` y su puntero exacto en `.claude/_agents/<nombre>.md`?
- [ ] ¿El frontmatter del `SKILL.md` declara `name`, `version`, `description`, `trigger`, `tools_required`, `subagents`, `inputs`, `outputs` y `commits`?
- [ ] ¿El handoff hacia el subagente está libre de sesgos del orquestador (solo contexto del usuario + archivos en disco)?
- [ ] ¿Respeta el modo dual (`tiene_repositorio = true` escribe a disco y resume en chat vs. `tiene_repositorio = false` vuelca en chat)?
- [ ] ¿Respeta la numeración incremental (`<NNNN>-`) sin sobrescribir entregas anteriores?
- [ ] ¿Se registró en el Mapa de Componentes y Punto de Entrada de `AGENTS.md` y `orchestrator/ORCHESTRATOR.md` sin alterar los pasos de los skills existentes?
- [ ] ¿Todo script auxiliar en `scripts/` está implementado en Node.js nativo (sin dependencias externas ni `.ps1`), y recibe parámetros vía flags CLI tras la exploración previa del repositorio?
