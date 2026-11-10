# Changelog — it-project-orchestrator

Todos los cambios notables de este plugin se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionado siguiendo [Semantic Versioning](https://semver.org/).

---

## [0.1.2] — 2026-11-09

### Mejorado
- **Concisión en Chat vs. Persistencia en Disco (No duplicar contenido):**
  - Se incorporó la **Regla de Oro 9** en `AGENTS.md` prohibiendo terminantemente volcar el contenido completo de los documentos `.md` en los mensajes de chat cuando hay acceso al repositorio (`tiene_repositorio = true`).
  - En `_skills/product-discovery/SKILL.md` (Pasos 4, 5, 8) y `_skills/stories-to-tickets/SKILL.md` (Paso 13), el agente ahora emite únicamente resúmenes ejecutivos concisos (tablas resumen, enlaces directos a los archivos en disco y decisiones abiertas), reservando el volcado completo en conversación exclusivamente para cuando no se tiene acceso al repositorio (`tiene_repositorio = false`) para la validación previa a la generación de PDFs.
  - Se actualizaron los contratos de guardrails en `agents/backlog-enrich-agent.md`, `agents/tickets-agent.md` y `orchestrator/ORCHESTRATOR.md`.
- **Alto contraste universal en diagramas Mermaid:**
  - Se añadieron directivas y clases explícitas de alto contraste (`fill:#1e293b, stroke:#38bdf8, color:#ffffff` y `linkStyle default stroke:#94a3b8`) en `AGENTS.md`, `agents/tickets-agent.md` y `_skills/stories-to-tickets/SKILL.md` (Paso 10 y 13) para asegurar contraste nítido y texto 100% legible tanto en temas oscuros como claros de cualquier visor Markdown o chat.

---

## [0.1.1] — 2026-11-09

### Corregido
- **Límites duros de turno (Hard Turn Boundaries):**
  - Se sustituyeron todas las pausas ambiguas (`⏸ PAUSA: Continuar al Paso X`) por directivas taxativas `🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO` en todos los pasos de `_skills/product-discovery/SKILL.md` (Pasos 0c–8) y `_skills/stories-to-tickets/SKILL.md` (Pasos 9–14).
  - Se incorporó la **Regla de Oro 8** en `AGENTS.md` prohibiendo estrictamente la ejecución multi-paso en un solo turno ("runaway execution" o sesgo de autocompletado), la simulación de respuestas de usuario y el avance sin mensaje explícito.
  - Se reforzó `orchestrator/ORCHESTRATOR.md` con prohibición explícita de ejecución en lote (`BATCH EXECUTION FORBIDDEN`).
- **Compatibilidad con Antigravity:**
  - Registro canónico de plugin en `plugin.json` y skill maestro en `_skills/it-project-orchestrator/SKILL.md`.

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
