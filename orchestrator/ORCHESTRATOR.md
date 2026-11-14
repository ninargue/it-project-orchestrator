---
name: orchestrator
version: 0.1.0
description: Ciclo completo idea-to-backlog para quien tiene acceso a todo el proyecto
trigger: "cuando el usuario elige rol [3] Ciclo completo en el punto de entrada"
skills_invoked:
  - _skills/product-discovery/SKILL.md
  - _skills/stories-to-tickets/SKILL.md
  - _skills/db-sdd/SKILL.md
  - _skills/backend-sdd/SKILL.md
  - _skills/ui-discovery/SKILL.md
  - _skills/frontend-sdd/SKILL.md
  - _skills/sdd-init/SKILL.md
---

# Orquestador — Ciclo completo

Instrucciones exclusivas para el rol `[3] Ciclo completo`.
Los roles `[1]` y `[2]` van directo a su SKILL.md — ver `AGENTS.md`.

Reglas generales, tono y convenciones de archivos: ver `AGENTS.md`.

> 💡 **Concisión en Chat vs. Persistencia (Alcance del Modo Dual):** Cuando `tiene_repositorio = true`, todos los entregables se persisten directamente en disco (`docs/prd/`, `docs/backlog/`, `openspec/`, código y tests). En el chat solo se emiten resúmenes ejecutivos con enlaces; **queda terminantemente prohibido volcar el contenido íntegro de los archivos Markdown en los mensajes**. El modo dual (`tiene_repositorio = false`, volcado completo en chat / previo a PDF) aplica **exclusivamente a la Fase 1 (`product-discovery`)**; a partir de la **Fase 2 (`stories-to-tickets`)** y durante toda la **Fase 3 (SDD)** es obligatorio contar con un repositorio o workspace local (`tiene_repositorio = true`).

---

## FASE 0 — Validación Inicial de Entorno (Pre-flight Check)

Antes de iniciar la Fase 1 (o al retomar cualquier fase con `tiene_repositorio = true`):
1. Verificar que el directorio destino sea un repositorio Git válido (`git rev-parse --is-inside-work-tree`) y consultar la rama activa (`git branch --show-current`).
2. Comprobar que **no** existan conflictos de merge/rebase pendientes ni estado inconsistente (`git status --porcelain`).
   - Si hay conflictos o merge/rebase en curso: **detener** e informar al usuario para resolverlos antes de ejecutar skills.
   - Si hay cambios sin commitear ajenos al flujo: advertir al usuario y pedir confirmación antes de continuar (`🛑`).
3. Verificar la estructura base esperada (`docs/` si existen entregas previas, o inicializar según `AGENTS.md` §5) y confirmar si el ciclo incluirá Fase 3 (SDD), recordando que en ese punto será obligatorio `openspec/config.yaml`.

---

## FASE 1 — Ejecutar Skill 1 (product-discovery)

> 🛑 **PROHIBIDO EJECUTAR EN LOTE (BATCH EXECUTION FORBIDDEN):**
> El orquestador NUNCA debe ejecutar los pasos de forma continua o desatendida. Cada paso individual (`Paso 0` a `Paso 8`) posee una barrera de fin de turno obligatoria. El agente debe detenerse y ceder el control al usuario en cada paso. Queda terminantemente prohibido encadenar pasos en un solo mensaje o simular respuestas del usuario.

1. Iniciar con `_skills/product-discovery/SKILL.md` desde el Paso 0.
2. Conducir la conversación paso a paso, respetando estrictamente el fin de turno en cada pausa hasta el HANDOFF AL SKILL 2 inclusive.
3. Al recibir la señal `[LISTO PARA COMMIT] docs/backlog/`:

   ```
   ⏸️ Skill 1 completado. Voy a commitear los archivos generados antes de continuar.
   Archivos:
   - docs/prd/<NNNN>-alcance-<sufijo>.md
   - docs/prd/<NNNN>-<proyecto>-<sufijo>.md
   - docs/backlog/<NNNN>-<proyecto>-<sufijo>/E<N>-<epica>/us-*.md

   ¿Confirmás el commit?
   ```

4. Tras confirmación explícita del usuario, hacer el commit:

   ```bash
   git add docs/prd/ docs/backlog/
   git commit -m "feat: product discovery — PRD y historias (<proyecto> <sufijo>)"
   ```

5. Confirmar al usuario y continuar a Fase 2.

---

## FASE 2 — Ejecutar Skill 2 (stories-to-tickets)

> 🔒 **Repositorio Obligatorio:** Esta fase requiere `tiene_repositorio = true`. No opera en modo conversación sin repositorio.
> 🛑 **PROHIBIDO EJECUTAR EN LOTE:** Al igual que en la Fase 1, cada paso (`Paso 9` a `Paso 14`) requiere validación interactiva y fin de turno antes de continuar.

1. Verificar que `docs/backlog/<NNNN>-<proyecto>-<sufijo>/E<N>-<epica>/us-*.md` existen en disco.
   Si no existen: detener y avisar — Skill 1 no completó correctamente.

2. Conducir `_skills/stories-to-tickets/SKILL.md` desde el Paso 9 paso a paso con el usuario.
   Los inputs son los archivos commiteados en la Fase 1.

3. Al recibir la señal `[LISTO PARA COMMIT] docs/backlog/<NNNN>-<proyecto>-<sufijo>/ completo`:

   ```
   ⏸️ Skill 2 completado. Voy a commitear el backlog priorizado y los tickets.
   Archivos:
   - docs/backlog/<NNNN>-<proyecto>-<sufijo>/E<N>-<epica>/tickets-*.md
   - docs/backlog/<NNNN>-<proyecto>-<sufijo>/<NNNN>-backlog-priorizado.md

   ¿Confirmás el commit?
   ```

4. Tras confirmación:

   ```bash
   git add docs/backlog/
   git commit -m "feat: stories-to-tickets — tickets y backlog priorizado (<proyecto>)"
   ```

---

## FASE 3 — Ejecutar Desarrollo con SDD (OpenSpec & Dispatcher por Capa)

> 🔒 **Repositorio Obligatorio:** Esta fase requiere `tiene_repositorio = true` (directorio de trabajo del proyecto ya formalmente construido).
> 🛑 **PROHIBIDO EJECUTAR EN LOTE:** Cada paso del ciclo de desarrollo requiere validación interactiva del usuario antes de continuar.

1. **Verificación de Entorno OpenSpec:**
   - Si `openspec/config.yaml` no existe en el repositorio de destino, invocar primero `_skills/sdd-init/SKILL.md` para inicializar el framework.
2. **Selección del Ticket y Análisis de Capas:**
   - Identificar el ticket técnico a implementar (desde `docs/backlog/**/tickets-*.md` o issue de GitHub).
   - Analizar los metadatos, etiquetas y criterios del ticket para determinar:
     - Capas involucradas (`capa:db`, `capa:backend`, `capa:frontend`).
     - Si es **Mono-capa** (impacta una sola área) o **Multi-capa** (impacta 2 o más áreas).
     - Dependencias técnicas entre tareas para fijar la estrategia de concurrencia (secuencial vs. paralelo).

3. **Presentación y Validación del Plan de Ejecución (HITL Obligatorio):**
   - **ANTES de lanzar cualquier skill o subagente**, el orquestador DEBE elaborar y presentar al usuario el **Plan de Ejecución Formal** para su aprobación explícita:

   ```text
   📋 Plan de Ejecución Propuesto — Ticket <ticket_id>
   - Objetivo: <título / descripción breve del ticket>
   - Alcance: <Mono-capa / Multi-capa>
   - Capas afectadas: <Lista de capas: BD, Backend, Frontend>
   
   Ruta de Ejecución Planificada:
     1. [<Secuencial/Paralelo>] <Capa 1>: <Skill y subagentes que intervienen>
        → Subcarpeta OpenSpec: openspec/changes/<ticket_id>-<capa>/
        → Entregables clave esperados
     2. [<Secuencial/Paralelo>] <Capa 2>: <Skill y subagentes que intervienen>
        → Subcarpeta OpenSpec: openspec/changes/<ticket_id>-<capa>/
        → Entregables clave esperados
   - Validaciones: <Linters deterministas, DB-TDD, tests unitarios>
   - Cierre: <Archivado OpenSpec (Archive / Bulk Archive) + Commit Git>

   ¿Confirmas este plan de ejecución para comenzar con la primera fase?
   ```

   <details>
   <summary>Ejemplo canónico de Plan de Ejecución (Multi-capa)</summary>

   ```text
   📋 Plan de Ejecución Propuesto — Ticket E1-US03-T01
   - Objetivo: Registrar venta offline con sincronización al backend
   - Alcance: Multi-capa
   - Capas afectadas: BD, Backend, Frontend

   Ruta de Ejecución Planificada:
     1. [Secuencial] BD: _skills/db-sdd/SKILL.md (db-architect, db-qa, db-developer, db-security, db-mutation-tester)
        → Subcarpeta OpenSpec: openspec/changes/E1-US03-T01-db/
        → Entregables: migración sales, RLS tenant_id, tests DB-TDD
     2. [Paralelo post-Gate 2 Backend (Contract-First)] Backend: _skills/backend-sdd/SKILL.md (api-architect, backend-qa, backend-developer, backend-mutation-tester)
        → Subcarpeta OpenSpec: openspec/changes/E1-US03-T01-backend/
        → Entregables: openapi.yaml, POST /sales, tests Backend-TDD
     3. [Paralelo post-Gate 2 Backend] Frontend: _skills/frontend-sdd/SKILL.md (frontend-architect, frontend-qa, frontend-ui-developer, frontend-integrator, frontend-auditor, frontend-mutation-tester)
        → Subcarpeta OpenSpec: openspec/changes/E1-US03-T01-frontend/
        → Entregables: cola IndexedDB, vista POS Design-Blind, mocks MSW, tests
   - Validaciones: validate-db-migrations.js, validate-backend.js, validate-frontend.js, opsx:verify
   - Cierre: opsx:bulk-archive + commit atómico único
   ```
   </details>

   🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario antes de proceder a la ejecución.

4. **Despacho y Ejecución por Capa:**
   - Una vez aprobado el plan:
     - **Capa Base de Datos (`capa:db`):** Conducir `_skills/db-sdd/SKILL.md` paso a paso (Exploración y propuesta vía `opsx:propose` con `db-architect-agent` → Suite DB-TDD por dominio en ROJO con `db-qa-agent` → Implementación DDL vía `opsx:apply` con `db-developer-agent` → Seguridad RLS vía `opsx:apply` con `db-security-agent` (si aplica) → Validación mecánica determinista con `scripts/validate-db-migrations.js` y verificación en VERDE vía `opsx:verify` con `db-qa-agent` → Mutation Testing con `db-mutation-tester` (si aplica)).
     - **Capa Backend (`capa:backend`):** Conducir `_skills/backend-sdd/SKILL.md` paso a paso (Exploración adaptativa y Gate 1 de pre-condición BD e introspección con `scripts/validate-backend.js` → Propuesta, especificación y contrato vía `opsx:propose` con `api-architect-agent` + Gate 2 de validación OpenSpec/OpenAPI → Suite Backend-TDD en ROJO con `backend-qa-agent` (Fase A) → Implementación en capas vía `opsx:apply` con `backend-developer-agent` + Gate 3 de linter, typecheck e inmutabilidad No-DB-Diff con `scripts/validate-backend.js` → Gate 4 de ejecución de suite de tests y auditoría adversarial en VERDE vía `opsx:verify` con `backend-qa-agent` (Fase B) → Mutation Testing con `backend-mutation-tester` (si aplica)).
     - **Capa Frontend (`capa:frontend`):** Opcionalmente ejecutar primero `_skills/ui-discovery/SKILL.md` (`ux-designer-agent`) para generar `ui-spec.json`. Luego conducir `_skills/frontend-sdd/SKILL.md` paso a paso (Input Gate/Gate 1 Contract-First o Frontend-Driven y `openapi_hash` con `scripts/validate-frontend.js` → `opsx:propose` con `frontend-architect-agent` + Gate 2 → Suite Frontend-TDD *Design-Blind* en ROJO con `frontend-qa-agent` (Fase A) → Implementación visual y lógica vía `opsx:apply` (`frontend-ui-developer-agent` → `frontend-integrator-agent`) + Gate 3 → Optimización/SW con `frontend-auditor-agent` + Gate 4 → Verificación final `opsx:verify` con `frontend-qa-agent` (Fase B) → Mutation Testing con `frontend-mutation-tester`).

#### 4.1. Gestión de Tickets Multi-Capa (Cross-Cutting / Fullstack)
Si un ticket técnico impacta 2 o más capas (ej. Base de Datos + Backend + Frontend):
1. **Nomenclatura Canónica en OpenSpec (`openspec/changes/`):**
   El orquestador instruye generar una carpeta de cambio independiente por cada capa afectada, compartiendo el identificador único del ticket:
   - `openspec/changes/<ticket_id>-db/` (ej. `E1-US03-T01-db/`)
   - `openspec/changes/<ticket_id>-backend/` (ej. `E1-US03-T01-backend/`)
   - `openspec/changes/<ticket_id>-frontend/` (ej. `E1-US03-T01-frontend/`)
2. **Ejecución Secuencial Topológica:**
   - **Paso A (Datos):** Ejecuta `_skills/db-sdd/SKILL.md` para `<ticket_id>-db/`. La base de datos, migraciones, políticas RLS y tests DB-TDD se validan primero.
   - **Paso B (Backend):** Con el esquema de datos validado, ejecuta `_skills/backend-sdd/SKILL.md` para `<ticket_id>-backend/` (contratos de API, DTOs/Schemas, repositorios, servicios, controladores/workers, tests Backend-TDD y Gates 1–4 con `scripts/validate-backend.js`).
   - **Paso C (Frontend):** Con los contratos de API disponibles, ejecuta `_skills/frontend-sdd/SKILL.md` para `<ticket_id>-frontend/` (componentes UI, estado, offline y consumo de APIs con Gates 1–4 y `scripts/validate-frontend.js`).
   - **Paralelización Condicional Contract-First:** Si el ticket utiliza `contract_style = 'openapi-first'` y el contrato `openapi.yaml` ya superó el **Paso 1 + Gate 2 de Backend** (o existe previamente validado), `capa:backend` y `capa:frontend` (usando mocks MSW/Orval) pueden ejecutarse en paralelo mediante sesiones/worktrees independientes sin colisión de turnos `🛑`, sincronizándose en el `Bulk Archive` final. Si hay cambio de contrato (`openapi_hash` distinto), la capa afectada retrocede a su Paso 1.
3. **Archivado Atómico en Lote (`Bulk Archive`):**
   - Una vez validadas todas las capas del ticket, el orquestador NO archiva carpeta por carpeta de forma fragmentada.
   - Invoca el archivado en lote mediante **OpenSpec Bulk Archive** (`/opsx:bulk-archive` o `openspec bulk-archive`), consolidando simultáneamente las especificaciones canónicas en `openspec/specs/` y moviendo todas las subcarpetas del ticket a `openspec/changes/archive/`.
   - Realiza un único commit atómico de la feature completa:
     ```bash
     git add <db_dirs> <backend_dir> <frontend_dir> <tests_dir> openspec/
     git commit -m "feat(<modulo>): implementacion fullstack" -m "Refs <ticket_id>"
     ```
   - **Fallback si `opsx:archive` / `opsx:bulk-archive` falla (mono-capa o multi-capa):** Si el archivado falla (ej. conflicto de merge en `openspec/specs/`, tareas pendientes `[ ]` o fallo de `openspec validate`), **NO ejecutar `git commit`**, mantener `openspec/changes/<change-name>/` intacto, reportar el error exacto y pedir confirmación `🛑` para resolver el conflicto/tarea o ejecutar `opsx:sync` antes de reintentar el archivado.

#### 4.2. Decisión de Concurrencia: Invocación Paralela vs. Secuencial
El orquestador evalúa el grafo de dependencias de la User Story o de las tareas del ticket para determinar la estrategia de despacho:

1. **Invocación Secuencial Obligatoria (Pipeline):**
   - Aplica cuando existe **dependencia de datos**: el output de un subagente es insumo directo del siguiente (ej. `db-architect-agent` genera `design.md` antes de que `db-developer-agent` escriba el DDL).
   - Aplica cuando existe **acoplamiento técnico de capas**: la base de datos debe estar modelada y migrada antes de implementar lógica de persistencia en Backend.
   - Aplica cuando existe una **pausa de validación humana obligatoria (HITL)** entre pasos.
2. **Invocación Paralela (Fork-Join):**
   - Aplica cuando dos o más subagentes realizan **tareas disjuntas y ortogonales** sin dependencias mutuas ni riesgo de colisión de archivos.
   - *Auditorías multidimensionales concurrentes:* En fases de verificación, el orquestador puede lanzar en paralelo agentes de solo lectura sobre el mismo entregable (ej. `db-security-agent` auditando RLS/PII concurrentemente con `db-qa-agent` evaluando planes de ejecución).
   - *Tareas paralelas de la US:* Tareas sin dependencia mutua (ej. maquetado visual en Frontend con interfaces mockeadas en paralelo con la definición de seeds en DB).
   - *Capas Contract-First desacopladas:* Una vez aprobado el contrato OpenAPI (post-Gate 2 de Backend o preexistente), `capa:backend` y `capa:frontend` (usando mocks MSW/Orval) pueden avanzar en paralelo en sesiones/worktrees independientes hasta la barrera de `opsx:bulk-archive`.
3. **Barrera de Sincronización (Join Barrier):**
   - Al despachar agentes en paralelo, el orquestador mantiene una barrera de sincronización: recopila todos los resultados y no avanza a la siguiente fase ni emite pausas al usuario hasta que todos los subagentes concurrentes hayan concluido sus análisis.

5. **Archivado en OpenSpec (`opsx:archive`) y Commit de la Entrega (Ticket Mono-Capa):**
   *(Todos los commits siguen [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md): `<tipo>(<capa-o-modulo>): <descripción en imperativo y minúsculas>` en el header y `Refs <ticket_id>` / `Closes #<issue>` en el footer. Si `opsx:archive` falla, aplicar el Fallback de la sección 4.1 sin commitear).*
   - **Caso A — Capa Base de Datos (`db-sdd`):**
     Al recibir la señal `[LISTO PARA COMMIT Y ARCHIVE] <migrations_dir> <security_dir> <seeds_dir> <tests_dir> <schemas_dir> openspec/changes/<change-name>/`:
     ```text
     ⏸️ Ciclo SDD de Base de Datos completado y validado mediante DB-TDD y opsx:verify.
     Archivos impactados:
     - <schemas_dir>/ (si se actualizó erd.md)
     - <tests_dir>/ (tests organizados por dominio/entidad)
     - <migrations_dir>/
     - <security_dir>/ (si aplica RLS/DCL)
     - <seeds_dir>/ (si aplica seeds)
     - openspec/changes/<change-name>/ (incluyendo verification-report.md y mutation-report.md)

     ¿Confirmás ejecutar opsx:archive para archivar el cambio en OpenSpec y realizar el commit?
     ```
     Tras confirmación explícita del usuario:
     1. Ejecutar el workflow **[`opsx:archive`](.claude/commands/opsx/archive.md)** (sincroniza delta specs en `openspec/specs/` vía `opsx:sync` y mueve el cambio a `openspec/changes/archive/YYYY-MM-DD-<change-name>/`).
     2. Ejecutar el commit de Git agregando las rutas impactadas del repositorio y `openspec/`:
        ```bash
        git add <rutas-bd-impactadas> openspec/
        git commit -m "feat(db): schema, migraciones y tests" -m "Refs <ticket_id>"
        ```

   - **Caso B — Capa Backend (`backend-sdd`):**
     Al recibir la señal `[LISTO PARA COMMIT Y ARCHIVE] <backend_dir> <tests_dir> openspec/changes/<change-name>/`:
     ```text
     ⏸️ Ciclo SDD de Backend completado y validado mediante Backend-TDD, Gates 1–4, opsx:verify y Mutation Testing (si aplica).
     Archivos impactados:
     - <backend_dir>/ (DTOs/Schemas, repositorios, servicios, controladores/workers y openapi.yaml si aplica)
     - <tests_dir>/ (tests organizados por dominio/módulo)
     - openspec/changes/<change-name>/ (incluyendo verification-report.md y mutation-report.md si aplica)

     ¿Confirmás ejecutar opsx:archive para archivar el cambio en OpenSpec y realizar el commit?
     ```
     Tras confirmación explícita del usuario:
     1. Ejecutar el workflow **[`opsx:archive`](.claude/commands/opsx/archive.md)** (sincroniza delta specs en `openspec/specs/` vía `opsx:sync` y mueve el cambio a `openspec/changes/archive/YYYY-MM-DD-<change-name>/`).
     2. Ejecutar el commit de Git agregando las rutas impactadas de backend, tests y `openspec/`:
        ```bash
        git add <backend_dir> <tests_dir> openspec/
        git commit -m "feat(backend): contratos, servicios y tests" -m "Refs <ticket_id>"
        ```

   - **Caso C — Capa Frontend (`frontend-sdd` y `ui-discovery`):**
     - Si `ui-discovery` emite `[LISTO PARA COMMIT] docs/ui/<NNNN>-ui-spec-<sufijo>.json`:
       Tras confirmación explícita del usuario, ejecutar:
       ```bash
       git add docs/ui/
       git commit -m "docs(ui): especificacion visual para <sufijo>"
       ```
     - Al recibir la señal `[LISTO PARA COMMIT Y ARCHIVE] <frontend_dir> <tests_dir> openspec/changes/<change-name>/`:
     ```text
     ⏸️ Ciclo SDD de Frontend completado y validado mediante Frontend-TDD, Gates 1–4, opsx:verify y Mutation Testing.
     Archivos impactados:
     - <frontend_dir>/ (componentes, hooks, stores, clientes API y Service Worker si aplica)
     - <tests_dir>/ (tests Design-Blind organizados por dominio/módulo)
     - openspec/changes/<change-name>/ (incluyendo verification-report.md y mutation-report.md si aplica)

     ¿Confirmás ejecutar opsx:archive para archivar el cambio en OpenSpec y realizar el commit?
     ```
     Tras confirmación explícita del usuario:
     1. Ejecutar **[`opsx:archive`](.claude/commands/opsx/archive.md)** (sincroniza delta specs en `openspec/specs/` y archiva el cambio).
     2. Ejecutar el commit de Git:
        ```bash
        git add <frontend_dir> <tests_dir> openspec/
        git commit -m "feat(frontend): componentes, integracion y tests" -m "Refs <ticket_id>"
        ```

---

## MANEJO DE INTERRUPCIONES

Si el usuario detiene el flujo entre fases:
- Los archivos del Skill 1 ya están commiteados — no se pierden.
- Para retomar desde Skill 2: invocar directamente `_skills/stories-to-tickets/SKILL.md` con rol `[2]`.

Si un paso falla antes del commit:
- No commitear archivos parciales.
- Avisar al usuario qué paso falló y desde dónde puede retomar.

### Memoria Híbrida ante Errores (`.sdd-state.json` + `known-gotchas.md`)
Para evitar loops de reintentos y preservar aprendizajes entre tickets sin inflar el contexto:
1. **Registro efímero por cambio (`--action record`):** Cuando un Gate, test o verificación falle en Fase 3, registrar el fallo en `openspec/changes/<change-name>/.sdd-state.json` ejecutando:
   ```bash
   node "<plugin-root>/scripts/sdd-error-memory.js" --action record --change-dir "<change-dir>" --layer "<db|backend|frontend>" --step "<paso>" --message "<error>" --avoid "<restriccion>"
   ```
   - Si el script devuelve **`exit 2` (`loop_detected: true`)**, el orquestador **detiene inmediatamente los reintentos automáticos** y escala al usuario con el resumen (`--action summary`).
   - Al re-invocar un subagente tras un fallo no repetido, adjuntar únicamente la salida compacta de `--action summary` (sin volcar logs completos).
2. **Promoción selectiva al archivar (`--action promote`):** Antes o inmediatamente después de `opsx:archive` / `opsx:bulk-archive`, si `.sdd-state.json` registró fallos no triviales del repositorio, preguntar al usuario (`⏸️`) si desea promover una regla breve (1 línea) a `openspec/specs/<capa>/known-gotchas.md` mediante `--action promote`.

### Rollback Post-Commit (cuando una fase posterior revela fallos en Fase 1 o Fase 2)
Si el commit de Fase 1 o Fase 2 ya se realizó, pero la Fase 3 (SDD) detecta que las historias o tickets están mal diseñados o incompletos:
1. **Congelar cambios SDD en curso:** No ejecutar `opsx:archive` sobre el cambio afectado; mantener o descartar `openspec/changes/<change-name>/` según indique el usuario.
2. **Confirmación HITL obligatoria (`🛑`):** Presentar el `<commit-sha>` problemático de Fase 1/2 y proponer una de dos salidas:
   - **Opción A — Revertir commit:** Tras confirmación explícita, ejecutar `git revert --no-edit <commit-sha>` (preservando el historial sin reescribir ramas compartidas) y re-ejecutar el skill afectado (`_skills/stories-to-tickets/SKILL.md` o `_skills/product-discovery/SKILL.md`).
   - **Opción B — Commit correctivo hacia adelante (Retorno F3 → F2 / F1):** Si un ticket está mal acotado (*oversized* o con criterios incompletos), pausar `openspec/changes/<change-name>/`, re-invocar `_skills/stories-to-tickets/SKILL.md` para dividir/ajustar `docs/backlog/**/tickets-*.md` y `<NNNN>-backlog-priorizado.md`, registrar un commit `chore(backlog): re-scopear <ticket_id>` tras confirmación `🛑` y reanudar Fase 3 con los nuevos tickets atómicos.
