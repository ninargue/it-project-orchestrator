# Project Base Template

Repositorio plantilla (Template Repository) preconfigurado con gobernanza de ramas, workflows de GitHub Actions, plantillas de issues/PRs y carpeta `docs/` para proyectos IT.

---

## Qué incluye este Template

### 1. Gobernanza de GitHub (`.github/`)
- **Workflows:**
  - `branch-policy.yml`: Validación de políticas y convenciones de ramas.
  - `pr-labeler.yml` y `issue-labels.yml`: Etiquetado automático de PRs e issues.
  - `backport.yml`: Gestión de retro-portes si aplica.
- **Issue Templates (`.github/ISSUE_TEMPLATE/`):**
  - Historias de usuario (`story.yml`) y Tickets técnicos (`ticket.yml`).
  - Bug report (`bug_report.yml`), Feature request (`feature_request.yml`), Tech debt (`tech_debt.yml`).
- **PR Templates:** Estructurados con checklists de entrega y revisión (`pull_request_template.md`, `release.md`).
- **Reglas y Gobernanza:** `CONTRIBUTING.md`, `SECURITY.md`, `labeler.yml`.

### 2. Carpeta de Documentación (`docs/`)
- Carpeta raíz `docs/` limpia, lista para que el orquestador (`it-project-orchestrator`) o el equipo generen la documentación del proyecto.

---

## Cómo usar este Template para un nuevo proyecto

1. En GitHub, haz clic en **Use this template** ➔ **Create a new repository**.
2. Asigna el nombre a tu nuevo proyecto y clónalo en tu máquina local.
3. Abre tu asistente de IA (Claude Code, Antigravity, Cursor, etc.) e invoca el orquestador:
   ```
   /it-project-orchestrator
   ```
4. El orquestador conducirá el proyecto creando los documentos necesarios dentro de `docs/` y materializando los issues en GitHub.
