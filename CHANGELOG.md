# Changelog — it-project-orchestrator

Todos los cambios notables de este plugin se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionado siguiendo [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Añadido
- **Sistema Multi-Agente de Base de Datos (`agents/db/`):** 4 subagentes especializados con arquitectura SSOT, mínimo privilegio y punteros espejo en `.claude/_agents/db/`:
  - `db-architect-agent`: Exploración de esquemas vivos, propuesta formal (`proposal.md` con *Non-goals* y riesgos de compatibilidad), modelado ERD Mermaid de alto contraste, diccionario de datos físico y desglose de tareas ordenadas topológicamente (`tasks.md`).
  - `db-developer-agent`: Ejecución de la fase Apply de OpenSpec, generando migraciones SQL simétricas e idempotentes (`up.sql`/`down.sql`) y seeds sintéticos DML coherentes con FKs.
  - `db-security-agent`: Shift-left de seguridad, políticas Row-Level Security (RLS) granulares con índices de soporte, roles/grants DCL de mínimo privilegio y auditoría.
  - `db-qa-agent`: Metodología **DB-TDD** con generación de suite de pruebas unitarias (`database/tests/<change-name>-test.sql`), drift check estricto (Design vs SQL), missing indexes en FKs, simulación de planes EXPLAIN y reportes de QA atómicos e inmutables (`database/reports/<change-name>-qa-report.md`).
- **Skill de Ciclo SDD de Base de Datos (`_skills/db-sdd/`):** Runbook paso a paso que implementa el ciclo Spec-First de OpenSpec (Propose → DB-TDD → Apply: DDL → Apply: Security → Verify) para bases de datos relacionales con límites duros de fin de turno (`🛑 FIN DE TURNO OBLIGATORIO`) respetando la regla de un subagente por turno (§7.5.2).
- **Validaciones Mecánicas Deterministas (`scripts/validate-db-migrations.ps1`):** Script PowerShell de verificación automática (simetría de migraciones, reversibilidad de tablas, índices obligatorios en FKs, activación de RLS y escaneo de campos sensibles PII).
- **Enrutador de Tickets y Gobernanza de Archivado en el Orquestador:** Dispatcher inteligente en `orchestrator/ORCHESTRATOR.md` y `AGENTS.md` que identifica el área del ticket (`capa:db`, `capa:backend`, `capa:frontend`), canaliza a `_skills/db-sdd/SKILL.md` y gobierna el archivado formal de OpenSpec (`opsx:archive`) y el commit en Git.
- **Gobernanza de Tickets Multi-Capa y Bulk Archive:** Regla de Oro 13 en `AGENTS.md` y protocolo en `orchestrator/ORCHESTRATOR.md` para particionar tickets que impactan 2 o más capas en subcarpetas `openspec/changes/<ticket_id>-<capa>/`, secuenciación topológica estricta (`db` → `backend` → `frontend`) y archivado atómico en lote mediante **OpenSpec Bulk Archive** (`/opsx:bulk-archive`).
- **Skill de inicialización SDD (`_skills/sdd-init/`):** Automatiza la configuración de OpenSpec (`openspec/config.yaml`, carpetas `specs/` y `changes/`) en el repositorio de desarrollo sin instalar herramientas locales en el código, extrayendo el contexto del proyecto de forma inteligente.
- **Integración OpenSpec en el orquestador:** Integración del ciclo de desarrollo guiado por especificaciones (SDD) vía plugin, vinculando la opción `[4]` de `AGENTS.md`.

---

## [0.1.2] — 2026-11-09

### Mejorado
- **Concisión en chat:** Emisión de resúmenes ejecutivos con enlaces cuando hay repositorio, evitando volcar documentos completos.
- **Contraste en Mermaid:** Estilos universales de alto contraste en diagramas de dependencias para temas oscuros y claros.
- **Trazabilidad evolutiva:** Prefijo incremental `NNNN-` en alcance, PRD y backlog, con numeración continua de épicas (`E<N>`) e historias (`US-<XX>`).
- **Agrupación y trazabilidad de backlog:** Encapsulación en subcarpetas homónimas al PRD (`docs/backlog/<NNNN>-<proyecto>-<sufijo>/`) con enlaces bidireccionales al PRD/alcance y enlaces directos a cada ticket en la tabla de sizing.
- **Gobernanza de PRs y Git Flow:** Regla de Oro 11 en `AGENTS.md`, plantillas oficiales (`.github/`) y política de ramas estricta que exige ramas `release/*` o `hotfix/*` para `master`.
- **Vinculación y dependencias de issues:** Mapeo explícito de jerarquía padre-hijo (con tasklist de progreso en historias) y dependencias entre tickets al materializar en GitHub/Linear.
- **GitHub Projects v2 y vistas:** Paso opcional para vincular proyectos y generar vistas nativas (Roadmap, Kanban, Backlog) adaptadas a Scrum o Kanban.

---

## [0.1.1] — 2026-11-09

### Corregido
- **Límites de turno:** Directivas taxativas de fin de turno obligatorio en pausas para evitar ejecución desatendida en lote.
- **Compatibilidad Antigravity:** Registro canónico en `plugin.json` y skill maestro en `_skills/it-project-orchestrator/`.

---

## [0.1.0] — 2026-11-09

### Añadido
- **Orquestación punta a punta:**
  - `orchestrator/ORCHESTRATOR.md` — Secuenciación del ciclo Idea-to-Backlog y gobernanza de commits Git con confirmación del usuario.
  - `AGENTS.md` — Instrucciones operativas universales, mapa de componentes, tono, reglas de oro (SSOT, trazabilidad, pausas conversacionales) y protocolo de outputs con/sin repositorio.
- **Skills encapsulados (`_skills/`):**
  - `_skills/product-discovery/SKILL.md` — Pasos 0–8 ejecutables: onboarding y contexto, exploración brownfield, discovery estructurado, propuesta de alcance, consolidación de PRD, revisión adversarial e historias INVEST con criterios Given/When/Then.
  - `_skills/stories-to-tickets/SKILL.md` — Pasos 9–14 ejecutables: descomposición en tickets atómicos de media jornada, grafo de dependencias en Mermaid, T-shirt sizing, matriz impacto/complejidad y materialización de issues.
- **Subagentes canónicos (`agents/`):**
  - `agents/discovery-agent.md` — Reducción de incertidumbre (Fase A) y propuesta de alcance en 5 bloques (Fase B).
  - `agents/adversarial-reviewer.md` — Auditor de producto / Red-Teamer implacable para atacar el PRD y detectar riesgos antes del backlog.
  - `agents/backlog-enrich-agent.md` — Historias INVEST y criterios Given/When/Then como reglas de negocio observables.
  - `agents/tickets-agent.md` — Tickets atómicos, checklist DoD, grafo de dependencias, sizing y matriz de priorización.
  - `agents/issue-materializer-agent.md` — Creación secuencial de issues (padres antes que hijos) en GitHub o Linear.
- **Integración con Claude Code y entornos agénticos:**
  - `.claude-plugin/plugin.json` y `hooks/register.ts` — Registro del comando maestro `/it-project-orchestrator` y control de permisos de Git.
  - `.claude/_agents/` — Punteros de subagentes para Claude Code que referencian los agentes canónicos en `agents/` sin duplicar prompts.
  - Soporte agnóstico para Cursor, Antigravity, OpenAI Codex, Windsurf y OpenCode vía `AGENTS.md`.
- **Plantillas y soporte (`templates/` y `docs/`):**
  - `templates/github/story.yml`, `templates/github/ticket.yml`, `templates/github/issue.md` — Plantillas de issue forms para GitHub.
  - `templates/linear/issue.md` — Plantilla para Linear.
  - `templates/tool-config.template.md` — Configuración de herramientas y metodologías con opciones fácilmente editables.
  - `docs/kickoff-brief-template.md` y `docs/tech-briefing-template.md` — Plantillas para contexto inicial de negocio y técnico.

### Decisiones de diseño y arquitectura
- **Única Fuente de Verdad (SSOT):** La personalidad, guardrails y contratos de los subagentes residen exclusivamente en `agents/*.md`.
- **Encapsulación (`_`):** Carpetas internas prefijadas con `_` (`_skills/`, `.claude/_agents/`) para evitar exposición involuntaria en catálogos de herramientas y asegurar gobierno exclusivo vía el orquestador.
- **Gobernanza estricta:** Ningún subagente ejecuta comandos de Git directamente; solo el orquestador principal interactúa con Git tras confirmación explícita del usuario.
- **Doble modo (con/sin repositorio):** Si el usuario no tiene repositorio de código local, los entregables (PRD, backlog, tickets) se entregan formateados directamente en la conversación.
