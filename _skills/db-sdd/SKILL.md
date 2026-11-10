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

### Paso 0 — Identificación del Ticket y Parámetros

1. Obtener los datos del ticket técnico (`capa:db`):
   - ID del ticket (ej. `US-03-T1` o issue #17), título y criterios de aceptación.
2. Detectar el motor de base de datos desde `docs/tech-briefing.md`, `openspec/config.yaml` o preguntar al usuario (por defecto: `PostgreSQL`).
3. Definir el identificador único del cambio en `kebab-case`: `<change-name>` (ej. `0017-crear-esquema-usuarios`).

```text
💡 Iniciando ciclo SDD de Base de Datos:
- Ticket: <ID o título>
- Motor de BD: <Motor>
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

¿Procedemos a ejecutar la fase Apply (código SQL de migraciones, RLS y seeds)?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 3 — Implementación SQL y Seguridad (OpenSpec Apply / Green Phase)

1. Invocar a `db-developer-agent` para ejecutar las tareas de `tasks.md`:
   - Migración UP: `<timestamp>_<change-name>.up.sql`
   - Migración DOWN: `<timestamp>_<change-name>.down.sql`
   - Mock Data / Fixtures: `<timestamp>_seeds.sql`
2. Invocar a `db-security-agent` para generar:
   - Políticas RLS e índices de aceleración de seguridad: `<timestamp>_security_rls.sql`
   - Control de acceso DCL (roles y grants mínimos).
3. Persistir los scripts en disco:
   - `database/migrations/<timestamp>_<change-name>.up.sql`
   - `database/migrations/<timestamp>_<change-name>.down.sql`
   - `database/security/<timestamp>_security_rls.sql`
   - `database/seeds/<timestamp>_seeds.sql`
4. Presentar resumen ejecutivo en chat:

```text
🛠️ Scripts SQL implementados (Fase Apply):
- Migración UP: [up.sql](file:///<ruta>/database/migrations/<timestamp>_<change-name>.up.sql)
- Rollback DOWN: [down.sql](file:///<ruta>/database/migrations/<timestamp>_<change-name>.down.sql)
- Seguridad RLS: [security_rls.sql](file:///<ruta>/database/security/<timestamp>_security_rls.sql)
- Datos sintéticos: [seeds.sql](file:///<ruta>/database/seeds/<timestamp>_seeds.sql)

¿Procedemos a ejecutar la validación mecánica y la auditoría adversarial de QA?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 4 — Validación Mecánica y Auditoría Adversarial (OpenSpec Verify)

1. **Validación Mecánica Determinista:**
   - Ejecutar el script:
     ```powershell
     powershell -ExecutionPolicy Bypass -File .\scripts\validate-db-migrations.ps1 -MigrationsDir "database/migrations"
     ```
2. **Auditoría Adversarial:**
   - Invocar a `db-qa-agent` (Fase B) entregando:
     - `design.md` vs código SQL generado.
     - Suite `database/tests/<change-name>-test.sql`.
     - Salida de la validación mecánica.
   - El agente ejecuta el *Drift Check*, simulación de planes `EXPLAIN` y negative testing de RLS.
3. Persistir el reporte de calidad atómico:
   - `database/reports/<change-name>-qa-report.md`
4. Presentar el veredicto en chat:

```text
📊 Auditoría de Calidad y DB-TDD completada (Verify):
- Reporte: [qa-report.md](file:///<ruta>/database/reports/<change-name>-qa-report.md)
- Veredicto: [APROBADO]
- Validación mecánica: Superada (simetría, índices FK y RLS verificados)
- Drift Check: 100% concordancia con el modelo

¿Confirmas la entrega para que el Orquestador archive el cambio en OpenSpec y realice el commit?
```

🛑 **FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 5 — Handoff al Orquestador (Archive y Commit)

1. Emitir la señal hacia el orquestador principal:
   ```text
   [LISTO PARA COMMIT Y ARCHIVE] database/ openspec/changes/<change-name>/
   ```
2. El orquestador principal tomará el control para ejecutar el archivado en OpenSpec (`openspec archive <change-name>`) y realizar el `git commit`.
