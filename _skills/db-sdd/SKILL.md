---
name: db-sdd
version: 0.1.0
description: Ciclo de desarrollo de base de datos guiado por especificaciones (SDD / OpenSpec) coordinando exploración, DB-TDD, equipo multi-agente y validaciones mecánicas deterministas.
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

1. **Límite Estricto de Fin de Turno (Hard Turn Boundary):** Toda pausa `**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**` marca el fin absoluto de tu turno de respuesta.
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

### Paso 0 — Verificación de Pre-condiciones (Input Gate)

1. **Input Gate — Verificación de Pre-condiciones (§7.3.3):**
   - **Pre-condición A (OpenSpec Config):**
     - Si `tiene_repositorio = true`, verificar la existencia de `openspec/config.yaml` en el proyecto destino.
     - Si `openspec/config.yaml` **NO existe en disco**:
       ```text
       ❌ [INPUT GATE]: El entorno de Specification-Driven Development (OpenSpec) no está inicializado en este repositorio (falta 'openspec/config.yaml').
       Debes ejecutar primero el skill '_skills/sdd-init/SKILL.md' (o la opción [4] del orquestador) para configurar OpenSpec antes de iniciar el ciclo de base de datos.
       ```
       **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí e instruye al usuario a inicializar SDD primero.
   - **Pre-condición B (Ticket Técnico de BD):**
     - Verificar que el usuario haya indicado o seleccionado un ticket técnico de base de datos (`capa:db`) con ID, título o criterios de aceptación.
     - Si no se indicó ningún ticket:
       ```text
       ❓ [INPUT GATE]: No se ha especificado un ticket técnico para el desarrollo de base de datos.
       Por favor, indica el ID del ticket (ej. US-03-T1 o issue #17) o describe el requerimiento de base de datos a desarrollar.
       ```
       **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera a que el usuario provea el requerimiento.

2. **Handoff Inmediato al Paso 1:**
   - Cumplidas las pre-condiciones, definir el identificador del cambio `<change-name>` en `kebab-case` (ej. `0017-crear-esquema-usuarios` o `<ticket_id>-db`).
   - El orquestador **NO realiza pausas ni exploraciones técnicas redundantes**: avanza inmediatamente al Paso 1 delegando la exploración de base de datos y diseño a `db-architect-agent`.

---

### Paso 1 — Exploración del Repositorio, Propuesta y Tareas (OpenSpec Propose)

1. Inicializar formalmente el cambio en el framework OpenSpec:
   ```bash
   openspec new change "<change-name>"
   ```
   Esto crea el directorio `openspec/changes/<change-name>/` con su archivo de metadatos `.openspec.yaml`.
2. Consultar las instrucciones y plantillas oficiales del framework OpenSpec:
   - `openspec instructions proposal --change "<change-name>" --json`
   - `openspec instructions specs --change "<change-name>" --json`
   - `openspec instructions design --change "<change-name>" --json`
   - `openspec instructions tasks --change "<change-name>" --json`
3. Invocar a `db-architect-agent` entregando el ticket técnico y las plantillas oficiales de OpenSpec.
4. `db-architect-agent` asume la exploración técnica del repositorio y la concepción arquitectónica:
   - **Exploración del Entorno:** Detecta el motor de BD (`engine`), directorio de migraciones (`migrations_dir`), modo de migración (`symmetric` vs `forward-only`), estrategia de seguridad (`rls_mode`), seeds requeridos y runner de tests (`Makefile` / `test_cmd`).
   - **Redacción y Persistencia Directa:** Escribe directamente en disco los 4 artefactos de OpenSpec:
     - `openspec/changes/<change-name>/proposal.md`: Why, What, Non-goals y análisis de riesgos.
     - `openspec/changes/<change-name>/specs/<capability>/spec.md`: Requisitos formales de datos y escenarios Given/When/Then.
     - `openspec/changes/<change-name>/design.md`: Documentando las convenciones detectadas, ERD Mermaid del cambio (alto contraste), diccionario físico, tipos, constraints e índices.
     - `openspec/changes/<change-name>/tasks.md`: Lista de tareas atómicas ordenadas topológicamente.
     - **ERD Consolidado (`database/schemas/erd.md`):** Actualizado directamente **únicamente si el cambio crea nuevas tablas o altera relaciones (FKs)**. Para índices, triggers o alteraciones de columnas, no se modifica `erd.md`.
5. Validar formalmente el cambio con el CLI de OpenSpec:
   ```bash
   openspec validate "<change-name>"
   ```
6. Presentar en chat el **resumen ejecutivo unificado** de la propuesta, convenciones y diseño para validación humana (primera y única pausa antes de DB-TDD):

```text
📐 Paquete de Propuesta, Convenciones y Diseño preparado (OpenSpec Propose):
- Ticket: <ID o título>
- Convenciones detectadas: Motor <engine>, Migraciones <migrations_dir> (<modo>), RLS: <rls_mode>
- Propuesta: [proposal.md](file:///<ruta>/openspec/changes/<change-name>/proposal.md)
- Especificación: [spec.md](file:///<ruta>/openspec/changes/<change-name>/specs/<capability>/spec.md)
- Modelo y Diccionario: [design.md](file:///<ruta>/openspec/changes/<change-name>/design.md)
- ERD Consolidado: [erd.md](file:///<ruta>/database/schemas/erd.md) (si fue actualizado)
- Plan de Tareas: [tasks.md](file:///<ruta>/openspec/changes/<change-name>/tasks.md)

¿Apruebas esta especificación, diseño y plan de tareas para avanzar a la suite DB-TDD e implementación?
```

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

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

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

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

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

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

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 5 — Validación Mecánica y Verificación en VERDE (OpenSpec Verify: QA)

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
3. **Gate de Validación Mecánica:**
   - **Si el validador mecánico devuelve `exit 1` o falla `validation_cmd`:** **NO se invoca a `db-qa-agent`** para evitar consumo innecesario de contexto sobre código defectuoso. Se informa el fallo en chat y se re-despacha a la fase Apply correspondiente (Paso 3 para DDL o Paso 4 para RLS) para corregir el código SQL.
4. **Verificación en VERDE y Auditoría Adversarial con `db-qa-agent` (un solo subagente en este turno, §7.5.2):**
   - Si la validación mecánica pasó en verde, invocar únicamente a `db-qa-agent` (Fase B):
     - Ejecuta `make test-db` (o `test_cmd`) mediante `Bash` y comprueba que **todos los tests pasen exitosamente a VERDE** contra el DDL y RLS implementados.
     - Realiza el *Drift Check* estricto (`spec.md` y `design.md` vs código SQL generado).
     - Escribe directamente `database/reports/<change-name>-qa-report.md`.
5. **Evaluación del Dictamen de QA y Bifurcación:**

   - **Escenario A — Dictamen `[OBSERVADO CON CORRECCIONES REQUERIDAS]` en QA:**
     - Si `db-qa-agent` detecta *Drift*, fallos en la ejecución de tests DB-TDD o problemas de rendimiento:
       ```text
       ⚠️ Auditoría de Calidad OBSERVADA (Correcciones Requeridas):
       - Reporte: [qa-report.md](file:///<ruta>/database/reports/<change-name>-qa-report.md)
       - Veredicto: [OBSERVADO CON CORRECCIONES REQUERIDAS]
       - Hallazgos críticos: <lista de fallos de tests o discrepancias de drift>
       - Invariante TDD: Los tests DB-TDD no se relajan ante fallos de implementación (se corrige el código SQL para satisfacer la spec).
       
       ¿Autorizas re-despachar a desarrollo/seguridad para aplicar las correcciones sobre la implementación?
       ```
     - **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.
     - Tras la aprobación del usuario, se re-invoca a `db-developer-agent` (Paso 3) y/o `db-security-agent` (Paso 4) entregándoles los hallazgos de `qa-report.md`. Se corrige el código SQL y se re-ejecuta el Paso 5.

   - **Escenario B — Dictamen `[APROBADO]` en QA:**
     - Cuando la validación mecánica, el runner del proyecto y la auditoría de `db-qa-agent` están 100% en verde:
       ```text
       📊 Auditoría de Calidad y DB-TDD en VERDE completada:
       - Reporte QA: [qa-report.md](file:///<ruta>/database/reports/<change-name>-qa-report.md)
       - Veredicto QA: [APROBADO]
       - Validación mecánica universal: Superada (simetría, índices FK y RLS verificados)
       - Cobertura de Requisitos: 100% de escenarios Given/When/Then en VERDE
       - Drift Check: 100% concordancia con spec.md y design.md
       
       ¿Procedemos al Paso 6 (Mutation Testing de falsabilidad de tests / validación final de OpenSpec)?
       ```
     - **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 6 — Pruebas de Mutación Condicionales y Falsabilidad (OpenSpec Verify: Mutation)

> [!NOTE] Gate Condicional de Mutation Testing
> - **Activación:** Se ejecuta únicamente si el cambio introduce restricciones de integridad (`UNIQUE`, `CHECK`, FKs) o políticas RLS.
> - **Exención:** Si el cambio es puramente de índices, vistas o rendimiento sin constraints ni políticas falsables, se documenta la exención, se ejecuta `openspec validate "<change-name>"` y se avanza al Paso 7.

1. Si el gate condicional está activo, invocar únicamente a `db-mutation-tester` (§7.5.2):
   - Evalúa la falsabilidad de `database/tests/<change-name>-test.sql` frente al catálogo de mutantes canónicos (M1 a M5) en transacciones efímeras sin dejar mutaciones persistidas en los archivos `.sql`.
   - Escribe directamente `database/reports/<change-name>-mutation-report.md`.
2. Ejecutar la validación formal del framework OpenSpec:
   ```bash
   openspec validate "<change-name>"
   ```
3. **Evaluación de Falsabilidad y Bifurcación:**

   - **Escenario A — `[TESTS COMPLACIENTES DETECTADOS]` (Mutantes Sobrevivientes):**
     - Si algún mutante sobrevive (falso positivo por aserción tautológica o excepción genérica enmascarada):
       ```text
       🧟 Mutation Testing detectó Tests Complacientes:
       - Reporte de Mutación: [mutation-report.md](file:///<ruta>/database/reports/<change-name>-mutation-report.md)
       - Estado: [TESTS COMPLACIENTES DETECTADOS]
       - Mutantes sobrevivientes: <lista de mutantes M1..M5 no atrapados>
       
       ¿Autorizas re-despachar a db-qa-agent para blindar las aserciones complacientes indicadas?
       ```
     - **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.
     - Tras la aprobación del usuario, se re-invoca a `db-qa-agent` (exclusivamente para reforzar y hacer falsables las aserciones señaladas en `mutation-report.md`, nunca para relajar requisitos de la `spec.md`) y se re-verifica el paso.

   - **Escenario B — `[TESTS BLINDADOS]` (100% Mutantes Abatidos o Exención Aplicada):**
     - Presentar el resumen final de verificación y solicitar confirmación para el cierre:
       ```text
       🔬 Verificación de Falsabilidad y OpenSpec Completada:
       - Reporte de Mutación: [mutation-report.md](file:///<ruta>/database/reports/<change-name>-mutation-report.md) (o exención documentada)
       - Estado de Falsabilidad: [TESTS BLINDADOS]
       - Validación OpenSpec CLI: Superada (openspec validate "<change-name>")
       
       ¿Confirmas la entrega para que el Orquestador archive el cambio en OpenSpec y realice el commit?
       ```
     - **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 7 — Handoff al Orquestador (Archive y Commit)

1. Emitir la señal hacia el orquestador principal:
   ```text
   [LISTO PARA COMMIT Y ARCHIVE] database/ openspec/changes/<change-name>/
   ```
2. El orquestador principal tomará el control para ejecutar el archivado en OpenSpec (`openspec archive <change-name>`), el cual:
   - Consolida automáticamente `openspec/changes/<change-name>/specs/` en las especificaciones maestras vivas de `openspec/specs/`.
   - Mueve la carpeta del cambio a `openspec/changes/archive/`.
   - Realiza el `git commit` atómico de la entrega.
