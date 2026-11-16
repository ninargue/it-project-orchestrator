# Changelog — it-project-orchestrator

Todos los cambios notables de este plugin se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionado siguiendo [Semantic Versioning](https://semver.org/).

> **Regla de registro:** Documentar en cada versión o en `[Unreleased]` únicamente el resultado neto de las capacidades, mejoras o correcciones respecto a `master` (última versión publicada). Prohibido listar iteraciones intermedias, correcciones internas o refactorizaciones ocurridas dentro de una misma rama antes de su fusión.

---

## [Unreleased]

---

## [0.3.0] — 2026-11-15

### Añadido
- **Mutation Testing en el ciclo SDD de Backend (`agents/backend/backend-mutation-tester.md` y `_skills/backend-sdd/`):** Nuevo subagente especializado en falsabilidad (`1 Orquestador + 4 Subagentes`) como Gate Condicional (Paso 5) posterior a `opsx:verify` en verde, con soporte para `mutation_cmd` nativo o catálogo canónico `M1–M5`, verificación determinista de árbol limpio sin `git`, ruteo condicional anticipado en Paso 4 y reporte en `openspec/changes/<change-name>/mutation-report.md` (#29).
- **Sistema Multi-Agente y Ciclo SDD de Frontend (`_skills/frontend-sdd/`, `_skills/ui-discovery/`, `agents/frontend/` y `.claude/_agents/frontend/`):** Flujo de desarrollo frontend Contract-First (con soporte `frontend-driven` gobernado y paralelización condicional post-Gate 2 de Backend), **Frontend-TDD Design-Blind**, `opsx:verify` post-auditoría y **Mutation Testing** (`frontend-mutation-tester`) con 7 subagentes especializados (#28).
- **Validador Mecánico Frontend (`scripts/validate-frontend.js`):** Script determinista en Node.js nativo (sin dependencias externas) con 4 Gates para validar OpenAPI/`openapi_hash`, artefactos OpenSpec, inmutabilidad de capas protegidas, selectores *Design-Blind*, presupuesto de bundle y control de reintentos (`revision_count` / `diff_history`) en disco (#28).
- **Asignación de Modelos, Esfuerzo y Tiers por Agente y Skill (`AGENTS.md`, `agents/`, `.claude/_agents/`, `_skills/`):** Matriz de 3 tiers (`reasoning`: `opus`/`pro`, `balanced`: `sonnet`/`inherit`, `fast`: `haiku`/`flash_lite`) y niveles de `effort` (`high` para arquitectura, adversarial, mutation testing, QA, seguridad y auditoría; `medium` para implementación, discovery y tickets; `low` para materialización) declarados en los 21 agentes canónicos, sus 21 espejos de Claude Code y los 6 skills que invocan subagentes (#32).
- **Memoria Híbrida ante Errores SDD (`scripts/sdd-error-memory.js`, `AGENTS.md`, `ORCHESTRATOR.md`, `_skills/`, `agents/`):** Gestión determinista 100% agnóstica al SO de memoria efímera por cambio (`openspec/changes/<change>/.sdd-state.json`) con detección anti-loop por firma de error normalizada (`exit 2`), resumen compacto para reintentos y promoción selectiva con confirmación HITL a `openspec/specs/<capa>/known-gotchas.md` antes de archivar (#34).
- **Rol de Solo Lectura, Exploración en Vivo y Matriz de Ambientes BD (`templates/db/`, `_skills/sdd-init/SKILL.md`, `_skills/db-sdd/SKILL.md`, `agents/db/db-architect-agent.md`):** Plantillas SQL para rol `agent_ro` con `ALTER DEFAULT PRIVILEGES` (`readonly-role.postgres.sql`, `readonly-role.mysql.sql`), ejemplo MCP opcional (`mcp-db.example.json`), bloque `db.environments` en `openspec/config.yaml`, gate en Paso 0 verificando `DB_TEST_URL != DB_DEV_URL` y `healthcheck`, y sección `## Estado observado de la base` en `design.md` (#36, #40).
- **Hook contra Órdenes Destructivas y Copias de Producción (`hooks/guards/destructive.js`, `hooks/guards/destructive.test.js`, `hooks/register.ts`):** Bloqueo determinista de `DROP`/`TRUNCATE`/`DELETE`/`UPDATE` sin `WHERE`, resets de migraciones, borrado de volúmenes/datos y lectura de `*.dump`/`*.bak`/`backups/` (con excepción acotada únicamente a `$DB_TEST_URL != $DB_DEV_URL`), cabecera explícita de «lo que no ve» y suite de pruebas con entradas bloqueadas y permitidas (#36, #43).
- **Reversibilidad Real, Expand/Contract y Gate `db-roundtrip.js` (`scripts/db-roundtrip.js`, `scripts/db-roundtrip.test.js`, `agents/db/db-architect-agent.md`, `agents/db/db-developer-agent.md`, `_skills/db-sdd/SKILL.md`):** Secciones `## Reversibilidad` (conteo real de filas y clasificación `reversible` / `falla-en-alto` / `pierde-datos`) y `## Normalización` en `design.md`, regla Expand/Contract en dos cambios para borrar columnas con datos, y gate determinista `up → snapshot → down → snapshot → up → snapshot` (o idempotencia en `forward-only`) contra `DB_TEST_URL` (#36, #44).
- **Recorte de Herramientas, Huella de Tests y Dictamen Independiente (`hooks/policies/db.js`, `scripts/db-test-fingerprint.js`, `scripts/db-verify-gate.js`, `agents/db/`, `.claude/_agents/db/`):** Políticas por subagente DB en `hooks/register.ts` (quitando `Edit` a `db-mutation-tester` y aislando rutas/comandos), congelamiento/verificación SHA-256 de tests entre ROJO y VERDE en `.sdd-state.json`, dictamen `[APROBADO]` emitido por `db-verify-gate.js` en lugar de `db-qa-agent`, y M3 acotado exclusivamente a `DB_TEST_URL` (#36, #46).
- **Reducción de Pausas en `db-sdd` (`AGENTS.md`, `_skills/db-sdd/SKILL.md`):** Excepción SDD gobernada en `AGENTS.md` (§4.2 y §7.5.2) para avanzar sin pausa cuando todos los gates deterministas están en verde; `db-sdd` pasa de 6–7 pausas por ticket a 2 (aprobación del plan y cierre), manteniendo escaladas ante cualquier fallo (#36, #49).
- **Convenciones Únicas, Seeds, Copia de Producción y Verificación en Base Viva (`templates/db/conventions.md`, `_skills/db-sdd/references/prod-copy.md`, `openspec/config.yaml`, `_skills/sdd-init/`, `agents/db/`, `scripts/db-verify-gate.js`):** Fuente única de convenciones BD (con matriz de aplicación `test`/`dev`/`prod` y estilos ERD fuera de los invariantes del arquitecto), seeds con 4 condiciones (reglas de negocio, inventados, fechas relativas, idempotentes/solo dev), runbook de anonimización de copias de producción ejecutado por persona, `--schema-codegen-cmd` / `--typecheck-cmd` en `db-verify-gate.js`, y verificación contra `information_schema` + sección `## Punto ciego` en `verification-report.md` (#36, #50).

### Mejorado
- **Blindaje del Ciclo SDD de Backend (`_skills/backend-sdd/`, `agents/backend/`, `hooks/guards/backend-roles.js`, `scripts/validate-backend.js`):** Huella SHA-256 de tests entre ROJO y VERDE, separación de permisos y hooks por subagente, validación de rojo válido (`verify-red`), canal de disputa humano, soporte de migraciones ORM no-SQL en Gate 1, instantánea inicial en Gate 3, `--test-cmd` obligatorio en Gate 4, aislamiento de `backend-mutation-tester` y consolidación de pausas (#38, #39, #47, #51).
- **Blindaje del Sistema de Diseño y Ciclo SDD de Frontend (`_skills/frontend-sdd/`, `_skills/ui-discovery/`, `agents/frontend/`, `scripts/validate-frontend.js`):** Gate 3 por instantánea inicial sin falso rojo por archivos sin commitear, inventario del sistema de diseño y origen explícito por pieza en `design.md`/`tasks.md`, tokens atados al catálogo existente, aviso no bloqueante de colores literales fuera de tokens (`--tokens-path`), revisión humana del aspecto, catálogo ejecutable por estado con a11y, recorrido E2E único, aislamiento de QA Fase A, `--strict-cmds`, métrica de bundle inicial (`--entry-pattern`), aislamiento de `frontend-mutation-tester` y consolidación de pausas (#41, #42, #45, #48).

### Corregido
- **Validador de Migraciones sin Falso Verde (`scripts/validate-db-migrations.js`, `scripts/validate-db-migrations.test.js`, `_skills/db-sdd/SKILL.md`):** El validador ahora falla con `exit 3` cuando no encuentra directorio ni archivos SQL o cuando detecta motor NoSQL sin `--allow-nosql-skip`, agrega soporte `--sql-from-cmd` / `--down-sql-from-cmd` para migraciones de ORMs, `--migration-mode`, salida `--json` y su suite de pruebas deterministas con `node:test` (#36, #37).

---

## [0.2.0] — 2026-11-12

### Añadido
- **Integración de Specification-Driven Development (`_skills/sdd-init/` y workflows `opsx:*`):** Configuración automatizada y contextual de `openspec/config.yaml` en el repositorio de desarrollo e incorporación de los workflows `opsx:explore`, `opsx:propose`, `opsx:apply`, `opsx:verify`, `opsx:sync`, `opsx:archive` y `opsx:bulk-archive` ejecutados desde el plugin (#21).
- **Sistema Multi-Agente y Ciclo SDD de Base de Datos (`_skills/db-sdd/` y `agents/db/`):** Ciclo de base de datos guiado por especificaciones y **DB-TDD** (Red → Green → Verify → Mutation) con 5 subagentes especializados (`db-architect-agent`, `db-developer-agent`, `db-security-agent`, `db-qa-agent` y `db-mutation-tester`) que ejecutan nativamente los workflows de OpenSpec, soportan modos condicionales (con/sin RLS, migraciones simétricas o *forward-only*, seeds opcionales) y organizan los tests por dominio según la estructura del repositorio (#19).
- **Validador Mecánico Multiplataforma (`scripts/validate-db-migrations.js`):** Script determinista en Node.js nativo (sin dependencias externas) para verificar simetría y reversibilidad de migraciones, índices en claves foráneas por ámbito de tabla, cobertura de políticas RLS y columnas sensibles (PII) (#19).
- **Dispatcher por Capa, Tickets Multi-Capa e Invariantes de Arquitectura (`orchestrator/ORCHESTRATOR.md` y `AGENTS.md`):** Plan de ejecución validado en Fase 3, gestión de tickets multi-capa con archivado atómico (`opsx:bulk-archive`), bloqueo global de `git` para subagentes en `hooks/register.ts` y reglas de ingeniería (§7) para creación y mantenimiento de skills y subagentes (#20, #21).
- **Sistema Multi-Agente y Ciclo SDD de Backend (`_skills/backend-sdd/` y `agents/backend/`):** Flujo de desarrollo backend guiado por especificaciones (`opsx:propose`, `opsx:apply`, `opsx:verify`) y **Backend-TDD por dominio** con 3 subagentes especializados (`api-architect-agent`, `backend-developer-agent`, `backend-qa-agent`) y soporte adaptativo (`with-db`/`stateless`, `rls_mode`, `code-first`/`openapi-first`) (#23).
- **Validador Mecánico Backend (`scripts/validate-backend.js`):** Script determinista en Node.js nativo con 4 Gates (pre-condición de BD, validación de escenarios OpenSpec y contratos OpenAPI YAML/JSON, inmutabilidad No-DB-Diff y escaneo de secretos, y trazabilidad/ejecución de suite Backend-TDD) (#23).

### Mejorado
- **Alcance estricto del modo sin repositorio:** El modo conversacional (`tiene_repositorio = false`) queda acotado exclusivamente a la Fase 1 (`product-discovery`), exigiendo repositorio o workspace local obligatorio desde `stories-to-tickets` y en todos los flujos SDD (`db-sdd` y `backend-sdd`) (#23).

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

### Mejorado
- **Blindaje del Ciclo SDD de Backend (`_skills/backend-sdd/`, `agents/backend/`, `hooks/guards/backend-roles.js`, `scripts/validate-backend.js`):** Huella SHA-256 de tests entre ROJO y VERDE, separación de permisos y hooks por subagente, validación de rojo válido (`verify-red`), canal de disputa humano, soporte de migraciones ORM no-SQL en Gate 1, instantánea inicial en Gate 3, `--test-cmd` obligatorio en Gate 4, aislamiento de `backend-mutation-tester` y consolidación de pausas (#38, #39, #47, #51).
- **Blindaje del Sistema de Diseño y Ciclo SDD de Frontend (`_skills/frontend-sdd/`, `_skills/ui-discovery/`, `agents/frontend/`, `scripts/validate-frontend.js`):** Gate 3 por instantánea inicial sin falso rojo por archivos sin commitear, inventario del sistema de diseño y origen explícito por pieza en `design.md`/`tasks.md`, tokens atados al catálogo existente, aviso no bloqueante de colores literales fuera de tokens (`--tokens-path`), revisión humana del aspecto, catálogo ejecutable por estado con a11y, recorrido E2E único, aislamiento de QA Fase A, `--strict-cmds`, métrica de bundle inicial (`--entry-pattern`), aislamiento de `frontend-mutation-tester` y consolidación de pausas (#41, #42, #45, #48).

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
