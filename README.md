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
   - Implementación técnica rigurosa guiada por especificaciones y cambios estructurados (`openspec/`), despachada por capa técnica:
   - **Sistema Multi-Agente de Base de Datos (`capa:db` — `_skills/db-sdd/`):** Coordina 5 subagentes especializados (`db-architect-agent`, `db-developer-agent`, `db-security-agent`, `db-qa-agent`, `db-mutation-tester`) y un validador determinista (`scripts/validate-db-migrations.js`) para diseñar el modelo ERD, escribir tests DB-TDD por dominio en ROJO, generar migraciones SQL reversibles, aplicar políticas RLS/DCL y auditar planes `EXPLAIN` y falsabilidad de tests.
   - **Sistema Multi-Agente de Backend (`capa:backend` — [`_skills/backend-sdd/`](_skills/backend-sdd/README.md)):** Diseñado con **separación de responsabilidades** (1 Orquestador + 3 Subagentes en `agents/backend/` + 4 Gates deterministas en `scripts/validate-backend.js`) para evitar que un solo agente haciendo todo a la vez altere contratos por comodidad, modifique accidentalmente la base de datos o adapte los tests para que su propio código pase:
     - **`api-architect-agent`:** Explora el repositorio y diseña la propuesta, especificación Given/When/Then (`spec.md`), arquitectura (`design.md`), contratos (`openapi.yaml` o esquemas *Code-First* como FastAPI/Pydantic) y `tasks.md` vía `opsx:propose`.
     - **`backend-qa-agent`:** En **Fase A (Pre-Apply)** escribe la suite de tests de contrato, integración y seguridad organizada por dominio/módulo y comprueba que falle en **🔴 ROJO**; en **Fase B (Post-Apply)** certifica el paso a **🟢 VERDE**, audita la ausencia de *drift* o bypasses de seguridad (RLS/RBAC/IDOR) y genera `verification-report.md` vía `opsx:verify`.
     - **`backend-developer-agent`:** Ejecuta `opsx:apply` implementando las capas del backend (DTOs/Schemas, Repositorios, Servicios y Controladores/Routers/Workers) consumiendo la BD de forma **100% inmutable** (verificado mecánicamente con `git diff --exit-code` sobre directorios de BD) y sin permiso para tocar los tests.

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
3. **Repositorio:** Con acceso local a Git (obligatorio desde *Stories to Tickets* y en todo *Desarrollo con SDD*) o modo conversación (disponible únicamente para *Product Discovery*).

> ⏸️ **Gobernanza:** El agente nunca ejecuta commits ni crea issues sin tu confirmación explícita previa.

---

## Qué produce

| Fase | Output en repositorio | Modo sin repositorio |
|---|---|---|
| **Discovery** | `docs/prd/<NNNN>-alcance-<sufijo>.md`<br>`docs/prd/<NNNN>-<proyecto>-<sufijo>.md` | PRD v0.2 consensuado en chat |
| **Historias** | `docs/backlog/<NNNN>-<proyecto>-<sufijo>/E<N>-<epica>/us-<historia>.md` | Historias INVEST Given/When/Then en chat |
| **Tickets** | `docs/backlog/<NNNN>-<proyecto>-<sufijo>/E<N>-<epica>/tickets-<historia>.md`<br>`docs/backlog/<NNNN>-<proyecto>-<sufijo>/<NNNN>-backlog-priorizado.md` | *N/A — Requiere repositorio/workspace local* |
| **Issues** | Issues creados en GitHub o Linear | *N/A — Requiere repositorio/workspace local* |
| **SDD — Base de Datos (`capa:db`)** | `openspec/changes/<change>/` (`proposal`, `specs`, `design`, `tasks`, `verification-report`, `mutation-report`), `<migrations_dir>/`, `<security_dir>/`, `<seeds_dir>/`, `<tests_dir>/<entidad>...` | *N/A — Requiere repositorio/workspace local* |
| **SDD — Backend (`capa:backend`)** | `openspec/changes/<change>/` (`proposal`, `specs`, `design`, `tasks`, `verification-report`), `<openapi_path>` (si aplica), `<backend_dir>/**` (DTOs, Repositorios, Servicios, Routers/Workers), `<tests_dir>/<modulo>...` | *N/A — Requiere repositorio/workspace local* |

---

## Componentes

```text
it-project-orchestrator/
├── .claude-plugin/        # Manifest y configuración del plugin (Claude Code)
├── hooks/                 # Slash command (/it-project-orchestrator) y bloqueo de Git en subagentes
├── AGENTS.md              # Gobernanza, punto de entrada y reglas de oro del sistema
├── orchestrator/          # Orquestador del flujo punta a punta y dispatcher SDD multi-capa
├── _skills/               # Skills internos del ciclo idea-to-backlog y SDD (encapsulados)
│   ├── product-discovery/ # idea → PRD → revisión adversarial → historias INVEST
│   ├── stories-to-tickets/# historias → tickets atómicos → grafo/sizing → issues
│   ├── sdd-init/          # inicialización de OpenSpec (openspec/config.yaml)
│   ├── db-sdd/            # ciclo SDD de base de datos + DB-TDD + validaciones mecánicas
│   └── backend-sdd/       # ciclo SDD de capa backend + Backend-TDD + 4 Gates deterministas
├── agents/                # Definición canónica (SSOT) de roles y guardrails (.md)
│   ├── db/                # Subagentes de Base de Datos (Architect, Developer, Security, QA, Mutation)
│   └── backend/           # Subagentes de Backend (API Architect, Backend Developer, Backend QA)
├── scripts/               # Validadores mecánicos deterministas multiplataforma en Node.js
│   ├── validate-db-migrations.js
│   └── validate-backend.js
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
| `orchestrator` | ✅ ORCHESTRATOR.md ejecutable con Dispatcher SDD mono-capa y multi-capa |
| `sdd-init` | ✅ Inicialización de OpenSpec y `config.yaml` contextual |
| `db-sdd` (`capa:db`) | ✅ SKILL.md ejecutable + 5 subagentes en `agents/db/` + `validate-db-migrations.js` |
| `backend-sdd` (`capa:backend`) | ✅ SKILL.md ejecutable + 3 subagentes en `agents/backend/` + `validate-backend.js` (4 Gates) |
| Subagentes Core (`agents/`) | ✅ Canónicos (Discovery, Backlog, Tickets, Issues, Adversarial) |
| Plugin Claude Code | ✅ `.claude-plugin/` + `hooks/` |
| Templates GitHub / Linear | ✅ YAML y Markdown listos |
| Templates de documentos | ✅ Listos |
