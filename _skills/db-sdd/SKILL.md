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
inputs:
  - Ticket técnico de base de datos (US-XX-TN o issue de GitHub)
  - docs/prd/*.md (opcional, contexto de dominio existente)
  - docs/backlog/**/us-*.md (opcional, historias asociadas)
  - database/migrations/ (opcional, migraciones previas para brownfield)
  - openspec/config.yaml (configuración SDD del proyecto)
outputs:
  - openspec/changes/<change-name>/proposal.md
  - openspec/changes/<change-name>/design.md
  - openspec/changes/<change-name>/tasks.md
  - database/schemas/<change-name>-erd.md
  - database/tests/<change-name>-test.sql
  - database/migrations/<timestamp>_<change-name>.up.sql
  - database/migrations/<timestamp>_<change-name>.down.sql
  - database/security/<timestamp>_security_rls.sql
  - database/seeds/<timestamp>_seeds.sql
  - database/reports/<change-name>-qa-report.md
commits:
  - "El orquestador (nunca este skill ni sus subagentes) hace todos los commits, siempre tras confirmación explícita del usuario."
---

# db-sdd

Skill especializado en el desarrollo e implementación de bases de datos mediante **Specification-Driven Development (SDD / OpenSpec)** y **DB-TDD (Database Test-Driven Development)** dentro del ecosistema `it-project-orchestrator`.

---

## 🎯 OBJETIVO Y FILOSOFÍA

1. **Exploración Previa y Non-Goals (`proposal.md`):** Todo cambio parte de la inspección del esquema actual para delimitar estrictamente el alcance y prevenir breaking changes.
2. **Apply-Ready en un Solo Hito (`proposal.md` + `design.md` + `tasks.md`):** `db-architect-agent` entrega el paquete completo de propuesta, modelo físico y desglose de tareas atómicas para aprobación humana en un solo punto de control.
3. **DB-TDD (Database Test-Driven Development):** Se generan los casos de prueba de fallo esperado (`database/tests/<change-name>-test.sql`) para constraints, integridad referencial y aislamiento RLS antes de dar por cerrada la implementación.
4. **Reportes Atómicos Versionados:** Cada cambio cuenta con su propio reporte inmutable en `database/reports/<change-name>-qa-report.md`.
5. **Gobernanza de Cierre (`Archive` y `Commit`):** La skill entrega el cambio verificado al Orquestador principal, quien ejecuta el archivado en OpenSpec y el commit en Git.

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
2. Invocar a `db-architect-agent` entregando el ticket y el contexto de dominio.
3. El agente genera el paquete completo de concepción técnica:
   - `proposal.md`: Why, What, Non-goals y análisis de riesgos.
   - `design.md`: ERD Mermaid (alto contraste), diccionario físico, tipos, constraints y RLS.
   - `tasks.md`: Lista de tareas atómicas ordenadas topológicamente.
4. Persistir los artefactos en disco:
   - `openspec/changes/<change-name>/proposal.md`
   - `openspec/changes/<change-name>/design.md`
   - `openspec/changes/<change-name>/tasks.md`
   - `database/schemas/<change-name>-erd.md`
5. Presentar en chat el **resumen ejecutivo** de la propuesta y diseño con sus enlaces:

```text
📐 Paquete de Propuesta y Diseño preparado (OpenSpec):
- Propuesta: [proposal.md](file:///<ruta>/openspec/changes/<change-name>/proposal.md)
- Modelo y Diccionario: [design.md](file:///<ruta>/openspec/changes/<change-name>/design.md)
- Diagrama ERD: [erd.md](file:///<ruta>/database/schemas/<change-name>-erd.md)
- Plan de Tareas: [tasks.md](file:///<ruta>/openspec/changes/<change-name>/tasks.md)

¿Apruebas este diseño y plan de tareas para avanzar a la suite DB-TDD e implementación?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 2 — Suite DB-TDD (Red Phase)

1. Invocar a `db-qa-agent` (Fase A) entregando `design.md` y criterios del ticket.
2. El agente genera la suite de pruebas unitarias/estructurales:
   - Aserciones de constraints (`NOT NULL`, `CHECK`, `UNIQUE`).
   - Pruebas negativas de claves foráneas.
   - Pruebas de penetración de políticas RLS (aislamiento entre tenants).
3. Persistir el script de pruebas en disco:
   - `database/tests/<change-name>-test.sql`
4. Notificar al usuario con enlace al test y solicitar paso a la implementación:

```text
🧪 Suite DB-TDD preparada:
- Archivo de pruebas: [test.sql](file:///<ruta>/database/tests/<change-name>-test.sql)
- Cobertura: Restricciones de integridad, unicidad y aislamiento RLS.

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
3. **Auditoría Adversarial:**
   - Invocar a `db-qa-agent` (Fase B) entregando:
     - `design.md` vs código SQL generado.
     - Suite `database/tests/<change-name>-test.sql`.
     - Salida de la validación mecánica y del runner del proyecto.
   - El agente ejecuta el *Drift Check*, simulación de planes `EXPLAIN` y negative testing de RLS.
4. Persistir el reporte de calidad atómico:
   - `database/reports/<change-name>-qa-report.md`
5. Presentar el veredicto en chat:

```text
📊 Auditoría de Calidad y DB-TDD completada (Verify):
- Reporte: [qa-report.md](file:///<ruta>/database/reports/<change-name>-qa-report.md)
- Veredicto: [APROBADO]
- Validación mecánica universal: Superada (simetría, índices FK y RLS verificados)
- Validador nativo del proyecto: <Superado / Omitido si no existe>
- Drift Check: 100% concordancia con el modelo

¿Confirmas la entrega para que el Orquestador archive el cambio en OpenSpec y realice el commit?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 6 — Handoff al Orquestador (Archive y Commit)

1. Emitir la señal hacia el orquestador principal:
   ```text
   [LISTO PARA COMMIT Y ARCHIVE] database/ openspec/changes/<change-name>/
   ```
2. El orquestador principal tomará el control para ejecutar el archivado en OpenSpec (`openspec archive <change-name>`) y realizar el `git commit`.
