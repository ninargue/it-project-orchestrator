# Changelog — it-project-orchestrator

Todos los cambios notables de este plugin se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionado siguiendo [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Añadido
- **Simplificación de Paso 0 y Delegación de Exploración:** Reducción del Paso 0 en `_skills/db-sdd/` estrictamente a Input Gate (§7.3.3) sin pausas redundantes; la exploración técnica del repositorio (`engine`, `migrations_dir`, `migration_mode`, `rls_mode`, `requires_seeds`, `test_cmd`) se delega a `db-architect-agent` en la Fase A.
- **Sistema Multi-Agente de Base de Datos (`agents/db/`):** 5 subagentes especializados (`db-architect-agent`, `db-developer-agent`, `db-security-agent`, `db-mutation-tester`, `db-qa-agent`) bajo arquitectura SSOT y autonomía de persistencia (`tools: [Read, Write, Edit, bash]`).
- **Input Gate y Variables de Sesión Globales (§7.3.3 y §7.3.4):** Verificación de pre-condiciones en `_skills/db-sdd/` (bloqueo estricto ante ausencia de `openspec/config.yaml` o ticket) y gobierno de variables de sesión en modo dual (`tiene_repositorio`).
- **Estandarización de `_skills/sdd-init/`:** Frontmatter canónico (`subagents: []`, `commits:`), plantilla obligatoria de fin de turno (§7.5.1) y variables de sesión.
- **Autonomía de Subagentes (Invariante 7.2):** Los subagentes técnicos generan y editan directamente sus archivos en disco en lugar de delegar la escritura en el skill.
- **Ciclo DB-TDD Bifásico en QA:** `db-qa-agent` redacta la suite y valida estado ROJO en la fase Red antes del desarrollo; tras la implementación, ejecuta el runner (`make test-db`) para certificar el paso a VERDE y auditar drift.
- **Condicionalidades del Ciclo SDD:** Soporte para proyectos sin RLS (`--no-rls`), migraciones *forward-only* o simétricas, seeds opcionales (`requires_seeds`), actualización de ERD consolidado solo ante tablas/FKs nuevas y mutation testing condicional ante constraints/RLS.
- **Mutation Testing en Base de Datos (`agents/db/db-mutation-tester.md`):** Subagente para validar la robustez de la suite de tests contra 5 mutantes canónicos antes de la aprobación de QA.
- **Comandos Nativos OpenSpec CLI:** Integración de `openspec new change`, `openspec instructions` y `openspec validate` en `_skills/db-sdd/` y `db-architect-agent`.
- **Skill de Ciclo SDD de Base de Datos (`_skills/db-sdd/`):** Runbook Spec-First con metodología DB-TDD, fases Apply desacopladas (DDL y Security) y pausas HITL obligatorias (§7.5.2).
- **Especificación de Datos en OpenSpec (`specs/`):** Generación formal de `specs/<capability>/spec.md` con requisitos y escenarios Given/When/Then como contrato de verdad para DB-TDD.
- **Feedback Loop y Resiliencia en DB-TDD:** Bifurcación en Verify con retroalimentación a desarrollo/seguridad ante fallos (sin modificar tests) y eliminación de sesgo de Postgres en QA.
- **Validador Mecánico Multiplataforma (`scripts/validate-db-migrations.js`):** Script universal en Node.js para validación determinista de FKs con ámbito por tabla, simetría up/down, RLS y PII en múltiples motores.
- **Exploración e Integración de Runners:** Detección de infraestructura (motor, directorios) y ejecución complementaria de runners nativos del proyecto (`npm run db:validate`, `make db-validate`, `uv run db-validate`).
- **Gobernanza de Tickets Multi-Capa:** Protocolo en el orquestador para particionar tickets cross-cutting (`<ticket_id>-<capa>/`), secuenciación topológica y archivado atómico con OpenSpec Bulk Archive.
- **Invariante de Scripts en Node.js:** Regla de Oro 14 y §7.6 en `AGENTS.md` exigiendo scripts multiplataforma sin dependencias de SO (`.ps1`).
- **Alto Contraste en `erDiagram` de Mermaid:** Directiva de tema `%%{init: ...}%%` para diagramas ER en `AGENTS.md` y `db-architect-agent.md`, evitando `linkStyle`.
- **Resolución de Rutas del Plugin (`hooks/register.ts`):** Mapeo de `scripts/`, `agents/` y datos de usuario contra la raíz del plugin.
- **Skill de Inicialización SDD (`_skills/sdd-init/`):** Configuración de OpenSpec en el proyecto destino vía plugin.

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
