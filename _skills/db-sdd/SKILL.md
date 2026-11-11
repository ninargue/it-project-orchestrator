---
name: db-sdd
version: 0.1.0
description: Ciclo de desarrollo de base de datos guiado por especificaciones (SDD / OpenSpec) coordinando exploración, DB-TDD, equipo multi-agente y validaciones mecánicas deterministas.
trigger: "cuando el usuario seleccione desarrollar un ticket de base de datos (capa:db) o diseñar/implementar esquemas y migraciones de BD"
tools_required:
  - Read
  - Write
  - AskUserQuestion
  - bash (PowerShell para scripts de validación mecánica)
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
  - database/schemas/<change-name>-erd.md
  - database/tests/<change-name>-test.sql
  - database/migrations/<timestamp>_<change-name>.up.sql
  - database/migrations/<timestamp>_<change-name>.down.sql
  - database/security/<timestamp>_security_rls.sql
  - database/seeds/<timestamp>_seeds.sql
  - database/reports/<change-name>-mutation-report.md
  - database/reports/<change-name>-qa-report.md
commits:
  - "El orquestador (nunca este skill ni sus subagentes) hace todos los commits, siempre tras confirmación explícita del usuario."
---

# db-sdd

Skill especializado en el desarrollo e implementación de bases de datos mediante **Specification-Driven Development (SDD / OpenSpec)** y **DB-TDD (Database Test-Driven Development)** dentro del ecosistema `it-project-orchestrator`.

---

## 🎯 OBJETIVO Y FILOSOFÍA

1. **Exploración Previa y Non-Goals (`proposal.md`):** Todo cambio parte de la inspección del esquema actual para delimitar estrictamente el alcance y prevenir breaking changes.
2. **Apply-Ready en un Solo Hito (`proposal.md` + `specs/` + `design.md` + `tasks.md`):** `db-architect-agent` entrega el paquete completo de propuesta, especificación formal con escenarios Given/When/Then, modelo físico y desglose de tareas atómicas para aprobación humana en un solo punto de control.
3. **DB-TDD Guiado por Especificaciones (Spec-Driven TDD):** Los casos de prueba (`database/tests/<change-name>-test.sql`) se derivan directamente de los requisitos y escenarios Given/When/Then de la `spec.md` antes de implementar el código DDL. Si los tests fallan en Verify, se retroalimenta y corrige el desarrollo, nunca los tests.
4. **Reportes Atómicos Versionados:** Cada cambio cuenta con su propio reporte inmutable en `database/reports/<change-name>-qa-report.md`.
5. **Gobernanza de Cierre (`Archive` y `Commit`):** La skill entrega el cambio verificado al Orquestador principal, quien ejecuta el archivado en OpenSpec (consolidando `spec.md` en `openspec/specs/`) y el commit en Git.

---

## 👣 PROCEDIMIENTO PASO A PASO

### Paso 0 — Identificación del Ticket, Exploración del Repositorio y Parámetros

1. Obtener los datos del ticket técnico (`capa:db`):
   - ID del ticket (ej. `US-03-T1` o issue #17), título y criterios de aceptación.
2. Explorar activamente el repositorio destino para detectar su configuración y arquitectura:
   - **Motor de BD (`engine`)**: Inspeccionar archivos de configuración (`supabase/config.toml`, `prisma/schema.prisma`, `docker-compose.yml`, `package.json`, `.env.example`, `docs/tech-briefing.md` u `openspec/config.yaml`). Por defecto: `postgres`.
   - **Directorio de migraciones (`migrations_dir`)**: Detectar si existe `supabase/migrations`, `database/migrations`, `src/database/migrations`, `prisma/migrations`, `db/migrations`, `migrations`, etc. Si no existe aún, proponer la convención adecuada según el motor/stack detectado.
   - **Convención de seguridad (`security_dir`)**: Detectar si el proyecto tiene un directorio dedicado de políticas (`supabase/security`, `database/security`, `security/`, `policies/`) o si las políticas RLS y DCL se gestionan *in-situ* dentro de las propias migraciones.
   - **Comandos de Validación Estándar del Proyecto (`validation_cmd`)**: Inspeccionar si el proyecto ya cuenta con tareas o scripts estándar para validación, linting o testing de base de datos en `package.json` (`npm run db:validate`, `npm run db:lint`), `Makefile` (`make db-validate`, `make test-db`), `pyproject.toml` (`uv run db-validate`, `poetry run ...`) o CLIs del stack (`supabase db lint`, `atlas migrate validate`, `sqlfluff lint`). Si se detecta alguno, registrarlo para ejecutarlo de forma complementaria en la fase de verificación.
3. Definir el identificador único del cambio en `kebab-case`: `<change-name>` (ej. `0017-crear-esquema-usuarios`, o `<ticket_id>-db` si forma parte de un ticket multi-capa).

```text
💡 Iniciando ciclo SDD de Base de Datos:
- Ticket: <ID o título>
- Motor de BD: <engine detectado o configurado>
- Directorio de migraciones: <migrations_dir detectado>
- Directorio de seguridad/RLS: <security_dir detectado o 'in-situ'>
- Comando de validación del proyecto: <validation_cmd detectado o 'ninguno (usar validador nativo)'>
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
5. El agente genera el paquete completo rellenando las plantillas oficiales de OpenSpec:
   - `proposal.md`: Why, What, Non-goals y análisis de riesgos.
   - `specs/<capability>/spec.md`: Requisitos formales de datos y escenarios Given/When/Then.
   - `design.md`: ERD Mermaid (alto contraste), diccionario físico, tipos, constraints e índices.
   - `tasks.md`: Lista de tareas atómicas ordenadas topológicamente.
6. Persistir los artefactos en disco:
   - `openspec/changes/<change-name>/proposal.md`
   - `openspec/changes/<change-name>/specs/<capability>/spec.md`
   - `openspec/changes/<change-name>/design.md`
   - `openspec/changes/<change-name>/tasks.md`
   - `database/schemas/<change-name>-erd.md`
7. Validar formalmente el cambio con el CLI de OpenSpec:
   ```bash
   openspec validate "<change-name>"
   ```
8. Presentar en chat el **resumen ejecutivo** de la propuesta y diseño con sus enlaces:

```text
📐 Paquete de Propuesta y Especificación preparado (OpenSpec):
- Propuesta: [proposal.md](file:///<ruta>/openspec/changes/<change-name>/proposal.md)
- Especificación: [spec.md](file:///<ruta>/openspec/changes/<change-name>/specs/<capability>/spec.md)
- Modelo y Diccionario: [design.md](file:///<ruta>/openspec/changes/<change-name>/design.md)
- Diagrama ERD: [erd.md](file:///<ruta>/database/schemas/<change-name>-erd.md)
- Plan de Tareas: [tasks.md](file:///<ruta>/openspec/changes/<change-name>/tasks.md)

¿Apruebas esta especificación, diseño y plan de tareas para avanzar a la suite DB-TDD e implementación?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 2 — Suite DB-TDD (Red Phase)

1. Invocar a `db-qa-agent` (Fase A) entregando:
   - `specs/<capability>/spec.md` (fuente de verdad funcional con requisitos y escenarios Given/When/Then).
   - `design.md` (modelo físico para tipos y nombres de columnas).
   - Motor de BD (`engine`) y herramientas de prueba detectadas en el repositorio.
2. El agente deriva la suite de pruebas unitarias/estructurales directamente de la especificación:
   - Mapeo 1:1 de escenarios Given/When/Then en aserciones ejecutables.
   - Casos negativos estructurados para constraints (`NOT NULL`, `CHECK`, `UNIQUE`) y foreign keys sin romper el runner.
   - Pruebas de aislamiento de políticas RLS y privilegios DCL.
3. Persistir el script de pruebas en disco:
   - `database/tests/<change-name>-test.sql` (o formato de runner detectado)
4. Notificar al usuario con enlace al test y solicitar paso a la implementación:

```text
🧪 Suite DB-TDD preparada a partir de spec.md:
- Archivo de pruebas: [test.sql](file:///<ruta>/database/tests/<change-name>-test.sql)
- Cobertura: 100% de escenarios Given/When/Then especificados (integridad, unicidad y aislamiento RLS).

¿Procedemos a ejecutar la fase Apply para generar el código DDL y las migraciones?
```

¿Procedemos a ejecutar la fase Apply para generar el código DDL y las migraciones?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 3 — Implementación DDL y Migraciones (OpenSpec Apply: DDL)

1. Invocar a `db-developer-agent` para ejecutar las tareas DDL de `tasks.md`:
   - Migración UP: `<timestamp>_<change-name>.up.sql`
   - Migración DOWN: `<timestamp>_<change-name>.down.sql` (o archivo unificado `.sql` si el motor/framework del proyecto no utiliza pares simétricos).
   - Mock Data / Fixtures: `<timestamp>_seeds.sql`
2. Persistir los scripts en disco en la ruta detectada en el Paso 0:
   - `<migrations_dir>/<timestamp>_<change-name>.up.sql`
   - `<migrations_dir>/<timestamp>_<change-name>.down.sql`
   - `<migrations_dir>/../seeds/<timestamp>_seeds.sql` (o `database/seeds/`)
3. Presentar resumen ejecutivo en chat:

```text
🛠️ Scripts DDL y migraciones generados (Fase Apply: DDL):
- Migración UP: [up.sql](file:///<ruta>/<migrations_dir>/<timestamp>_<change-name>.up.sql)
- Rollback DOWN: [down.sql](file:///<ruta>/<migrations_dir>/<timestamp>_<change-name>.down.sql)
- Datos sintéticos: [seeds.sql](file:///<ruta>/<seeds_dir>/<timestamp>_seeds.sql)

¿Validás el DDL generado para proceder con el diseño de políticas de seguridad y RLS?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 4 — Seguridad, RLS y Control de Acceso (OpenSpec Apply: Security)

1. Invocar a `db-security-agent` entregando:
   - `design.md` (especificación de PII y multi-tenancy).
   - Scripts DDL generados y validados en el Paso 3.
2. El agente genera:
   - Políticas RLS e índices de aceleración de seguridad: `<timestamp>_security_rls.sql`
   - Control de acceso DCL (roles, usuarios y grants de mínimo privilegio).
3. Persistir los scripts en disco según la convención del proyecto:
   - **Directorio dedicado (`security_dir`):** `<security_dir>/<timestamp>_security_rls.sql` (ej. `database/security/`, `supabase/security/`, `security/`).
   - **Convención *in-situ*:** `<migrations_dir>/<timestamp>_security_rls.sql` o incorporado directamente en la migración DDL.
4. Presentar resumen ejecutivo en chat:

```text
🔒 Políticas de Seguridad y RLS generadas (Fase Apply: Security):
- Script RLS: [security_rls.sql](file:///<ruta>/<security_dir_o_migraciones>/<timestamp>_security_rls.sql)
- Tablas protegidas: <lista_de_tablas_con_RLS>
- Control de acceso: Roles DCL y grants de mínimo privilegio aplicados.

¿Procedemos a ejecutar la validación mecánica determinista y la auditoría adversarial de QA?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 5 — Validación Mecánica y Auditoría Adversarial (OpenSpec Verify)

1. **Validación Mecánica Determinista Multiplataforma (Node.js):**
   - Ejecutar el validador universal en Node.js (compatible de forma nativa con **Linux, macOS y Windows** sin dependencias externas ni herramientas adicionales), pasando los parámetros explorados y confirmados en el Paso 0:
     ```bash
     node "<plugin-root>/scripts/validate-db-migrations.js" --migrations-dir "<repo-destino>/<migrations_dir>" --security-dir "<repo-destino>/<security_dir>" --engine "<engine>"
     ```
   - *Nota:* Si el proyecto no tiene una carpeta de seguridad separada (`security_dir = 'in-situ'`), el validador inspecciona automáticamente las políticas RLS y DCL dentro de los propios archivos de migración.
2. **Ejecución de Validadores Estándar del Proyecto (si fueron detectados en Paso 0):**
   - Si el proyecto destino cuenta con comandos o runners propios para base de datos (`validation_cmd`), ejecutarlos complementariamente para respetar el estándar nativo del equipo:
     - En Node/TS: `npm run db:validate` o `pnpm / yarn db:lint`
     - En Python: `uv run db-validate` o `poetry run ...`
     - En proyectos con Makefile: `make db-validate` o `make test-db`
     - En stacks específicos: `supabase db lint`, `atlas migrate validate`, `sqlfluff lint`
   - Ambas validaciones (la mecánica universal y la del runner del proyecto) deben finalizar con éxito antes de pasar a la auditoría adversarial.
3. **Pruebas de Mutación y Falsabilidad (Mutation Testing):**
   - Invocar a `db-mutation-tester` entregando:
     - Suite `database/tests/<change-name>-test.sql`.
     - `specs/<capability>/spec.md` y `design.md`.
     - Scripts DDL y de seguridad generados en la fase Apply.
   - El agente somete la suite a la batería de mutaciones destructivas (M1 a M5) para comprobar que los tests no sean tautologías ni tengan falsos positivos.
   - Persistir el reporte de mutación: `database/reports/<change-name>-mutation-report.md`.
   - Si se detectan mutantes vivos (tests complacientes): se devuelve la suite a `db-qa-agent` para blindar las aserciones antes de continuar.
4. **Auditoría Adversarial y Drift Check:**
   - Una vez comprobada la falsabilidad de la suite, invocar a `db-qa-agent` (Fase B) entregando:
     - `specs/<capability>/spec.md` (fuente de verdad de requisitos y escenarios Given/When/Then).
     - `design.md` vs código SQL generado.
     - Suite `database/tests/<change-name>-test.sql` y reporte de mutación.
     - Salida de la validación mecánica y del runner del proyecto.
   - El agente ejecuta el *Drift Check*, simulación de planes `EXPLAIN`, verificación de suite DB-TDD y negative testing de RLS.
5. **Validación Formal OpenSpec:**
   - Ejecutar la validación del framework para confirmar que el change cumple todas las reglas:
     ```bash
     openspec validate "<change-name>"
     ```
6. **Persistencia del Reporte Atómico de QA:**
   - `database/reports/<change-name>-qa-report.md`
7. **Evaluación de Resultados y Bifurcación:**

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
