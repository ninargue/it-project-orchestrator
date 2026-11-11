---
name: db-sdd
version: 0.1.0
description: Ciclo de desarrollo de base de datos guiado por especificaciones (SDD / OpenSpec) coordinando exploración, DB-TDD, equipo multi-agente y validaciones mecánicas deterministas.
trigger: "cuando el usuario seleccione desarrollar un ticket de base de datos (capa:db) o diseñar/implementar esquemas y migraciones de BD"
tools_required:
  - Read
  - Write
  - AskUserQuestion
  - bash
subagents:
  - db-architect-agent
  - db-developer-agent
  - db-security-agent
  - db-qa-agent
  - db-mutation-tester
inputs:
  - Ticket técnico de base de datos (US-XX-TN o issue de GitHub)
  - docs/prd/*.md (opcional, contexto de dominio existente)
  - docs/backlog/**/us-*.md (opcional, historias asociadas)
  - database/migrations/ (opcional, migraciones previas para brownfield)
  - openspec/config.yaml (configuración SDD del proyecto)
outputs:
  - openspec/changes/<change-name>/proposal.md
  - openspec/changes/<change-name>/specs/<capability>/spec.md
  - openspec/changes/<change-name>/design.md
  - openspec/changes/<change-name>/tasks.md
  - database/schemas/erd.md (actualizado si hay tablas nuevas o FKs alteradas)
  - database/tests/<change-name>-test.sql (o formato de runner nativo)
  - database/migrations/<timestamp>_<change-name>.up.sql (o archivo único en forward-only)
  - database/migrations/<timestamp>_<change-name>.down.sql (en modo simétrico)
  - database/security/<timestamp>_security_rls.sql (si rls_mode != 'none')
  - database/security/<timestamp>_security_rls.down.sql (si rls_mode != 'none' y simétrico)
  - database/seeds/<timestamp>_seeds.sql (si requires_seeds = true)
  - database/reports/<change-name>-mutation-report.md (si hay constraints o RLS a falsar)
  - database/reports/<change-name>-qa-report.md
commits:
  - "El orquestador (nunca este skill ni sus subagentes) hace todos los commits, siempre tras confirmación explícita del usuario."
---

# db-sdd

Skill especializado en el desarrollo e implementación de bases de datos mediante **Specification-Driven Development (SDD / OpenSpec)** y **DB-TDD (Database Test-Driven Development)** dentro del ecosistema `it-project-orchestrator`.

---

## 🧭 VARIABLES DE SESIÓN HEREDADAS

Este skill recibe del Orquestador o de skills previos las siguientes variables en memoria de sesión (§7.3.4):

| Variable | Valores | Uso en este skill |
|---|---|---|
| `idioma` | `español` / `inglés` | Idioma de los artefactos y mensajes |
| `tiene_repositorio` | `true` / `false` | Determina si los subagentes escriben a disco o vuelcan contenido en chat |
| `prefijo_avance` | ej: `0001`, `0002` | Prefijo numérico incremental de la entrega/avance |
| `sufijo` | ej: `crear-esquema-usuarios` | Sufijo en kebab-case para el change-name |
| `tipo_proyecto` | `greenfield` / `brownfield` | Contexto de exploración (existencia de esquemas previos) |

Si alguna de estas variables no está en memoria de sesión (usuario invocó directamente este skill):
- `idioma`: Detectar de `docs/` o asumir `español`.
- `tiene_repositorio`: Comprobar si existe directorio de trabajo local (`true` si opera sobre repo; si no, `false`).
- `tipo_proyecto`: Detectar si existen migraciones en disco (`brownfield`) o si el directorio de BD está vacío (`greenfield`).
- `prefijo_avance`: Inspeccionar `openspec/changes/` o `docs/prd/` para detectar el mayor prefijo numérico existente (o `0001` si no hay previos).
- `sufijo`: Derivar del ticket técnico o requerimiento del usuario.

---

## 📋 REGLAS GENERALES

1. **Límite Estricto de Fin de Turno (Hard Turn Boundary):** Toda pausa `🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**` marca el fin absoluto de tu turno de respuesta.
   - Presenta únicamente el resultado o preguntas del paso actual.
   - **DETÉN tu respuesta inmediatamente.** No agregues texto anticipando el paso siguiente ni simules respuestas del usuario.
2. **Gobernanza de Git:** Ningún subagente ni skill ejecuta commits directamente. Solo el orquestador principal interactúa con Git, siempre tras confirmación explícita del usuario.
3. **Modo Dual (Concisión en Chat vs. Persistencia en Disco):**
   - **Si `tiene_repositorio = true`:** Los subagentes persisten directamente sus entregables en disco. En chat se muestra únicamente un resumen ejecutivo conciso con enlaces directos (`file:///...`).
   - **Si `tiene_repositorio = false` (modo conversación):** Los subagentes vuelcan el contenido completo en el chat para que el usuario pueda validarlo; las validaciones mecánicas y runners se realizan de forma estática conversacional al no existir entorno de base de datos en disco.

---

## 🎯 OBJETIVO Y FILOSOFÍA

1. **Exploración Previa y Non-Goals (`proposal.md`):** Todo cambio parte de la inspección del esquema actual para delimitar estrictamente el alcance y prevenir breaking changes.
2. **Apply-Ready en un Solo Hito (`proposal.md` + `specs/` + `design.md` + `tasks.md`):** `db-architect-agent` entrega el paquete completo de propuesta, especificación formal con escenarios Given/When/Then, modelo físico y desglose de tareas atómicas para aprobación humana en un solo punto de control.
3. **DB-TDD Guiado por Especificaciones (Spec-Driven TDD):** Los casos de prueba (`database/tests/<change-name>-test.sql`) se derivan directamente de los requisitos y escenarios Given/When/Then de la `spec.md` antes de implementar el código DDL. Si los tests fallan en Verify, se retroalimenta y corrige el desarrollo, nunca los tests.
4. **Reportes Atómicos Versionados:** Cada cambio cuenta con su propio reporte inmutable en `database/reports/<change-name>-qa-report.md`.
5. **Gobernanza de Cierre (`Archive` y `Commit`):** La skill entrega el cambio verificado al Orquestador principal, quien ejecuta el archivado en OpenSpec (consolidando `spec.md` en `openspec/specs/`) y el commit en Git.

---

## 👣 PROCEDIMIENTO PASO A PASO

### Paso 0 — Verificación de Pre-condiciones (Input Gate) y Exploración

1. **Input Gate — Verificación de Pre-condiciones (§7.3.3):**
   - **Pre-condición A (OpenSpec Config):**
     - Si `tiene_repositorio = true`, verificar la existencia de `openspec/config.yaml` en el proyecto destino.
     - Si `openspec/config.yaml` **NO existe en disco**:
       ```text
       ❌ [INPUT GATE]: El entorno de Specification-Driven Development (OpenSpec) no está inicializado en este repositorio (falta 'openspec/config.yaml').
       Debes ejecutar primero el skill '_skills/sdd-init/SKILL.md' (o la opción [4] del orquestador) para configurar OpenSpec antes de iniciar el ciclo de base de datos.
       ```
       🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí e instruye al usuario inicializar SDD primero.
   - **Pre-condición B (Ticket Técnico de BD):**
     - Verificar que el usuario haya indicado o seleccionado un ticket técnico de base de datos (`capa:db`) con ID, título o criterios de aceptación.
     - Si no se indicó ningún ticket:
       ```text
       ❓ [INPUT GATE]: No se ha especificado un ticket técnico para el desarrollo de base de datos.
       Por favor, indica el ID del ticket (ej. US-03-T1 o issue #17) o describe el requerimiento de base de datos a desarrollar.
       ```
       🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera a que el usuario provea el requerimiento.

2. Obtener los datos del ticket técnico (`capa:db`):
   - ID del ticket (ej. `US-03-T1` o issue #17), título y criterios de aceptación.
3. Explorar activamente el repositorio destino para detectar su configuración y arquitectura:
   - **Motor de BD (`engine`)**: Inspeccionar archivos de configuración (`supabase/config.toml`, `prisma/schema.prisma`, `docker-compose.yml`, `package.json`, `.env.example`, `docs/tech-briefing.md` u `openspec/config.yaml`). Por defecto: `postgres`.
   - **Directorio de migraciones (`migrations_dir`)**: Detectar si existe `supabase/migrations`, `database/migrations`, `src/database/migrations`, `prisma/migrations`, `db/migrations`, `migrations`, etc. Si no existe aún, proponer la convención adecuada según el motor/stack detectado.
   - **Modo de Migración (`migration_mode`)**: Detectar si el proyecto usa pares simétricos (`symmetric`: `.up.sql` y `.down.sql`) o migraciones unidireccionales (`forward-only`: un único archivo `.sql` por cambio, común en Prisma, Flyway o Supabase mono-file).
   - **Estrategia de Seguridad / RLS en BD (`rls_mode`)**: Detectar si el proyecto requiere Row-Level Security a nivel de base de datos o si la seguridad se gestiona exclusivamente en la capa de aplicación:
     - `dedicated`: Directorio dedicado (`supabase/security`, `database/security`, `security/`, `policies/`).
     - `in-situ`: Políticas RLS y DCL gestionadas dentro de las propias migraciones.
     - `none`: **No requerido** (seguridad, autenticación y multi-tenancy delegados a la capa de aplicación/backend con ORM o servicios; la BD no usa RLS).
   - **Datos de Prueba / Fixtures (`requires_seeds`)**: Determinar si el ticket solicita datos iniciales o mocks (`true`) o si es un cambio de esquema puro sin seeds (`false`). Por defecto: `false`.
   - **Runner Estándar de Pruebas (`test_cmd`)**: Inspeccionar si existe un `Makefile` con targets para testing de BD (`make test-db`, `make db-test`, `make test`). Si no existe, detectar el runner nativo (`supabase test db`, `npm test`, `pytest`).
   - **Comandos de Validación Estándar del Proyecto (`validation_cmd`)**: Inspeccionar si el proyecto cuenta con tareas de validación/linting en `Makefile` (`make db-validate`), `package.json` (`npm run db:validate`) o CLIs del stack (`supabase db lint`, `atlas migrate validate`).
3. Definir el identificador único del cambio en `kebab-case`: `<change-name>` (ej. `0017-crear-esquema-usuarios`, o `<ticket_id>-db` si forma parte de un ticket multi-capa).

```text
💡 Iniciando ciclo SDD de Base de Datos:
- Ticket: <ID o título>
- Motor de BD: <engine detectado o configurado>
- Directorio de migraciones: <migrations_dir detectado> (modo: <symmetric | forward-only>)
- Seguridad en BD (RLS): <'dedicado' | 'in-situ' | 'no requerido (seguridad a nivel aplicación)'>
- Runner de pruebas DB-TDD: <test_cmd detectado, ej: 'make test-db'>
- Comando de validación: <validation_cmd detectado o 'ninguno (usar validador nativo)'>
- Datos iniciales (seeds): <'requerido' | 'no requerido'>
- Cambio OpenSpec: <change-name>

¿Confirmas estos parámetros para iniciar la exploración y propuesta técnica?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 1 — Exploración, Propuesta y Tareas (OpenSpec Propose)

1. Explorar migraciones y esquemas existentes en `database/migrations/` o `schema.sql`.
2. Inicializar formalmente el cambio en el framework OpenSpec:
   ```bash
   openspec new change "<change-name>"
   ```
   Esto crea el directorio `openspec/changes/<change-name>/` con su archivo de metadatos `.openspec.yaml`.
3. Consultar las instrucciones y plantillas oficiales del framework OpenSpec:
   - `openspec instructions proposal --change "<change-name>" --json`
   - `openspec instructions specs --change "<change-name>" --json`
   - `openspec instructions design --change "<change-name>" --json`
   - `openspec instructions tasks --change "<change-name>" --json`
4. Invocar a `db-architect-agent` entregando:
   - Las plantillas y reglas de esquema oficiales extraídas de `openspec instructions`.
   - El ticket técnico, contexto de dominio y esquema preexistente.
5. El agente genera y escribe directamente los artefactos en disco:
   - `openspec/changes/<change-name>/proposal.md`: Why, What, Non-goals y análisis de riesgos.
   - `openspec/changes/<change-name>/specs/<capability>/spec.md`: Requisitos formales de datos y escenarios Given/When/Then.
   - `openspec/changes/<change-name>/design.md`: ERD Mermaid del cambio (alto contraste), diccionario físico, tipos, constraints e índices.
   - `openspec/changes/<change-name>/tasks.md`: Lista de tareas atómicas ordenadas topológicamente.
   - **ERD Consolidado (`database/schemas/erd.md`):** Actualizado directamente **únicamente si el cambio crea nuevas tablas o altera relaciones (FKs)**. Para índices, triggers o alteraciones de columnas, no se modifica `erd.md`.
6. Validar formalmente el cambio con el CLI de OpenSpec:
   ```bash
   openspec validate "<change-name>"
   ```
7. Presentar en chat el **resumen ejecutivo** de la propuesta y diseño con sus enlaces:

```text
📐 Paquete de Propuesta y Especificación preparado (OpenSpec):
- Propuesta: [proposal.md](file:///<ruta>/openspec/changes/<change-name>/proposal.md)
- Especificación: [spec.md](file:///<ruta>/openspec/changes/<change-name>/specs/<capability>/spec.md)
- Modelo y Diccionario: [design.md](file:///<ruta>/openspec/changes/<change-name>/design.md)
- ERD Consolidado: [erd.md](file:///<ruta>/database/schemas/erd.md) (si fue actualizado)
- Plan de Tareas: [tasks.md](file:///<ruta>/openspec/changes/<change-name>/tasks.md)

¿Apruebas esta especificación, diseño y plan de tareas para avanzar a la suite DB-TDD e implementación?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 2 — Suite DB-TDD y Verificación en ROJO (Red Phase)

1. Invocar a `db-qa-agent` (Fase A) entregando:
   - `specs/<capability>/spec.md` (fuente de verdad funcional con requisitos y escenarios Given/When/Then).
   - `design.md` (modelo físico para tipos y nombres de columnas).
   - Motor de BD (`engine`) y runner de pruebas (`test_cmd`, ej. `make test-db`).
2. El agente deriva y escribe directamente la suite en disco:
   - `database/tests/<change-name>-test.sql` (o formato de runner nativo detectado).
   - Mapeo 1:1 de escenarios Given/When/Then en aserciones ejecutables.
   - Casos negativos estructurados para constraints (`NOT NULL`, `CHECK`, `UNIQUE`) y foreign keys sin romper el runner.
   - Pruebas de aislamiento de políticas RLS y privilegios DCL (únicamente si `rls_mode` es `dedicated` o `in-situ`; si `rls_mode = 'none'`, se omiten pruebas de RLS y la suite se enfoca en integridad referencial, tipos, constraints y triggers).
3. **Verificación en ROJO:**
   - El agente ejecuta `make test-db` (o el runner del proyecto) mediante `bash` y confirma que los tests fallen con **ROJO** (fallo esperado porque el DDL aún no existe), comprobando que las aserciones son válidas y no tautológicas.
4. Notificar al usuario con enlace al test y confirmación del estado Rojo:

```text
🧪 Suite DB-TDD preparada y verificada en ROJO:
- Archivo de pruebas: [test.sql](file:///<ruta>/database/tests/<change-name>-test.sql)
- Estado inicial: 🔴 ROJO verificado (las aserciones fallan esperadamente antes del DDL).
- Cobertura: 100% de escenarios Given/When/Then especificados.

¿Procedemos a ejecutar la fase Apply para generar el código DDL y las migraciones?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 3 — Implementación DDL y Migraciones (OpenSpec Apply: DDL)

1. Invocar a `db-developer-agent` para ejecutar las tareas DDL de `tasks.md`.
2. El agente escribe directamente los archivos de migración en `<migrations_dir>`:
   - **Si `migration_mode = 'symmetric'`:**
     - `<migrations_dir>/<timestamp>_<change-name>.up.sql`
     - `<migrations_dir>/<timestamp>_<change-name>.down.sql`
   - **Si `migration_mode = 'forward-only'`:**
     - `<migrations_dir>/<timestamp>_<change-name>.sql`
   - **Seeds / Fixtures:** Escribe `<seeds_dir>/<timestamp>_seeds.sql` **únicamente si `requires_seeds` es true**.
3. Presentar resumen ejecutivo en chat:

```text
🛠️ Scripts DDL y migraciones generados (Fase Apply: DDL):
- Migración: [up.sql o migration.sql](file:///<ruta>/<migrations_dir>/<archivo_migracion>)
- Rollback DOWN: [down.sql](file:///<ruta>/<migrations_dir>/<timestamp>_<change-name>.down.sql) (si aplica)
- Datos sintéticos (seeds): [seeds.sql](file:///<ruta>/<seeds_dir>/<timestamp>_seeds.sql) (si aplica)

¿Validás el DDL generado para proceder con el diseño de políticas de seguridad y RLS?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 4 — Seguridad, RLS y Control de Acceso (OpenSpec Apply: Security)

> [!NOTE] Gate Condicional de Seguridad y RLS
> Este paso opera como un **Gate Condicional**:
> - **Si el proyecto NO requiere RLS (`rls_mode = 'none'`)**: La seguridad y autorización se gestionan en la capa de aplicación (backend / ORM / servicios) o la base de datos es single-tenant. **Este paso se omite completamente** (o se define DCL técnico mínimo si el proyecto usa roles de conexión separados) y se avanza directamente al Paso 5 sin invocar a `db-security-agent`.
> - **Si el proyecto requiere RLS (`rls_mode` = 'dedicated' o 'in-situ')**: Se ejecuta si el motor soporta RLS (PostgreSQL, Supabase) **Y** el ticket o `design.md` especifica tablas con datos multi-tenant o información sensible (PII). Si el cambio específico solo involucra tablas maestras o catálogos técnicos, se documenta la exención y se avanza al Paso 5.

1. Si el gate condicional está activo, invocar a `db-security-agent` entregando:
   - `design.md` (especificación de PII y multi-tenancy).
   - Scripts DDL generados y validados en el Paso 3.
2. El agente genera y escribe directamente los scripts de seguridad en disco:
   - Políticas RLS con cobertura explícita para las 4 operaciones (`SELECT`, `INSERT`, `UPDATE` con `USING` y `WITH CHECK`, `DELETE` con `USING`) e índices de aceleración: `<timestamp>_security_rls.sql`
   - Script simétrico de reversión (rollback de seguridad): `<timestamp>_security_rls.down.sql` (con `DROP POLICY IF EXISTS`, `REVOKE ...` y `DROP INDEX IF EXISTS`).
   - Control de acceso DCL (roles, usuarios y grants de mínimo privilegio).
3. Presentar resumen ejecutivo en chat:

```text
🔒 Políticas de Seguridad y RLS generadas (Fase Apply: Security):
- Script RLS: [security_rls.sql](file:///<ruta>/<security_dir_o_migraciones>/<timestamp>_security_rls.sql)
- Rollback RLS: [security_rls.down.sql](file:///<ruta>/<security_dir_o_migraciones>/<timestamp>_security_rls.down.sql)
- Tablas protegidas: <lista_de_tablas_con_RLS> (cobertura SELECT, INSERT, UPDATE, DELETE)
- Control de acceso: Roles DCL y grants de mínimo privilegio aplicados.

¿Procedemos a ejecutar la validación mecánica determinista y la verificación de tests en VERDE?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 5 — Validación Mecánica y Verificación en VERDE (OpenSpec Verify)

1. **Validación Mecánica Determinista Multiplataforma (Node.js):**
   - Ejecutar el validador universal en Node.js, pasando los parámetros explorados y confirmados en el Paso 0:
     - **Si el proyecto usa RLS (`dedicated` o `in-situ`):**
       ```bash
       node "<plugin-root>/scripts/validate-db-migrations.js" --migrations-dir "<repo-destino>/<migrations_dir>" --security-dir "<repo-destino>/<security_dir>" --engine "<engine>"
       ```
     - **Si el proyecto NO requiere RLS (`rls_mode = 'none'`):**
       ```bash
       node "<plugin-root>/scripts/validate-db-migrations.js" --migrations-dir "<repo-destino>/<migrations_dir>" --no-rls --engine "<engine>"
       ```
2. **Ejecución de Validadores Estándar del Proyecto (si existen):**
   - Ejecutar `validation_cmd` (`make db-validate`, `npm run db:validate`, etc.) si fue detectado.
3. **Verificación en VERDE con `db-qa-agent`:**
   - Invocar a `db-qa-agent` (Fase B):
     - Ejecuta `make test-db` (o `test_cmd`) mediante `bash` y comprueba que **todos los tests pasen exitosamente a VERDE** contra el DDL y RLS implementados.
     - Realiza el *Drift Check* estricto (`spec.md` y `design.md` vs código SQL generado).
     - Escribe directamente `database/reports/<change-name>-qa-report.md`.
4. **Pruebas de Mutación Condicionales (`db-mutation-tester`):**
   - **Condición de activación:** Si el cambio introduce restricciones de integridad (`UNIQUE`, `CHECK`, FKs) o políticas RLS:
     - Invocar a `db-mutation-tester` para evaluar la falsabilidad contra los mutantes canónicos (M1 a M5).
     - El agente escribe directamente `database/reports/<change-name>-mutation-report.md`.
     - Si algún mutante sobrevive (test complaciente), se reporta para blindar las aserciones.
   - **Exención:** Si el cambio es solo de índices, vistas o rendimiento sin constraints de negocio, se documenta la exención y se omite.
5. **Validación Formal OpenSpec:**
   - Ejecutar la validación del framework para confirmar que el change cumple todas las reglas:
     ```bash
     openspec validate "<change-name>"
     ```
6. **Evaluación de Resultados y Bifurcación:**

   - **Escenario A — Fallo en Validación Mecánica o Runner del Proyecto:**
     - Si el validador mecánico (`scripts/validate-db-migrations.js`) devuelve `exit 1` o falla el comando nativo del proyecto (`validation_cmd`), **NO se invoca a `db-qa-agent`** para evitar consumo innecesario de contexto sobre código defectuoso.
     - Se informa el fallo en chat y se re-despacha automáticamente a la fase Apply correspondiente (Paso 3 para DDL o Paso 4 para RLS) con el log de errores para corregir el código.
     - Tras la corrección, se re-ejecuta el Paso 5.

   - **Escenario B — Dictamen `[OBSERVADO CON CORRECCIONES REQUERIDAS]` en QA:**
     - Si `db-qa-agent` detecta *Drift*, fallos en la ejecución de tests DB-TDD o problemas de rendimiento:
     - Se presenta el resumen de observaciones en el chat:
       ```text
       ⚠️ Auditoría de Calidad OBSERVADA (Correcciones Requeridas):
       - Reporte: [qa-report.md](file:///<ruta>/database/reports/<change-name>-qa-report.md)
       - Veredicto: [OBSERVADO CON CORRECCIONES REQUERIDAS]
       - Hallazgos críticos: <lista de fallos de tests o discrepancias de drift>
       - Invariante TDD: Los tests DB-TDD se mantienen inmutables (se corrige el código SQL para satisfacer la spec).
       
       ¿Autorizas re-despachar a desarrollo/seguridad para aplicar las correcciones sobre la implementación?
       ```
     - 🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO**
     - Tras la aprobación del usuario, se re-invoca a `db-developer-agent` (Paso 3) y/o `db-security-agent` (Paso 4) entregándoles los hallazgos de `qa-report.md`. **Los tests NO se tocan**, se corrige el código SQL hasta que la suite pase limpiamente.

   - **Escenario C — Dictamen `[APROBADO]`:**
     - Solo cuando la validación mecánica, el runner del proyecto y la auditoría de QA están 100% en verde:
       ```text
       📊 Auditoría de Calidad y DB-TDD completada (Verify):
       - Reporte: [qa-report.md](file:///<ruta>/database/reports/<change-name>-qa-report.md)
       - Veredicto: [APROBADO]
       - Validación mecánica universal: Superada (simetría, índices FK y RLS verificados)
       - Validador nativo del proyecto: <Superado / Omitido si no existe>
       - Cobertura de Requisitos: 100% de escenarios Given/When/Then verificados
       - Drift Check: 100% concordancia con spec.md y design.md
       
       ¿Confirmas la entrega para que el Orquestador archive el cambio en OpenSpec y realice el commit?
       ```
     - 🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO**

---

### Paso 6 — Handoff al Orquestador (Archive y Commit)

1. Emitir la señal hacia el orquestador principal:
   ```text
   [LISTO PARA COMMIT Y ARCHIVE] database/ openspec/changes/<change-name>/
   ```
2. El orquestador principal tomará el control para ejecutar el archivado en OpenSpec (`openspec archive <change-name>`), el cual:
   - Consolida automáticamente `openspec/changes/<change-name>/specs/` en las especificaciones maestras vivas de `openspec/specs/`.
   - Mueve la carpeta del cambio a `openspec/changes/archive/`.
   - Realiza el `git commit` atómico de la entrega.
