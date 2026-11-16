---
name: db-sdd
version: 0.1.0
description: Ciclo de desarrollo de base de datos guiado por especificaciones (SDD / OpenSpec) ejecutando opsx:propose, DB-TDD por dominio, opsx:apply, validaciones mecánicas y opsx:verify.
trigger: "cuando el usuario seleccione desarrollar un ticket de base de datos (capa:db) o diseñar/implementar esquemas y migraciones de BD"
tools_required:
  - Read
  - Write
  - AskUserQuestion
  - Bash
subagents:
  - db-architect-agent
  - db-developer-agent
  - db-security-agent
  - db-qa-agent
  - db-mutation-tester
inputs:
  - Ticket técnico de base de datos (US-XX-TN o issue de GitHub)
  - openspec/config.yaml (configuración SDD del proyecto)
  - openspec/specs/db/known-gotchas.md (opcional, aprendizajes previos de la capa db)
  - .claude/commands/opsx/*.md (o .agent/workflows/opsx-*.md)
  - docs/prd/*.md (opcional, contexto de dominio existente)
  - docs/backlog/**/us-*.md (opcional, historias asociadas)
outputs:
  - openspec/changes/<change-name>/proposal.md
  - openspec/changes/<change-name>/specs/<capability>/spec.md
  - openspec/changes/<change-name>/design.md
  - openspec/changes/<change-name>/tasks.md
  - openspec/changes/<change-name>/.sdd-state.json
  - openspec/changes/<change-name>/verification-report.md
  - openspec/changes/<change-name>/mutation-report.md (si hay constraints o RLS a falsar)
  - <schemas_dir>/erd.md (actualizado si hay tablas nuevas o FKs alteradas)
  - <tests_dir>/<modulo_o_entidad>... (tests organizados por dominio/estructura del repositorio)
  - <migrations_dir>/<timestamp>_<nombre>.up.sql (o archivo único en forward-only)
  - <migrations_dir>/<timestamp>_<nombre>.down.sql (en modo simétrico)
  - <security_dir>/<timestamp>_security_rls.sql (si rls_mode != 'none')
  - <security_dir>/<timestamp>_security_rls.down.sql (si rls_mode != 'none' y simétrico)
  - <seeds_dir>/<timestamp>_seeds.sql (si requires_seeds = true)
commits:
  - "El orquestador (nunca este skill ni sus subagentes) ejecuta opsx:archive / opsx:bulk-archive y hace todos los commits, siempre tras confirmación explícita del usuario."
---

# db-sdd

Skill especializado en el desarrollo e implementación de bases de datos mediante **Specification-Driven Development (SDD / OpenSpec)** y **DB-TDD (Database Test-Driven Development)** dentro del ecosistema `it-project-orchestrator`.

---

## 🧭 VARIABLES DE SESIÓN HEREDADAS

Este skill recibe del Orquestador o de skills previos las siguientes variables en memoria de sesión (§7.3.4):

| Variable | Valores | Uso en este skill |
|---|---|---|
| `idioma` | `español` / `inglés` | Idioma de los artefactos y mensajes |
| `tiene_repositorio` | `true` (obligatorio) | Requiere un repositorio o workspace local para persistir especificaciones, migraciones, tests y ejecutar validaciones |
| `prefijo_avance` | ej: `0001`, `0002` | Prefijo numérico incremental de la entrega/avance |
| `sufijo` | ej: `crear-esquema-usuarios` | Sufijo en kebab-case para el change-name |
| `tipo_proyecto` | `greenfield` / `brownfield` | Contexto de exploración (existencia de esquemas previos) |

Si alguna de estas variables no está en memoria de sesión (usuario invocó directamente este skill):
- `idioma`: Detectar de `docs/` o asumir `español`.
- `tiene_repositorio`: Comprobar que exista un directorio de trabajo/repositorio local (`true` obligatorio para ejecutar desarrollo SDD).
- `tipo_proyecto`: Detectar si existen migraciones en disco (`brownfield`) o si el directorio de BD está vacío (`greenfield`).
- `prefijo_avance`: Inspeccionar `openspec/changes/` o `docs/prd/` para detectar el mayor prefijo numérico existente (o `0001` si no hay previos).
- `sufijo`: Derivar del ticket técnico o requerimiento del usuario.

---

## 📋 REGLAS GENERALES

1. **Límite Estricto de Fin de Turno (Hard Turn Boundary):** Toda pausa `**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**` marca el fin absoluto de tu turno de respuesta.
   - Presenta únicamente el resultado o preguntas del paso actual.
   - **DETÉN tu respuesta inmediatamente.** No agregues texto anticipando el paso siguiente ni simules respuestas del usuario.
2. **Integración Nativa con Workflows OpenSpec (`opsx:*`):** Los subagentes NO inventan formatos ni plantillas propias para los artefactos de SDD; ejecutan directamente los workflows oficiales de OpenSpec del plugin (`.claude/commands/opsx/` o `.agent/workflows/opsx-*.md`): `opsx:explore`, `opsx:propose`, `opsx:apply`, `opsx:verify` y `opsx:archive` / `opsx:bulk-archive`.
3. **Organización de Tests según la Estructura del Repositorio:** Queda **terminantemente prohibido** nombrar archivos de test con IDs de tickets (`US-XX-TN`) o nombres del cambio (`<change-name>-test.sql`). Los tests son activos vivos del repositorio y deben ubicarse y nombrarse por **dominio, módulo, esquema o entidad** respetando la estructura existente del proyecto (`<tests_dir>/<modulo_o_entidad>...`).
4. **Gobernanza de Git:** Ningún subagente ni skill ejecuta commits directamente. Solo el orquestador principal interactúa con Git, siempre tras confirmación explícita del usuario.
5. **Persistencia en Disco y Concisión en Chat (Repositorio Obligatorio):**
   - El ciclo SDD de base de datos **requiere obligatoriamente un repositorio o workspace local** (`tiene_repositorio = true`) para operar con OpenSpec, escribir migraciones/tests y ejecutar las validaciones mecánicas.
   - Los subagentes persisten directamente sus entregables en disco. En chat se muestra únicamente un resumen ejecutivo conciso con enlaces directos (`file:///...`).
6. **Selección de Modelo por Tier (`AGENTS.md` §7.4.4):** Al invocar subagentes con `invoke_subagent`, pasar `Model: "pro"` para `db-architect-agent` y `db-mutation-tester`, y `Model: "inherit"` para `db-developer-agent`, `db-security-agent` y `db-qa-agent`. En Claude Code el campo `model:` de `.claude/_agents/` aplica automáticamente.
7. **Memoria Híbrida ante Errores (`AGENTS.md` §7.5.4):** Si existe `openspec/specs/db/known-gotchas.md`, `db-architect-agent` debe leerlo en `opsx:explore`. Ante fallos de migración, RLS o tests, registrar en `openspec/changes/<change-name>/.sdd-state.json` con `scripts/sdd-error-memory.js --action record` (detener y escalar si devuelve `exit 2`).

---

## 🎯 OBJETIVO Y FILOSOFÍA

1. **Concepción vía `opsx:propose` (`db-architect-agent`):** El arquitecto explora el repositorio (`opsx:explore`) y ejecuta `opsx:propose` para generar `proposal.md`, `specs/<capability>/spec.md`, `design.md` (con las convenciones de infraestructura detectadas) y `tasks.md` usando las plantillas dinámicas de OpenSpec.
2. **DB-TDD Organizado por Dominio (`db-qa-agent` Fase A):** Antes de escribir DDL, se crean o amplían los tests del módulo/entidad en `<tests_dir>` a partir de los escenarios Given/When/Then de `specs/` y se verifica su fallo inicial en **ROJO**.
3. **Implementación vía `opsx:apply` (`db-developer-agent` y `db-security-agent`):** Cada agente ejecuta `opsx:apply`, genera sus scripts SQL reversibles y marca sus tareas completadas (`- [ ]` → `- [x]`) en `tasks.md`.
4. **Verificación vía `opsx:verify` y Mutation Testing:** Se valida mecánicamente el SQL (`validate-db-migrations.js`), `db-qa-agent` (Fase B) ejecuta `opsx:verify` (Completeness, Correctness en **VERDE** y Coherence) y `db-mutation-tester` audita la falsabilidad de los tests. Ambos reportes quedan encapsulados dentro de `openspec/changes/<change-name>/`.
5. **Gobernanza de Cierre (`opsx:archive` y `Commit`):** El Orquestador principal ejecuta `opsx:archive` (o `opsx:bulk-archive`) para sincronizar las delta specs en `openspec/specs/`, archivar el cambio y realizar el commit en Git.

---

## 👣 PROCEDIMIENTO PASO A PASO

### Paso 0 — Verificación de Pre-condiciones (Input Gate)

1. **Input Gate — Verificación de Pre-condiciones (§7.3.3):**
   - **Pre-condición A (Repositorio / Workspace Local Obligatorio):**
     - Verificar que `tiene_repositorio = true` (que exista un repositorio o workspace local activo).
     - Si `tiene_repositorio = false` o no existe workspace local:
       ```text
       ❌ [INPUT GATE]: El ciclo de desarrollo SDD para Base de Datos requiere obligatoriamente un repositorio o workspace local.
       Por favor, abre o inicializa el repositorio/workspace del proyecto antes de continuar.
       ```
       **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera a que el usuario provea un repositorio o workspace local.
   - **Pre-condición B (OpenSpec Config):**
     - Verificar la existencia de `openspec/config.yaml` en el proyecto destino.
     - Si `openspec/config.yaml` **NO existe en disco**:
       ```text
       ❌ [INPUT GATE]: El entorno de Specification-Driven Development (OpenSpec) no está inicializado en este repositorio (falta 'openspec/config.yaml').
       Debes ejecutar primero el skill '_skills/sdd-init/SKILL.md' (o la opción [4] del orquestador) para configurar OpenSpec antes de iniciar el ciclo de base de datos.
       ```
       **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí e instruye al usuario a inicializar SDD primero.
   - **Pre-condición C (Ticket Técnico de BD):**
     - Verificar que el usuario haya indicado o seleccionado un ticket técnico de base de datos (`capa:db`) con ID, título o criterios de aceptación.
     - Si no se indicó ningún ticket:
       ```text
       ❓ [INPUT GATE]: No se ha especificado un ticket técnico para el desarrollo de base de datos.
       Por favor, indica el ID del ticket (ej. US-03-T1 o issue #17) o describe el requerimiento de base de datos a desarrollar.
       ```
       **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera a que el usuario provea el requerimiento.
   - **Pre-condición D (Separación de Ambientes, Healthcheck de Test y Rol RO):**
     - Leer la sección `db.environments` de `openspec/config.yaml`.
     - Comprobar que `DB_TEST_URL` esté definida, sea distinta de `DB_DEV_URL` (mismo host/puerto/base = bloqueo inmediato) y responda al `healthcheck` configurado.
     - Si falta `DB_TEST_URL`, falla el `healthcheck` o `DB_TEST_URL == DB_DEV_URL`:
       ```text
       ❌ [INPUT GATE]: La base de pruebas efímera no está lista o coincide con la base de desarrollo.
       Verifica DB_TEST_URL != DB_DEV_URL y el healthcheck declarado en openspec/config.yaml antes de continuar.
       ```
       **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí hasta que la base de pruebas efímera esté aislada y saludable.
     - Verificar si `DB_DEV_RO_URL` (rol `agent_ro`) está disponible para exploración en vivo; en proyectos *brownfield* sin `DB_DEV_RO_URL`, advertir al usuario que puede crearlo con `<plugin-root>/templates/db/readonly-role.<engine>.sql`.

2. **Handoff Inmediato al Paso 1:**
   - Cumplidas las pre-condiciones, definir el identificador del cambio `<change-name>` en `kebab-case` (ej. `0017-crear-esquema-usuarios` o `<ticket_id>-db`).
   - Avanzar inmediatamente al Paso 1 delegando la ejecución de `opsx:explore` y `opsx:propose` a `db-architect-agent`.

---

### Paso 1 — Exploración y Propuesta vía `opsx:propose` (`db-architect-agent`)

1. Invocar a `db-architect-agent` entregando el `<change-name>`, el ticket técnico y la referencia al workflow **[`opsx:propose`](.claude/commands/opsx/propose.md)** (o `.agent/workflows/opsx-propose.md`).
2. `db-architect-agent` ejecuta el flujo oficial de `opsx:propose`:
   - **Exploración del Repositorio y Base Viva (`opsx:explore`):** Detecta y registra en `design.md` la infraestructura real del proyecto: `engine`, `migrations_dir`, `security_dir` (`dedicated` / `in-situ` / `none`), `seeds_dir`, `tests_dir` (y su convención modular por entidad/dominio), `migration_mode` (`symmetric` vs `forward-only`), `rls_mode` (`dedicated` / `in-situ` / `none`), `requires_seeds`, `test_cmd` y `validation_cmd`. Si `DB_DEV_RO_URL` está disponible, consulta el esquema real y valores existentes mediante `ro_cli` (o MCP opcional) y los registra en `design.md › ## Estado observado de la base`.
   - **Creación Guiada por el Grafo de OpenSpec:** Ejecuta `openspec new change "<change-name>"`, consulta `openspec status --change "<change-name>" --json` y para cada artefacto obtiene su `template`, `context`, `rules` y `outputPath` con `openspec instructions <artifact-id> --change "<change-name>" --json`:
     - `openspec/changes/<change-name>/proposal.md`: Why, What, Non-goals y compatibilidad.
     - `openspec/changes/<change-name>/specs/<capability>/spec.md`: Requisitos formales y escenarios Given/When/Then.
     - `openspec/changes/<change-name>/design.md`: Convenciones de infraestructura detectadas (`up_cmd`, `down_cmd`, `snapshot_cmd`, etc.), `## Estado observado de la base`, `## Reversibilidad` (conteo real de filas y clasificación `reversible` / `falla-en-alto` / `pierde-datos`, aplicando Expand/Contract en 2 cambios), `## Normalización` (si afecta datos existentes), ERD Mermaid y diccionario físico.
     - `openspec/changes/<change-name>/tasks.md`: Checklist (`- [ ]`) de tareas atómicas ordenadas topológicamente.
   - **ERD Consolidado (`<schemas_dir>/erd.md`):** Actualizado únicamente si el cambio crea tablas nuevas o altera FKs.
   - **Validación de Artefactos:** Verifica con `openspec status --change "<change-name>" --json` y `openspec validate "<change-name>"` que todos los `applyRequires` estén completos (`done`).
3. Presentar en chat el **resumen ejecutivo unificado**:

```text
📐 Paquete de Propuesta y Diseño generado vía opsx:propose:
- Ticket: <ID o título> | Cambio: <change-name>
- Infraestructura detectada: Motor <engine>, Migraciones <migrations_dir> (<migration_mode>), Tests <tests_dir>, RLS: <rls_mode>
- Propuesta: [proposal.md](file:///<ruta>/openspec/changes/<change-name>/proposal.md)
- Especificación: [spec.md](file:///<ruta>/openspec/changes/<change-name>/specs/<capability>/spec.md)
- Modelo y Convenciones: [design.md](file:///<ruta>/openspec/changes/<change-name>/design.md)
- ERD Consolidado: [erd.md](file:///<ruta>/<schemas_dir>/erd.md) (si fue actualizado)
- Plan de Tareas: [tasks.md](file:///<ruta>/openspec/changes/<change-name>/tasks.md)

¿Apruebas esta especificación, diseño y plan de tareas para avanzar al Paso 2 (Suite DB-TDD en ROJO)?
```

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 2 — Suite DB-TDD por Dominio y Verificación en ROJO (`db-qa-agent` Fase A)

1. Invocar a `db-qa-agent` (Fase A) entregando el `<change-name>` para que cargue los artefactos desde `openspec instructions apply --change "<change-name>" --json` (incluyendo las convenciones persistidas en `design.md`).
2. `db-qa-agent` crea o actualiza los archivos de prueba **respetando estrictamente la estructura de directorios y nombres de dominio del repositorio** (`<tests_dir>/<modulo_o_entidad>...`, **nunca** con el ID del ticket ni `<change-name>`):
   - Mapeo 1:1 de los escenarios Given/When/Then de `specs/<capability>/spec.md`.
   - Casos negativos estructurados para constraints (`NOT NULL`, `CHECK`, `UNIQUE`, FKs).
   - Pruebas de aislamiento RLS y privilegios DCL (solo si `rls_mode != 'none'`).
3. **Verificación en ROJO y Congelamiento de Huella:**
   - `db-qa-agent` ejecuta `test_cmd` mediante `Bash` y confirma que los nuevos casos de prueba fallen en **ROJO** (porque el DDL aún no existe).
   - Congelar la huella `sha256` de los tests en `.sdd-state.json`:
     ```bash
     node "<plugin-root>/scripts/db-test-fingerprint.js" --action freeze --change-dir "openspec/changes/<change-name>" --tests-dir "<repo-destino>/<tests_dir>"
     ```
4. **Avance automático tras ROJO + Freeze:**
   - Si los nuevos tests fallaron en **ROJO** como se esperaba y `db-test-fingerprint.js --action freeze` salió con `exit 0`, informa brevemente la ruta de los tests y **avanza directamente al Paso 3 (`opsx:apply` DDL)** sin pausa.
   - Si los tests ya pasaron en verde antes de existir el DDL o falla el runner, **detente y escala al usuario** (`🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO`).

---

### Paso 3 — Implementación DDL y Migraciones vía `opsx:apply` (`db-developer-agent`)

1. Invocar a `db-developer-agent` entregando el `<change-name>` y la referencia al workflow **[`opsx:apply`](.claude/commands/opsx/apply.md)** (o `.agent/workflows/opsx-apply.md`).
2. `db-developer-agent` ejecuta `opsx:apply` para las tareas de DDL y seeds:
   - Consulta `openspec instructions apply --change "<change-name>" --json` y lee `contextFiles` (`proposal`, `specs`, `design`, `tasks`).
   - Escribe las migraciones en `<migrations_dir>` (`symmetric`: `.up.sql` y `.down.sql`; `forward-only`: `.sql`) y los seeds en `<seeds_dir>` (solo si `requires_seeds = true`).
   - **Actualiza `tasks.md`:** Marca cada tarea de DDL/seeds completada (`- [ ]` → `- [x]`) en `openspec/changes/<change-name>/tasks.md`.
3. **Avance automático:**
   - Si `db-developer-agent` reporta drift o bloqueos en el diseño, **detente y escala al usuario** (`🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO`).
   - De lo contrario, avanza directamente al **Paso 4** (si `rls_mode != 'none'`) o al **Paso 5** (si `rls_mode = 'none'`).

---

### Paso 4 — Seguridad, RLS y DCL vía `opsx:apply` (`db-security-agent` — Gate Condicional)

> [!NOTE] Gate Condicional de Seguridad y RLS
> Este paso se ejecuta **únicamente si `rls_mode` es `dedicated` o `in-situ`** (según `design.md`) y el cambio incluye tablas con aislamiento multi-tenant o datos sensibles (PII). Si `rls_mode = 'none'`, fue ruteado directamente del Paso 3 al Paso 5.

1. Invocar a `db-security-agent` entregando el `<change-name>` y la referencia al workflow **[`opsx:apply`](.claude/commands/opsx/apply.md)**.
2. `db-security-agent` ejecuta `opsx:apply` sobre las tareas pendientes de seguridad:
   - Consulta `openspec instructions apply --change "<change-name>" --json`, lee `contextFiles` e inspecciona el DDL del Paso 3.
   - Escribe en `<security_dir>` (o `<migrations_dir>` si `in-situ`) las políticas RLS para las 4 operaciones (`SELECT`, `INSERT`, `UPDATE` con `USING` + `WITH CHECK`, `DELETE`), índices de soporte, permisos DCL y el rollback simétrico (`*.down.sql`).
   - **Actualiza `tasks.md`:** Marca con `- [x]` las tareas de seguridad en `openspec/changes/<change-name>/tasks.md`.
3. **Avance automático:** Una vez completado sin bloqueos, avanza directamente al **Paso 5**.

---

### Paso 5 — Validación Mecánica y Verificación en VERDE vía `opsx:verify` (`db-qa-agent` Fase B)

1. **Validación Mecánica Determinista Multiplataforma (Node.js):**
   - Leer `migrations_dir`, `security_dir`, `engine`, `migration_mode`, `rls_mode` y (si el proyecto usa ORM/migraciones no-SQL) `sql_from_cmd` desde `openspec/changes/<change-name>/design.md` y ejecutar:
     - **Si `rls_mode` es `dedicated` o `in-situ`:**
       ```bash
       node "<plugin-root>/scripts/validate-db-migrations.js" --migrations-dir "<repo-destino>/<migrations_dir>" --security-dir "<repo-destino>/<security_dir>" --engine "<engine>" --migration-mode "<migration_mode>"
       ```
     - **Si `rls_mode = 'none'`:**
       ```bash
       node "<plugin-root>/scripts/validate-db-migrations.js" --migrations-dir "<repo-destino>/<migrations_dir>" --no-rls --engine "<engine>" --migration-mode "<migration_mode>"
       ```
     - Si el proyecto usa migraciones de ORM (no-SQL), agregar `--sql-from-cmd "<sql_from_cmd>"` (en lugar de esperar archivos `.sql` en disco).
2. **Gate de Reversibilidad Real contra `DB_TEST_URL` (`db-roundtrip.js`):**
   - Leer `migration_mode`, `up_cmd`, `down_cmd` y `snapshot_cmd` desde `design.md` y ejecutar contra la base de pruebas efímera:
     ```bash
     node "<plugin-root>/scripts/db-roundtrip.js" --mode "<migration_mode>" --up-cmd "<up_cmd>" --down-cmd "<down_cmd>" --snapshot-cmd "<snapshot_cmd>"
     ```
     *(En `forward-only` omitir `--down-cmd`; el script valida idempotencia ejecutando `up` dos veces).*
3. **Gate de Huella, Suite en VERDE y Dictamen Independiente (`db-verify-gate.js`):**
   - Ejecutar el dictamen determinista (verifica huella intacta respecto al ROJO, validador, roundtrip y `test_cmd`):
     ```bash
     node "<plugin-root>/scripts/db-verify-gate.js" --change-dir "openspec/changes/<change-name>" --tests-dir "<repo-destino>/<tests_dir>" --migrations-dir "<repo-destino>/<migrations_dir>" --engine "<engine>" --migration-mode "<migration_mode>" --test-cmd "<test_cmd>" --up-cmd "<up_cmd>" --down-cmd "<down_cmd>" --snapshot-cmd "<snapshot_cmd>"
     ```
     *(Agregar `--security-dir` o `--no-rls` y `--sql-from-cmd` según `design.md`).*
   - Si falla cualquiera de los checks anteriores (`exit != 0`) o `validation_cmd`, **NO se emite `[APROBADO]`** ni se invoca a `db-qa-agent`. Registrar el fallo con `node "<plugin-root>/scripts/sdd-error-memory.js" --action record --change-dir "openspec/changes/<change-name>" --layer db --step "Paso 5" --message "<error>" --avoid "<restriccion>"`. Si devuelve `exit 2` (`loop_detected: true`), detener reintentos y escalar al usuario; de lo contrario, re-despachar al Paso 3 (DDL) o Paso 4 (RLS).
4. **Auditoría Cualitativa `opsx:verify` con `db-qa-agent` (un solo subagente en este turno, §7.5.2):**
   - Con `db-verify-gate.js` en verde (`[APROBADO]`), invocar únicamente a `db-qa-agent` (Fase B) con la referencia al workflow **[`opsx:verify`](.claude/commands/opsx/verify.md)** para evaluar drift 1:1 contra `design.md`, planes `EXPLAIN` y redactar `openspec/changes/<change-name>/verification-report.md` (adjuntando el dictamen del gate).
5. **Evaluación del Dictamen y Ruteo Condicional Anticipado:**

   - **Escenario A — Dictamen `[OBSERVADO CON CORRECCIONES REQUERIDAS]` (Issues `CRITICAL`):**
     ```text
     ⚠️ Verificación opsx:verify OBSERVADA (Correcciones Requeridas):
     - Reporte: [verification-report.md](file:///<ruta>/openspec/changes/<change-name>/verification-report.md)
     - Veredicto: [OBSERVADO CON CORRECCIONES REQUERIDAS]
     - Hallazgos críticos: <lista de fallos de tests, tareas incompletas o drift>
     - Invariante TDD: Los tests de dominio no se relajan ante fallos de implementación (se corrige el código SQL).
     
     ¿Autorizas re-despachar a desarrollo/seguridad (Paso 3 / Paso 4) para corregir la implementación?
     ```
     **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

   - **Escenario B — Dictamen `[APROBADO]` y sin hallazgos `CRITICAL`:**
     - **Si el cambio incluye constraints (`UNIQUE`, `CHECK`, FKs) o políticas RLS:** avanzar automáticamente al **Paso 6 (Mutation Testing)** sin pausa.
     - **Si está exento de Mutation Testing:** ejecutar `openspec validate "<change-name>"` y presentar el cierre para confirmar entrega (`Paso 7`):
       ```text
       📊 Verificación y DB-TDD en VERDE completada (exento de Mutation Testing):
       - Reporte: [verification-report.md](file:///<ruta>/openspec/changes/<change-name>/verification-report.md)
       - Dictamen db-verify-gate: [APROBADO]
       - Validación OpenSpec CLI: Superada (openspec validate "<change-name>")

       ¿Confirmas la entrega para que el Orquestador ejecute el Paso 7 (opsx:archive y Commit en Git)?
       ```
       **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 6 — Pruebas de Mutación y Falsabilidad (`db-mutation-tester` — Gate Condicional)

> [!NOTE] Gate Condicional de Mutation Testing
> Este paso se ejecuta únicamente cuando el cambio introduce constraints (`UNIQUE`, `CHECK`, FKs) o políticas RLS. Si estuvo exento, fue ruteado directamente del Paso 5 al Paso 7.

1. Invocar únicamente a `db-mutation-tester` (§7.5.2):
   - Audita la falsabilidad de los archivos de prueba del dominio en `<tests_dir>/<modulo_o_entidad>...` frente al catálogo de mutantes canónicos (M1 a M5) en transacciones efímeras con `ROLLBACK` **exclusivamente contra `DB_TEST_URL` efímera** (especialmente M3 — RLS bypass; sin dejar mutaciones en disco).
   - Escribe directamente `openspec/changes/<change-name>/mutation-report.md`.
   - *(Si se re-despacha a `db-qa-agent` para reforzar aserciones complacientes, ejecutar luego `db-test-fingerprint.js --action refreeze --reason "Refuerzo de aserciones tras Mutation Testing"`).*
2. Ejecutar la validación formal del framework OpenSpec:
   ```bash
   openspec validate "<change-name>"
   ```
3. **Evaluación de Falsabilidad y Bifurcación:**

   - **Escenario A — `[TESTS COMPLACIENTES DETECTADOS]` (Mutantes Sobrevivientes):**
     ```text
     🧟 Mutation Testing detectó Tests Complacientes:
     - Reporte de Mutación: [mutation-report.md](file:///<ruta>/openspec/changes/<change-name>/mutation-report.md)
     - Estado: [TESTS COMPLACIENTES DETECTADOS]
     - Mutantes sobrevivientes: <lista de mutantes M1..M5 no atrapados en <tests_dir>>
     
     ¿Autorizas re-despachar a db-qa-agent para blindar las aserciones complacientes indicadas?
     ```
     **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

   - **Escenario B — `[TESTS BLINDADOS]` (100% Mutantes Abatidos):**
     ```text
     🔬 Verificación de Falsabilidad y OpenSpec Completada:
     - Reporte de Mutación: [mutation-report.md](file:///<ruta>/openspec/changes/<change-name>/mutation-report.md)
     - Estado de Falsabilidad: [TESTS BLINDADOS]
     - Validación OpenSpec CLI: Superada (openspec validate "<change-name>")
     
     ¿Confirmas la entrega para que el Orquestador ejecute el Paso 7 (opsx:archive y Commit en Git)?
     ```
     **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 7 — Handoff al Orquestador (`opsx:archive` / `opsx:bulk-archive` y Commit)

1. Emitir la señal hacia el orquestador principal indicando las rutas reales del repositorio impactadas:
   ```text
   [LISTO PARA COMMIT Y ARCHIVE] <migrations_dir> <security_dir> <seeds_dir> <tests_dir> <schemas_dir> openspec/changes/<change-name>/
   ```
2. El orquestador principal tomará el control para ejecutar el workflow oficial **[`opsx:archive`](.claude/commands/opsx/archive.md)** (o **[`opsx:bulk-archive`](.claude/commands/opsx/bulk-archive.md)** si es un ticket multi-capa), el cual:
   - Verifica el estado de artefactos y tareas (`- [x]`).
   - Sincroniza las delta specs hacia `openspec/specs/<capability>/spec.md` (vía `opsx:sync`).
   - Mueve la carpeta del cambio (incluyendo `verification-report.md` y `mutation-report.md`) a `openspec/changes/archive/YYYY-MM-DD-<change-name>/`.
   - Realiza el `git commit` atómico de la entrega tras confirmación del usuario.
