---
name: backend-sdd
version: 0.1.0
description: Ciclo de desarrollo de la capa backend guiado por especificaciones (SDD / OpenSpec) ejecutando opsx:propose, Backend-TDD por dominio, opsx:apply, 4 Gates de validación mecánica determinista y opsx:verify.
trigger: "cuando el usuario seleccione desarrollar un ticket de backend (capa:backend) o diseñar/implementar APIs, servicios de dominio o jobs de backend"
tools_required:
  - Read
  - Write
  - Edit
  - AskUserQuestion
  - Bash
subagents:
  - api-architect-agent
  - backend-developer-agent
  - backend-qa-agent
inputs:
  - Ticket técnico de backend (US-XX-TN o issue de GitHub)
  - openspec/config.yaml (configuración SDD del proyecto)
  - .claude/commands/opsx/*.md (o .agent/workflows/opsx-*.md)
  - docs/prd/*.md y docs/backlog/**/us-*.md (opcional, contexto funcional)
  - Artefactos de Base de Datos (opcional según db_mode: migraciones, esquemas y specs en openspec/specs/)
outputs:
  - openspec/changes/<change-name>/proposal.md
  - openspec/changes/<change-name>/specs/<capability>/spec.md
  - openspec/changes/<change-name>/design.md
  - openspec/changes/<change-name>/tasks.md
  - openspec/changes/<change-name>/verification-report.md
  - <openapi_path> (opcional, solo cuando contract_style = 'openapi-first')
  - <tests_dir>/<modulo_o_entidad>... (tests organizados por dominio/estructura del repositorio)
  - <backend_dir>/** (código productivo: DTOs/Schemas, Repositorios, Servicios, Controladores/Routers/Workers)
commits:
  - "El orquestador (nunca este skill ni sus subagentes) ejecuta opsx:archive / opsx:bulk-archive y hace todos los commits, siempre tras confirmación explícita del usuario."
---

# backend-sdd

Skill especializado en el diseño e implementación de la **capa backend** mediante **Specification-Driven Development (SDD / OpenSpec)**, **Backend-TDD por dominio** y **4 Gates de Validación Mecánica Determinista (Zero-LLM Gates)** dentro del ecosistema `it-project-orchestrator`.

---

## 🧭 VARIABLES DE SESIÓN HEREDADAS

Este skill recibe del Orquestador o de skills previos las siguientes variables en memoria de sesión (§7.3.4):

| Variable | Valores | Uso en este skill |
|---|---|---|
| `idioma` | `español` / `inglés` | Idioma de los artefactos y mensajes |
| `tiene_repositorio` | `true` (obligatorio) | Requiere un repositorio o workspace local para persistir especificaciones, código, tests y ejecutar Gates |
| `prefijo_avance` | ej: `0001`, `0002` | Prefijo numérico incremental de la entrega/avance |
| `sufijo` | ej: `crear-endpoint-ventas` | Sufijo en kebab-case para el change-name |
| `tipo_proyecto` | `greenfield` / `brownfield` | Contexto de exploración (existencia de arquitectura backend previa) |

Si alguna de estas variables no está en memoria de sesión (usuario invocó directamente este skill):
- `idioma`: Detectar de `docs/` o asumir `español`.
- `tiene_repositorio`: Comprobar que exista un directorio de trabajo/repositorio local (`true` obligatorio para ejecutar desarrollo SDD).
- `tipo_proyecto`: Detectar si existe código en `<backend_dir>` (`brownfield`) o si está vacío (`greenfield`).
- `prefijo_avance`: Inspeccionar `openspec/changes/` o `docs/prd/` para detectar el mayor prefijo numérico existente (o `0001` si no hay previos).
- `sufijo`: Derivar del ticket técnico o requerimiento del usuario.

---

## 📋 REGLAS GENERALES

1. **Límite Estricto de Fin de Turno (Hard Turn Boundary):** Toda pausa `**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**` marca el fin absoluto de tu turno de respuesta.
   - Presenta únicamente el resultado o preguntas del paso actual.
   - **DETÉN tu respuesta inmediatamente.** No agregues texto anticipando el paso siguiente ni simules respuestas del usuario.
2. **Integración Nativa con Workflows OpenSpec (`opsx:*`):** Los subagentes NO inventan formatos ni plantillas propias para los artefactos de SDD; ejecutan directamente los workflows oficiales de OpenSpec del plugin (`.claude/commands/opsx/` o `.agent/workflows/opsx-*.md`): `opsx:explore`, `opsx:propose`, `opsx:apply`, `opsx:verify` y `opsx:archive` / `opsx:bulk-archive`.
3. **Organización de Tests según la Estructura del Repositorio:** Queda **terminantemente prohibido** nombrar archivos de test con IDs de tickets (`US-XX-TN`) o nombres del cambio (`test_<change-name>`). Los tests son activos vivos del repositorio y deben ubicarse y nombrarse por **dominio, módulo, recurso o entidad** respetando la estructura existente del proyecto (`<tests_dir>/<modulo_o_entidad>...`).
4. **Ubicación del Reporte de Verificación:** El reporte de auditoría QA se persiste exclusivamente en `openspec/changes/<change-name>/verification-report.md` para que se archive limpiamente con `opsx:archive` sin ensuciar el árbol de código productivo.
5. **Gobernanza de Git:** Ningún subagente ni skill ejecuta commits directamente. Solo el orquestador principal interactúa con Git, siempre tras confirmación explícita del usuario.
6. **Persistencia en Disco y Concisión en Chat (Repositorio Obligatorio):**
   - El ciclo SDD de backend **requiere obligatoriamente un repositorio o workspace local** (`tiene_repositorio = true`) para operar con OpenSpec, escribir código/tests y ejecutar los 4 Gates mecánicos.
   - Los subagentes persisten directamente sus entregables en disco. En chat se muestra únicamente un resumen ejecutivo conciso con enlaces directos (`file:///...`).

---

## 🎯 OBJETIVO Y FILOSOFÍA

1. **Pre-condición BD e Introspección (`Gate 1`) + Concepción vía `opsx:propose` (`api-architect-agent`) + Validación de Contrato (`Gate 2`):** Se verifica la existencia de artefactos de BD (si `db_mode = 'with-db'`), se autogeneran tipos si aplica (`typegen_cmd`), y `api-architect-agent` ejecuta `opsx:explore` y `opsx:propose` generando `proposal.md`, `specs/<capability>/spec.md`, `design.md` (con las convenciones de infraestructura detectadas) y `tasks.md` (más `openapi.yaml` si es `openapi-first`), validados mecánicamente en el **Gate 2**.
2. **Backend-TDD Organizado por Dominio en ROJO (`backend-qa-agent` Fase A):** Antes de escribir código productivo, se crean o amplían los tests del módulo/entidad en `<tests_dir>/<modulo_o_entidad>...` a partir de los escenarios Given/When/Then de `specs/` y se ejecuta `test_cmd` para verificar su fallo inicial en **ROJO**.
3. **Implementación vía `opsx:apply` (`backend-developer-agent`) + `Gate 3` (Linter, Tipos e Inmutabilidad No-DB-Diff):** El desarrollador ejecuta `opsx:apply`, implementa las capas del backend en `<backend_dir>`, marca sus tareas completadas (`- [ ]` → `- [x]`) en `tasks.md`, y el **Gate 3** verifica mecánicamente que el linter/typecheck pasen y que `git diff` sobre los directorios de BD esté vacío.
4. **Verificación en VERDE (`Gate 4`) y `opsx:verify` (`backend-qa-agent` Fase B):** Se ejecuta la suite de pruebas en **VERDE** (`Gate 4`) y `backend-qa-agent` conduce `opsx:verify` (Completeness, Correctness y Coherence + auditoría anti-bypass RLS/RBAC/IDOR), generando `openspec/changes/<change-name>/verification-report.md`.
5. **Gobernanza de Cierre (`opsx:archive` y `Commit`):** El Orquestador principal ejecuta `opsx:archive` (o `opsx:bulk-archive`) para sincronizar las delta specs en `openspec/specs/`, archivar el cambio (con su `verification-report.md`) y realizar el commit en Git.

---

## 👣 PROCEDIMIENTO PASO A PASO

### Paso 0 — Verificación de Pre-condiciones (Input Gate y Gate 1: BD & Tipos)

1. **Input Gate — Verificación de Pre-condiciones (§7.3.3):**
   - **Pre-condición A (Repositorio / Workspace Local Obligatorio):**
     - Verificar que `tiene_repositorio = true` (que exista un repositorio o workspace local activo).
     - Si `tiene_repositorio = false` o no existe workspace local:
       ```text
       ❌ [INPUT GATE]: El ciclo de desarrollo SDD para Backend requiere obligatoriamente un repositorio o workspace local.
       Por favor, abre o inicializa el repositorio/workspace del proyecto antes de continuar.
       ```
       **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera a que el usuario provea un repositorio o workspace local.
   - **Pre-condición B (OpenSpec Config):**
     - Verificar la existencia de `openspec/config.yaml` en el proyecto destino.
     - Si `openspec/config.yaml` **NO existe en disco**:
       ```text
       ❌ [INPUT GATE]: El entorno de Specification-Driven Development (OpenSpec) no está inicializado en este repositorio (falta 'openspec/config.yaml').
       Debes ejecutar primero el skill '_skills/sdd-init/SKILL.md' (o la opción [4] del orquestador) para configurar OpenSpec antes de iniciar el ciclo de backend.
       ```
       **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí e instruye al usuario a inicializar SDD primero.
   - **Pre-condición C (Ticket Técnico de Backend):**
     - Verificar que el usuario haya indicado o seleccionado un ticket técnico de backend (`capa:backend`) con ID, título o criterios de aceptación.
     - Si no se indicó ningún ticket:
       ```text
       ❓ [INPUT GATE]: No se ha especificado un ticket técnico para el desarrollo de backend.
       Por favor, indica el ID del ticket (ej. US-03-T2 o issue #22) o describe el requerimiento de backend a desarrollar.
       ```
       **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera a que el usuario provea el requerimiento.

2. **Ejecución del Gate 1 — Pre-condición de Base de Datos e Introspección Determinista:**
   - Determinar si el ticket interactúa con base de datos (`db_mode = 'with-db'`) o es independiente (`db_mode = 'stateless'`).
   - Ejecutar el Gate 1 del validador determinista:
     ```bash
     node "<plugin-root>/scripts/validate-backend.js" --gate 1 --repo-root "<repo-destino>" --db-mode "<db_mode>" --db-dirs "<db_dirs_csv>"
     ```
   - Si `db_mode = 'with-db'` y el Gate 1 devuelve `exit 1` (faltan artefactos de BD), **detenerse** e informar que debe completarse primero `_skills/db-sdd/SKILL.md`.
   - Si el proyecto cuenta con comando de introspección/autogeneración de tipos desde la BD (`typegen_cmd`: ej. `supabase gen types`, `npx prisma generate`), ejecutarlo y verificar `exit 0`.

3. **Handoff Inmediato al Paso 1:**
   - Cumplido el Gate 1, definir el identificador del cambio `<change-name>` en `kebab-case` (ej. `0022-crear-endpoint-ventas` o `<ticket_id>-backend`) y avanzar inmediatamente al Paso 1 delegando la ejecución de `opsx:explore` y `opsx:propose` a `api-architect-agent`.

---

### Paso 1 — Exploración y Propuesta vía `opsx:propose` (`api-architect-agent` + Gate 2)

1. Invocar a `api-architect-agent` entregando el `<change-name>`, el ticket técnico y la referencia al workflow **[`opsx:propose`](.claude/commands/opsx/propose.md)** (o `.agent/workflows/opsx-propose.md`).
2. `api-architect-agent` ejecuta el flujo oficial de `opsx:propose`:
   - **Exploración del Repositorio (`opsx:explore`):** Detecta y registra en `design.md` la infraestructura y convenciones reales del proyecto: `stack`, `backend_dir`, `arch_pattern` (capas Greenfield vs. estructura Brownfield), `db_mode` (`with-db` | `stateless`), `db_dirs`, `typegen_cmd`, `rls_mode` (`dedicated` / `in-situ` / `none`), `auth_mode` (`jwt` / `session` / `api-key` / `none`), `contract_style` (`code-first` como FastAPI/Pydantic vs. `openapi-first` vs. `worker-job` / `graphql` / `grpc`), `tests_dir` (y su convención modular por entidad/dominio), `lint_cmd`, `typecheck_cmd`, `test_cmd` y `ci_hooks_status` (existencia de `pre-commit` / `pre-push` / CI).
   - **Creación Guiada por el Grafo de OpenSpec:** Ejecuta `openspec new change "<change-name>"`, consulta `openspec status --change "<change-name>" --json` y para cada artefacto obtiene su `template`, `context`, `rules` y `outputPath` con `openspec instructions <artifact-id> --change "<change-name>" --json`:
     - `openspec/changes/<change-name>/proposal.md`: Why, What, Non-goals y compatibilidad.
     - `openspec/changes/<change-name>/specs/<capability>/spec.md`: Requisitos formales y escenarios Given/When/Then (`2xx`, errores `4xx` y seguridad/multi-tenancy).
     - `openspec/changes/<change-name>/design.md`: Convenciones de infraestructura detectadas, diagrama Mermaid de alto contraste, contratos de entrada/salida (DTOs/Schemas), transacciones y estrategia de seguridad (`rls_mode` / `auth_mode`). Si `contract_style = 'openapi-first'`, genera además `<openapi_path>`.
     - `openspec/changes/<change-name>/tasks.md`: Checklist (`- [ ]`) de tareas atómicas ordenadas topológicamente.
3. **Ejecución del Gate 2 — Validación Mecánica de Especificación y Contrato:**
   - Validar el paquete en OpenSpec y con el validador determinista:
     ```bash
     openspec validate "<change-name>"
     node "<plugin-root>/scripts/validate-backend.js" --gate 2 --repo-root "<repo-destino>" --change-dir "openspec/changes/<change-name>" --contract-style "<contract_style>" --openapi-path "<openapi_path_si_aplica>"
     ```
   - Si `contract_style = 'openapi-first'` y existe linter OpenAPI (`spectral` / `openapi-spec-validator`), ejecutarlo complementariamente.
4. **Presentar en chat el resumen ejecutivo unificado (incluyendo sugerencia proactiva de Hooks/CI si no existen):**

```text
📐 Paquete de Propuesta y Diseño Backend generado vía opsx:propose (Gates 1 y 2 superados):
- Ticket: <ID o título> | Cambio: <change-name>
- Infraestructura detectada: Stack <stack> (<arch_pattern>) en <backend_dir>, BD: <db_mode>, Seguridad: <auth_mode> / RLS: <rls_mode>, Contrato: <contract_style>, Tests: <tests_dir>
- Hooks / CI (`ci_hooks_status`): <'Configurados' | '⚠️ No se detectó validación pre-commit / pre-push / CI en el proyecto — ¿Deseas que la configure con tu autorización?'>
- Propuesta: [proposal.md](file:///<ruta>/openspec/changes/<change-name>/proposal.md)
- Especificación: [spec.md](file:///<ruta>/openspec/changes/<change-name>/specs/<capability>/spec.md)
- Diseño y Convenciones: [design.md](file:///<ruta>/openspec/changes/<change-name>/design.md)
- Contrato OpenAPI: [openapi.yaml](file:///<ruta>/<openapi_path>) (solo si contract_style = 'openapi-first')
- Plan de Tareas: [tasks.md](file:///<ruta>/openspec/changes/<change-name>/tasks.md)

¿Apruebas esta especificación, diseño y plan de tareas (y me indicas si deseas crear la configuración de pre-commit/pre-push/CI en caso de faltar) para avanzar al Paso 2 (Suite Backend-TDD en ROJO)?
```

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 2 — Suite Backend-TDD por Dominio y Verificación en ROJO (`backend-qa-agent` Fase A)

1. **Configuración de Hooks / CI (solo si el usuario lo autorizó en el Paso 1):**
   - Si el usuario autorizó crear `pre-commit`, `pre-push` o el workflow de CI, generar los archivos correspondientes antes de ejecutar el Paso 2.
2. Invocar a `backend-qa-agent` (Fase A) entregando el `<change-name>` para que cargue los artefactos desde `openspec instructions apply --change "<change-name>" --json` (incluyendo las convenciones persistidas en `design.md`).
3. `backend-qa-agent` crea o actualiza los archivos de prueba **respetando estrictamente la estructura de directorios y nombres de dominio/módulo del repositorio** (`<tests_dir>/<modulo_o_entidad>...`, **nunca** con el ID del ticket ni `<change-name>`):
   - Mapeo 1:1 de los escenarios Given/When/Then de `specs/<capability>/spec.md`.
   - Casos negativos de validación y reglas de negocio (`400/404/409/422`).
   - Pruebas negativas de seguridad y aislamiento multi-tenant (`401/403`/IDOR según `rls_mode` y `auth_mode`).
4. **Verificación en ROJO:**
   - `backend-qa-agent` ejecuta `test_cmd` mediante `Bash` y confirma que los nuevos casos de prueba fallen en **ROJO** (porque el código productivo del cambio aún no fue implementado).
5. Notificar al usuario con enlace a los tests de dominio y confirmación del estado Rojo:

```text
🧪 Suite Backend-TDD de dominio preparada y verificada en ROJO:
- Archivos de prueba (por dominio/módulo): [<modulo>.test...](file:///<ruta>/<tests_dir>/<archivo_test_dominio>)
- Estado inicial: 🔴 ROJO verificado (las aserciones fallan esperadamente antes de la implementación).
- Cobertura: 100% de escenarios Given/When/Then de spec.md.

¿Procedemos al Paso 3 (opsx:apply — Implementación del Backend y Gate 3)?
```

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 3 — Implementación Backend vía `opsx:apply` y Gate 3 (`backend-developer-agent`)

1. Invocar a `backend-developer-agent` entregando el `<change-name>` y la referencia al workflow **[`opsx:apply`](.claude/commands/opsx/apply.md)** (o `.agent/workflows/opsx-apply.md`).
2. `backend-developer-agent` ejecuta `opsx:apply` para las tareas de código backend:
   - Consulta `openspec instructions apply --change "<change-name>" --json` y lee `contextFiles` (`proposal`, `specs`, `design`, `tasks`).
   - Implementa en `<backend_dir>` los DTOs/Schemas, Repositorios (si `db_mode = 'with-db'`), Servicios de Dominio y Controladores/Routers/Workers respetando `arch_pattern`, `rls_mode` y `auth_mode`.
   - **Actualiza `tasks.md`:** Marca cada tarea implementada (`- [ ]` → `- [x]`) en `openspec/changes/<change-name>/tasks.md`.
3. **Ejecución del Gate 3 — Análisis Estático, Tipado e Inmutabilidad de BD (No-DB-Diff):**
   - Ejecutar el validador mecánico universal (Gate 3):
     ```bash
     node "<plugin-root>/scripts/validate-backend.js" --gate 3 --repo-root "<repo-destino>" --backend-dir "<backend_dir>" --db-mode "<db_mode>" --db-dirs "<db_dirs_csv>" --rls-mode "<rls_mode>"
     ```
   - Ejecutar los comandos nativos de linter y typecheck del proyecto (`<lint_cmd>` y `<typecheck_cmd>`).
   - Si el Gate 3 o los linters fallan (`exit != 0`): si hubo modificación prohibida en `<db_dirs>`, revertirla inmediatamente; re-despachar a `backend-developer-agent` con el log de errores hasta que el Gate 3 pase limpiamente.
4. Presentar resumen ejecutivo en chat:

```text
🛠️ Implementación Backend vía opsx:apply completada y Gate 3 superado:
- Archivos implementados en `<backend_dir>`:
  - Schemas / DTOs: <enlaces>
  - Repositorios / Acceso a Datos: <enlaces> (si db_mode = 'with-db')
  - Servicios / Lógica de Dominio: <enlaces>
  - Routers / Controladores / Workers: <enlaces>
- Progreso en tasks.md: <M>/<M> tareas completadas [x]
- Gate 3 (Linter, Typecheck & 0 Diff en BD): ✅ Superado

¿Procedemos al Paso 4 (Gate 4 de ejecución de tests y verificación en VERDE con opsx:verify)?
```

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 4 — Gate 4 (Tests en VERDE) y Verificación vía `opsx:verify` (`backend-qa-agent` Fase B)

1. **Ejecución del Gate 4 — Corrida Determinista de la Suite de Pruebas:**
   - Leer `tests_dir` y `test_cmd` desde `openspec/changes/<change-name>/design.md` y ejecutar:
     ```bash
     node "<plugin-root>/scripts/validate-backend.js" --gate 4 --repo-root "<repo-destino>" --change-dir "openspec/changes/<change-name>" --tests-dir "<tests_dir>" --test-cmd "<test_cmd>"
     ```
2. **Verificación en VERDE y Ejecución de `opsx:verify` con `backend-qa-agent` (§7.5.2):**
   - Invocar únicamente a `backend-qa-agent` (Fase B) con la referencia al workflow **[`opsx:verify`](.claude/commands/opsx/verify.md)**:
     - Verifica que **todos los tests del dominio en `<tests_dir>` pasen en VERDE**.
     - Ejecuta `opsx:verify` evaluando sus 3 dimensiones oficiales (**Completeness**: todas las tareas `[x]` en `tasks.md` y requisitos de `specs/`; **Correctness**: cobertura de escenarios Given/When/Then en verde y pruebas negativas de seguridad/multi-tenancy; **Coherence**: *Drift Check* 1:1 contra `design.md`/`openapi.yaml` e inmutabilidad de BD).
     - Escribe el reporte en `openspec/changes/<change-name>/verification-report.md`.
3. **Validación Formal OpenSpec:**
   ```bash
   openspec validate "<change-name>"
   ```
4. **Evaluación del Dictamen de `opsx:verify` y Bifurcación:**

   - **Escenario A — Dictamen `[OBSERVADO CON CORRECCIONES REQUERIDAS]` (Fallos en Gate 4 o Issues `CRITICAL`):**
     ```text
     ⚠️ Verificación opsx:verify OBSERVADA (Correcciones Requeridas):
     - Reporte: [verification-report.md](file:///<ruta>/openspec/changes/<change-name>/verification-report.md)
     - Veredicto: [OBSERVADO CON CORRECCIONES REQUERIDAS]
     - Hallazgos críticos: <lista de fallos de tests, tareas incompletas, drift o brechas de seguridad>
     - Invariante TDD: Los tests de dominio en <tests_dir> no se relajan ante fallos de implementación (se corrige el código en <backend_dir>).

     ¿Autorizas re-despachar a backend-developer-agent (Paso 3) para corregir la implementación?
     ```
     **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

   - **Escenario B — Dictamen `[APROBADO]` en `opsx:verify`:**
     ```text
     📊 Verificación opsx:verify y Backend-TDD en VERDE completada:
     - Reporte: [verification-report.md](file:///<ruta>/openspec/changes/<change-name>/verification-report.md)
     - Veredicto: [APROBADO] (Completeness, Correctness y Coherence 100% verificadas)
     - Suite Backend-TDD en <tests_dir>: 🟢 100% en VERDE
     - Gates Deterministas (1 a 4) y openspec validate: ✅ Superados

     ¿Confirmas la entrega para pasar al Paso 5 (opsx:archive y Commit por el Orquestador)?
     ```
     **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 5 — Handoff al Orquestador (`opsx:archive` / `opsx:bulk-archive` y Commit)

1. Emitir la señal hacia el orquestador principal indicando las rutas reales del repositorio impactadas:
   ```text
   [LISTO PARA COMMIT Y ARCHIVE] <backend_dir> <tests_dir> openspec/changes/<change-name>/
   ```
2. El orquestador principal tomará el control para ejecutar el workflow oficial **[`opsx:archive`](.claude/commands/opsx/archive.md)** (o **[`opsx:bulk-archive`](.claude/commands/opsx/bulk-archive.md)** si es un ticket multi-capa), el cual:
   - Verifica el estado de artefactos y tareas (`- [x]`).
   - Sincroniza las delta specs hacia `openspec/specs/<capability>/spec.md` (vía `opsx:sync`).
   - Mueve la carpeta del cambio (incluyendo `verification-report.md`) a `openspec/changes/archive/YYYY-MM-DD-<change-name>/`.
   - Realiza el `git commit` atómico de la entrega tras confirmación del usuario.
