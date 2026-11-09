# Changelog — it-project-orchestrator

Todos los cambios notables de este plugin se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionado siguiendo [Semantic Versioning](https://semver.org/).

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
