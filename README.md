# it-project-orchestrator

Sistema agéntico agnóstico para el ciclo de vida completo de proyectos IT: desde la idea abstracta hasta el backlog técnico ejecutable y el desarrollo guiado por especificaciones (SDD / OpenSpec).

```
idea / pitch  →  PRD + historias  →  tickets  →  issues  →  desarrollo (SDD)
```

Funciona con Claude Code, Cursor, Antigravity, Codex, OpenCode, Windsurf y cualquier asistente o agente que soporte instrucciones en Markdown.

---

## Capacidades Principales

1. **Ciclo Idea-to-Backlog:**
   - **Product Discovery:** Transforma ideas o requerimientos en un PRD consensuado, auditado por un revisor adversarial, e historias de usuario INVEST con criterios Given/When/Then.
   - **Stories to Tickets:** Descompone historias en tickets técnicos atómicos de media jornada, genera grafo de dependencias, T-shirt sizing, matriz de priorización y materializa issues en GitHub o Linear.
2. **Ciclo de Desarrollo SDD (Specification-Driven Development):**
   - Implementación técnica rigurosa guiada por especificaciones y cambios estructurados (`openspec/`).

> 🔒 **Encapsulación:** Los skills y subagentes internos del ciclo idea-a-backlog están prefijados con `_` para evitar exposición involuntaria en los catálogos globales de la herramienta. Son orquestados y gestionados exclusivamente a través del punto de entrada maestro.

---

## Instalación

### Usuarios técnicos — Claude Code

1. Tener [Claude Code](https://claude.ai/code) instalado.
2. Desde el proyecto destino, ejecutar:

```bash
claude plugin add https://github.com/tu-usuario/it-project-orchestrator
```

3. Invocar con el slash command:

```
/it-project-orchestrator
```

### Usuarios técnicos — Antigravity / Cursor / Codex / Windsurf / OpenCode

Apunta tu agente a `AGENTS.md` de este repositorio como punto de entrada:

> "Lee `AGENTS.md` de it-project-orchestrator y sigue las instrucciones."

*(En Cursor o herramientas con soporte de contexto puedes referenciar `@AGENTS.md` directamente en el chat).*

---

## Uso

Un solo comando maestro de entrada. El agente consulta la etapa de trabajo y guía el resto paso a paso:

```
/it-project-orchestrator
```

El agente preguntará:
1. **Etapa de trabajo:** Discovery (PRD), Stories to Tickets, Ciclo completo (Idea-to-Backlog) o Desarrollo con SDD.
2. **Contexto del proyecto:** Greenfield (desde cero) o Brownfield (código existente).
3. **Repositorio:** Con acceso local a Git o modo conversación (si aún no tienes repositorio).

> ⏸️ **Gobernanza:** El agente nunca ejecuta commits ni crea issues sin tu confirmación explícita previa.

---

## Qué produce

| Fase | Output en repositorio | Modo sin repositorio |
|---|---|---|
| **Discovery** | `docs/prd/<proyecto>.md`<br>`docs/prd/alcance-<sufijo>.md` | PRD v0.2 consensuado en chat |
| **Historias** | `docs/backlog/<epica>/us-<historia>.md` | Historias INVEST Given/When/Then en chat |
| **Tickets** | `docs/backlog/<epica>/tickets-<historia>.md`<br>`docs/backlog/backlog-priorizado.md` | Tickets técnicos, grafo y matriz en chat |
| **Issues** | Issues creados en GitHub o Linear | Reporte con URLs / IDs creados |
| **SDD** | `openspec/` (`specs/`, `changes/`) | Especificaciones de código |

---

## Componentes

```text
it-project-orchestrator/
├── .claude-plugin/        # Manifest y configuración del plugin (Claude Code)
├── hooks/                 # Slash command (/it-project-orchestrator)
├── AGENTS.md              # Gobernanza, punto de entrada y reglas de oro del sistema
├── orchestrator/          # Orquestador del flujo punta a punta
├── _skills/               # Skills internos del ciclo idea-to-backlog (encapsulados)
│   ├── product-discovery/ # idea → PRD → revisión adversarial → historias INVEST
│   └── stories-to-tickets/# historias → tickets atómicos → grafo/sizing → issues
├── agents/                # Definición canónica (SSOT) de roles y guardrails (.md)
├── templates/             # Plantillas de issues (GitHub, Linear) y config
├── docs/                  # Plantillas de kickoff y tech-briefing
└── openspec/              # Especificaciones y cambios estructurados (SDD)
```

---

## Estado

| Componente | Estado |
|---|---|
| `product-discovery` | ✅ SKILL.md ejecutable (Pasos 0–8 con revisión adversarial) |
| `stories-to-tickets` | ✅ SKILL.md ejecutable (Pasos 9–14 con grafo, sizing y matriz) |
| `orchestrator` | ✅ ORCHESTRATOR.md ejecutable |
| Subagentes (`agents/`) | ✅ Canónicos (Discovery, Backlog, Tickets, Issues, Adversarial) |
| Plugin Claude Code | ✅ `.claude-plugin/` + `hooks/` |
| Templates GitHub / Linear | ✅ YAML y Markdown listos |
| Templates de documentos | ✅ Listos |
| Desarrollo con SDD | 🟡 Integración con OpenSpec |
