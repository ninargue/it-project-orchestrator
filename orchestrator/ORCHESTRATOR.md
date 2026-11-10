---
name: orchestrator
version: 0.1.0
description: Ciclo completo idea-to-backlog para quien tiene acceso a todo el proyecto
trigger: "cuando el usuario elige rol [3] Ciclo completo en el punto de entrada"
skills_invoked:
  - _skills/product-discovery/SKILL.md
  - _skills/stories-to-tickets/SKILL.md
  - _skills/db-sdd/SKILL.md
  - _skills/sdd-init/SKILL.md
---

# Orquestador — Ciclo completo

Instrucciones exclusivas para el rol `[3] Ciclo completo`.
Los roles `[1]` y `[2]` van directo a su SKILL.md — ver `AGENTS.md`.

Reglas generales, tono y convenciones de archivos: ver `AGENTS.md`.

> 💡 **Concisión en Chat vs. Persistencia:** Cuando `tiene_repositorio = true`, todos los entregables se persisten directamente en disco (`docs/prd/`, `docs/backlog/`). En el chat solo se emiten resúmenes ejecutivos con enlaces; **queda terminantemente prohibido volcar el contenido íntegro de los archivos Markdown en los mensajes**. El volcado completo en chat queda reservado exclusivamente para cuando `tiene_repositorio = false` (modo sin repo / previo a PDF).

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

   🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario antes de proceder a la ejecución.

4. **Despacho y Ejecución por Capa:**
   - Una vez aprobado el plan:
     - **Capa Base de Datos (`capa:db`):** Conducir `_skills/db-sdd/SKILL.md` paso a paso (Modelado ERD con `db-architect-agent` → Planificación de tareas con `db-developer-agent` → Implementación DDL/RLS → Validación mecánica determinista con `scripts/validate-db-migrations.ps1` → Auditoría adversarial con `db-qa-agent`).
     - **Capa Backend (`capa:backend`):** Conducir el flujo SDD correspondiente para backend.
     - **Capa Frontend (`capa:frontend`):** Conducir el flujo SDD correspondiente para frontend.

#### 4.1. Gestión de Tickets Multi-Capa (Cross-Cutting / Fullstack)
Si un ticket técnico impacta 2 o más capas (ej. Base de Datos + Backend + Frontend):
1. **Nomenclatura Canónica en OpenSpec (`openspec/changes/`):**
   El orquestador instruye generar una carpeta de cambio independiente por cada capa afectada, compartiendo el identificador único del ticket:
   - `openspec/changes/<ticket_id>-db/` (ej. `E1-US03-T01-db/`)
   - `openspec/changes/<ticket_id>-backend/` (ej. `E1-US03-T01-backend/`)
   - `openspec/changes/<ticket_id>-frontend/` (ej. `E1-US03-T01-frontend/`)
2. **Ejecución Secuencial Topológica:**
   - **Paso A (Datos):** Ejecuta `_skills/db-sdd/` para `<ticket_id>-db/`. La base de datos, migraciones, políticas RLS y tests DB-TDD se validan primero.
   - **Paso B (Backend):** Con el esquema de datos validado, ejecuta el flujo de backend para `<ticket_id>-backend/` (endpoints, controladores, DTOs y lógica de negocio).
   - **Paso C (Frontend):** Con los contratos de API disponibles, ejecuta el flujo de frontend para `<ticket_id>-frontend/` (componentes UI, estado y consumo de APIs).
3. **Archivado Atómico en Lote (`Bulk Archive`):**
   - Una vez validadas todas las capas del ticket, el orquestador NO archiva carpeta por carpeta de forma fragmentada.
   - Invoca el archivado en lote mediante **OpenSpec Bulk Archive** (`/opsx:bulk-archive` o `openspec bulk-archive`), consolidando simultáneamente las especificaciones canónicas en `openspec/specs/` y moviendo todas las subcarpetas del ticket a `openspec/changes/archive/`.
   - Realiza un único commit atómico de la feature completa:
     ```bash
     git add database/ backend/ frontend/ openspec/
     git commit -m "feat(<modulo>): implementacion fullstack para <ticket_id>"
     ```

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
3. **Barrera de Sincronización (Join Barrier):**
   - Al despachar agentes en paralelo, el orquestador mantiene una barrera de sincronización: recopila todos los resultados y no avanza a la siguiente fase ni emite pausas al usuario hasta que todos los subagentes concurrentes hayan concluido sus análisis.

5. **Archivado en OpenSpec y Commit de la Entrega (Ticket Mono-Capa):**
   - Al recibir la señal `[LISTO PARA COMMIT Y ARCHIVE] database/ openspec/changes/<change-name>/`:
     ```text
     ⏸️ Ciclo SDD de Base de Datos completado y validado mediante DB-TDD.
     Archivos:
     - database/schemas/
     - database/tests/
     - database/migrations/
     - database/security/
     - database/seeds/
     - database/reports/<change-name>-qa-report.md
     - openspec/changes/<change-name>/

     ¿Confirmás archivar el cambio en OpenSpec y realizar el commit?
     ```
   - Tras confirmación explícita del usuario:
     1. Archivar el cambio en OpenSpec (mueve a `openspec/changes/archive/` y consolida en `openspec/specs/`).
     2. Ejecutar el commit de Git:
        ```bash
        git add database/ openspec/
        git commit -m "feat(db): schema, migraciones y tests para <ticket>"
        ```

---

## MANEJO DE INTERRUPCIONES

Si el usuario detiene el flujo entre fases:
- Los archivos del Skill 1 ya están commiteados — no se pierden.
- Para retomar desde Skill 2: invocar directamente `_skills/stories-to-tickets/SKILL.md` con rol `[2]`.

Si un paso falla antes del commit:
- No commitear archivos parciales.
- Avisar al usuario qué paso falló y desde dónde puede retomar.
