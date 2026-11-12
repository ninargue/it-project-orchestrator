# Changelog — it-project-orchestrator

Todos los cambios notables de este plugin se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionado siguiendo [Semantic Versioning](https://semver.org/).

> **Regla de registro:** Documentar en cada versión o en `[Unreleased]` únicamente el resultado neto de las capacidades, mejoras o correcciones respecto a `master` (última versión publicada). Prohibido listar iteraciones intermedias, correcciones internas o refactorizaciones ocurridas dentro de una misma rama antes de su fusión.

---

## [Unreleased]

### Añadido
- **Integración de Specification-Driven Development (`_skills/sdd-init/` y workflows `opsx:*`):** Configuración automatizada y contextual de `openspec/config.yaml` en el repositorio de desarrollo e incorporación de los workflows `opsx:explore`, `opsx:propose`, `opsx:apply`, `opsx:verify`, `opsx:sync`, `opsx:archive` y `opsx:bulk-archive` ejecutados desde el plugin.
- **Sistema Multi-Agente y Ciclo SDD de Base de Datos (`_skills/db-sdd/` y `agents/db/`):** Ciclo de base de datos guiado por especificaciones y **DB-TDD** (Red → Green → Verify → Mutation) con 5 subagentes especializados (`db-architect-agent`, `db-developer-agent`, `db-security-agent`, `db-qa-agent` y `db-mutation-tester`) que ejecutan nativamente los workflows de OpenSpec, soportan modos condicionales (con/sin RLS, migraciones simétricas o *forward-only*, seeds opcionales) y organizan los tests por dominio según la estructura del repositorio.
- **Validador Mecánico Multiplataforma (`scripts/validate-db-migrations.js`):** Script determinista en Node.js nativo (sin dependencias externas) para verificar simetría y reversibilidad de migraciones, índices en claves foráneas por ámbito de tabla, cobertura de políticas RLS y columnas sensibles (PII).
- **Dispatcher por Capa, Tickets Multi-Capa e Invariantes de Arquitectura (`orchestrator/ORCHESTRATOR.md` y `AGENTS.md`):** Plan de ejecución validado en Fase 3, gestión de tickets multi-capa con archivado atómico (`opsx:bulk-archive`), bloqueo global de `git` para subagentes en `hooks/register.ts` y reglas de ingeniería (§7) para creación y mantenimiento de skills y subagentes.
- **Sistema Multi-Agente y Ciclo SDD de Backend (`_skills/backend-sdd/` y `agents/backend/`):** Flujo de desarrollo backend guiado por especificaciones (`opsx:propose`, `opsx:apply`, `opsx:verify`) y **Backend-TDD por dominio** con 3 subagentes especializados (`api-architect-agent`, `backend-developer-agent`, `backend-qa-agent`) y soporte adaptativo (`with-db`/`stateless`, `rls_mode`, `code-first`/`openapi-first`).
- **Validador Mecánico Backend (`scripts/validate-backend.js`):** Script determinista en Node.js nativo con 4 Gates (pre-condición de BD, validación de escenarios OpenSpec y contratos OpenAPI YAML/JSON, inmutabilidad No-DB-Diff y escaneo de secretos, y trazabilidad/ejecución de suite Backend-TDD).

### Mejorado
- **Alcance estricto del modo sin repositorio:** El modo conversacional (`tiene_repositorio = false`) queda acotado exclusivamente a la Fase 1 (`product-discovery`), exigiendo repositorio o workspace local obligatorio desde `stories-to-tickets` y en todos los flujos SDD (`db-sdd` y `backend-sdd`).

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
