---
name: frontend-sdd
version: 0.1.0
description: Ciclo de desarrollo de la capa frontend guiado por especificaciones (SDD / OpenSpec) con Contract-First (o Frontend-Driven), Frontend-TDD Design-Blind, Gates 1-4 deterministas, opsx:verify post-auditoría y Mutation Testing.
trigger: "cuando el usuario seleccione desarrollar un ticket de frontend (capa:frontend) o implementar vistas, estado cliente, PWA/offline o integración UI contra OpenAPI"
tools_required:
  - Read
  - Write
  - Edit
  - AskUserQuestion
  - Bash
subagents:
  - frontend-architect-agent
  - frontend-qa-agent
  - frontend-ui-developer-agent
  - frontend-integrator-agent
  - frontend-auditor-agent
  - frontend-mutation-tester
inputs:
  - Ticket técnico de frontend (US-XX-TN o issue de GitHub)
  - openspec/config.yaml (configuración SDD del proyecto)
  - Contrato OpenAPI (<openapi_path>, obligatorio en contract-first)
  - docs/ui/*ui-spec*.json (opcional, generado por _skills/ui-discovery/)
  - .claude/commands/opsx/*.md (o .agent/workflows/opsx-*.md)
outputs:
  - openspec/changes/<change-name>/proposal.md
  - openspec/changes/<change-name>/specs/<capability>/spec.md
  - openspec/changes/<change-name>/design.md
  - openspec/changes/<change-name>/tasks.md
  - openspec/changes/<change-name>/.frontend-state.json
  - openspec/changes/<change-name>/verification-report.md
  - openspec/changes/<change-name>/mutation-report.md (si aplica lógica/interacción)
  - <tests_dir>/<modulo_o_entidad>... (tests organizados por dominio/módulo)
  - <frontend_dir>/** (componentes UI, hooks, stores, clientes API y Service Worker si aplica)
commits:
  - "El orquestador (nunca este skill ni sus subagentes) ejecuta opsx:archive / opsx:bulk-archive y hace todos los commits, siempre tras confirmación explícita del usuario."
---

# frontend-sdd

Skill especializado en el diseño e implementación de la **capa frontend** mediante **Specification-Driven Development (SDD / OpenSpec)**, **Contract-First (OpenAPI como SSOT)**, **Frontend-TDD Design-Blind**, **4 Gates Deterministas (`scripts/validate-frontend.js`)** y **Mutation Testing**.

---

## 🧭 VARIABLES DE SESIÓN HEREDADAS

| Variable | Valores | Uso en este skill |
|---|---|---|
| `idioma` | `español` / `inglés` | Idioma de artefactos y mensajes |
| `tiene_repositorio` | `true` (obligatorio) | Requiere repositorio/workspace local |
| `prefijo_avance` | ej: `0001`, `0002` | Prefijo numérico incremental |
| `sufijo` | ej: `pos-carrito` | Sufijo en kebab-case para `<change-name>` |
| `tipo_proyecto` | `greenfield` / `brownfield` | Contexto de exploración frontend |

---

## 📋 REGLAS GENERALES

1. **Límite Estricto de Fin de Turno y Un Subagente por Turno (`AGENTS.md` §7.5.2):** Toda pausa `**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**` detiene inmediatamente el turno. Nunca encadenes dos subagentes en el mismo turno.
2. **Integración Nativa con OpenSpec (`opsx:*`):** Los subagentes ejecutan `opsx:explore`, `opsx:propose`, `opsx:apply`, `opsx:verify` y el orquestador cierra con `opsx:archive` / `opsx:bulk-archive`.
3. **Tests Design-Blind por Dominio:** Los tests en `<tests_dir>` se organizan por dominio/módulo (nunca con IDs de ticket) y usan selectores semánticos/accesibles (`getByRole`, `getByLabelText`, `getByText`), nunca clases CSS.
4. **Inmutabilidad, `diff_history` y Triaje Estricto:** Ningún implementador ni QA puede editar OpenAPI/BD/Backend en Pasos 2–5. El estado (`openapi_hash`, `revision_count` máx. 3, `diff_history`) se persiste y valida en `openspec/changes/<change-name>/.frontend-state.json`. El triaje hacia `Tester` aplica **únicamente** ante errores de sintaxis del test o setup de MSW, nunca para relajar aserciones fallidas.
5. **Gobernanza de Git:** Ningún subagente ni skill ejecuta `git commit`.
6. **Selección de Modelo por Tier (`AGENTS.md` §7.4.4):** Al invocar subagentes con `invoke_subagent`, pasar `Model: "pro"` para `frontend-architect-agent` y `frontend-mutation-tester`, y `Model: "inherit"` para `frontend-qa-agent`, `frontend-ui-developer-agent`, `frontend-integrator-agent` y `frontend-auditor-agent`. En Claude Code el campo `model:` de `.claude/_agents/` aplica automáticamente.

---

## 👣 PROCEDIMIENTO PASO A PASO (8 Pasos: 0–7)

### Paso 0 — Input Gate, Modo de Contrato y Gate 1

1. Verificar pre-condiciones obligatorias: `tiene_repositorio = true`, existencia de `openspec/config.yaml` (si falta, detener e indicar `_skills/sdd-init/SKILL.md`) y ticket/requerimiento de frontend.
2. Si `contract_mode` no fue provisto explícitamente por el usuario, preguntar:
   ```text
   📄 ¿Con qué modo de contrato iniciamos este cambio frontend?
     [1] contract-first (por defecto — exige <openapi_path> validado en disco)
     [2] frontend-driven (propone <openapi_path> en el Paso 1 tras aprobación)
     [3] none (UI pura sin endpoints ni contrato OpenAPI)
   ```
   **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí hasta que el usuario confirme el modo y ruta de OpenAPI (si aplica).
3. Definir `<change-name>` (ej. `<ticket_id>-frontend` o `<prefijo_avance>-<sufijo>`) y ejecutar **Gate 1**:
   ```bash
   node "<plugin-root>/scripts/validate-frontend.js" --gate 1 --repo-root "<repo-destino>" --contract-mode "<contract_mode>" --openapi-path "<openapi_path>" --change-dir "openspec/changes/<change-name>"
   ```
   - Si en `contract-first` el Gate 1 falla por falta de OpenAPI, **detener** para evitar alucinación de contratos.
4. Avanzar al Paso 1.

---

### Paso 1 — Arquitectura y Propuesta vía `opsx:propose` (`frontend-architect-agent` + Gate 2)

1. Invocar a `frontend-architect-agent` con `<change-name>`, ticket, `contract_mode`, `<openapi_path>` y `ui-spec.json` (si existe).
2. `frontend-architect-agent` ejecuta `opsx:explore` y `opsx:propose` generando `proposal.md`, `specs/<capability>/spec.md`, `design.md` (convenciones detectadas, árbol de componentes, estado global, almacenamiento offline y presupuesto de bundle) y `tasks.md` (más `<openapi_path>` si `contract_mode = 'frontend-driven'`).
3. Ejecutar `openspec validate "<change-name>"` y **Gate 2**:
   ```bash
   node "<plugin-root>/scripts/validate-frontend.js" --gate 2 --repo-root "<repo-destino>" --change-dir "openspec/changes/<change-name>" --contract-mode "<contract_mode>" --openapi-path "<openapi_path>" --node architect
   ```
4. Presentar resumen ejecutivo con enlaces a los artefactos en `openspec/changes/<change-name>/` y preguntar si aprueba congelar la especificación y el contrato para pasar a TDD en Rojo.

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera confirmación explícita.

---

### Paso 2 — Suite Frontend-TDD Design-Blind en ROJO (`frontend-qa-agent` Fase A)

1. Invocar a `frontend-qa-agent` (Fase A) con `<change-name>`.
2. Crea/actualiza tests por dominio en `<tests_dir>` (lógica/estado + comportamiento UI *Design-Blind* + mocks MSW desde `<openapi_path>`) mapeando 1:1 los escenarios de `spec.md`, y confirma el fallo inicial en **🔴 ROJO** ejecutando `test_cmd`.
3. Registrar el snapshot inicial autorizado de tests en `.frontend-state.json` y notificar al usuario con enlaces a los archivos de test y confirmación de estado Rojo:
   ```bash
   node "<plugin-root>/scripts/validate-frontend.js" --gate none --snapshot-tests --repo-root "<repo-destino>" --change-dir "openspec/changes/<change-name>" --tests-dir "<tests_dir>" --node qa
   ```
   *(Este mismo comando `--snapshot-tests --node qa` debe ejecutarse tras cualquier actualización autorizada de `frontend-qa-agent` por triaje de sintaxis/MSW o refuerzo post-mutation testing).*

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera confirmación para iniciar la maquetación visual.

---

### Paso 3 — Maquetación Visual vía `opsx:apply` (`frontend-ui-developer-agent` + Gate 3 Visual)

1. Invocar a `frontend-ui-developer-agent` para implementar componentes puros/semánticos y tokens en `<frontend_dir>`.
2. Ejecutar **Gate 3 Visual**:
   ```bash
   node "<plugin-root>/scripts/validate-frontend.js" --gate 3 --repo-root "<repo-destino>" --change-dir "openspec/changes/<change-name>" --frontend-dir "<frontend_dir>" --openapi-path "<openapi_path>" --tests-dir "<tests_dir>" --protected-dirs "<tests_dir>,<openapi_path>,<db_dirs>,<backend_dir>" --lint-cmd "<lint_cmd>" --typecheck-cmd "<typecheck_cmd>" --node maquetador
   ```
   - Si falla (incluyendo `revision_count > 3` o regresión en `diff_history`), informar el log/escalamiento; si pasa, presentar resumen de componentes y preguntar si continúa al Paso 4 (Integración Lógica).

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera confirmación explícita.

---

### Paso 4 — Integración Lógica vía `opsx:apply` (`frontend-integrator-agent` + Gate 3 Integración)

1. Invocar a `frontend-integrator-agent` para conectar clientes API/mocks, estado global, sesión y colas offline, marcando sus tareas `[x]` en `tasks.md`.
2. Ejecutar **Gate 3 Integración** (incluyendo `--test-cmd` en verde y detección de `openapi_hash` / `diff_history`):
   ```bash
   node "<plugin-root>/scripts/validate-frontend.js" --gate 3 --repo-root "<repo-destino>" --change-dir "openspec/changes/<change-name>" --frontend-dir "<frontend_dir>" --openapi-path "<openapi_path>" --tests-dir "<tests_dir>" --protected-dirs "<tests_dir>,<openapi_path>,<db_dirs>,<backend_dir>" --lint-cmd "<lint_cmd>" --typecheck-cmd "<typecheck_cmd>" --build-dev-cmd "<build_dev_cmd>" --test-cmd "<test_cmd>" --node integrador
   ```
   - Si `test_cmd` falla, aplicar triaje de `stderr`: DOM/a11y → `Maquetador` (Paso 3); lógica/mutación/offline → `Integrador` (Paso 4); **solo** error de sintaxis o setup de MSW en el test → `Tester` (Paso 2). Si `revision_count > 3`, escalar a revisión humana.
3. Presentar resumen en chat y preguntar si procede al Paso 5 (Optimización/Refactor) o directo al Paso 6 si es exento.

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera confirmación explícita.

---

### Paso 5 — Refactor y Optimización (`frontend-auditor-agent` + Gate 4)

- **Condición de exención:** En cambios puramente locales sin nuevas rutas, dependencias pesadas ni requerimientos PWA/offline, omitir la edición del Auditor y ejecutar solo el Gate 4 de build de producción.
1. Invocar a `frontend-auditor-agent` para aplicar *lazy loading*, Service Workers (`pwa_mode = 'enabled'`) y optimización de bundle (última edición productiva).
2. Ejecutar **Gate 4**:
   ```bash
   node "<plugin-root>/scripts/validate-frontend.js" --gate 4 --repo-root "<repo-destino>" --change-dir "openspec/changes/<change-name>" --frontend-dir "<frontend_dir>" --openapi-path "<openapi_path>" --tests-dir "<tests_dir>" --bundle-dir "<bundle_dir>" --max-bundle-kb "<max_bundle_kb>" --build-prod-cmd "<build_prod_cmd>" --test-cmd "<test_cmd>" --node auditor
   ```
3. Presentar métricas de bundle y estado en verde.

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera confirmación para la verificación final.

---

### Paso 6 — Verificación Final vía `opsx:verify` (`frontend-qa-agent` Fase B)

1. Invocar a `frontend-qa-agent` (Fase B) sobre el código final congelado para ejecutar `opsx:verify` y generar `openspec/changes/<change-name>/verification-report.md`.
2. Si el veredicto es `[OBSERVADO CON CORRECCIONES REQUERIDAS]`, presentar los hallazgos y el triaje (`Maquetador`, `Integrador`, `Auditor` o `Tester` solo por sintaxis/MSW) y esperar autorización para corregir.
3. Si es `[APROBADO]`, presentar el scorecard y preguntar si avanza al Paso 7 (Mutation Testing o cierre si es exento).

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera confirmación explícita.

---

### Paso 7 — Mutation Testing (`frontend-mutation-tester`) y Handoff

- **Condición de exención:** Obligatorio cuando el cambio incluye lógica de estado, validaciones, colas offline o handlers interactivos; exento en cambios puramente estáticos sin interacción (emitir directamente la señal de cierre).
1. Si aplica, invocar a `frontend-mutation-tester` para evaluar mutantes FM1–FM5 sin dejar mutaciones en disco y emitir `openspec/changes/<change-name>/mutation-report.md`.
2. **Bifurcación:**
   - Si el veredicto es `[TESTS COMPLACIENTES DETECTADOS]`: presentar las brechas de falsabilidad y preguntar si autoriza volver a `frontend-qa-agent` (Paso 2) para reforzar las aserciones antes de re-verificar.
     **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera confirmación.
   - Si el veredicto es `[TESTS BLINDADOS]` (o si es exento): emitir la señal hacia el orquestador principal:
     ```text
     [LISTO PARA COMMIT Y ARCHIVE] <frontend_dir> <tests_dir> openspec/changes/<change-name>/
     ```
     El orquestador ejecutará `opsx:archive` (o `opsx:bulk-archive` si es multi-capa) y realizará el `git commit` atómico tras confirmación del usuario.
