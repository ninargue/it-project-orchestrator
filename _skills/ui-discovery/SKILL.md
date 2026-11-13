---
name: ui-discovery
version: 0.1.0
description: Conceptualización visual previa al ciclo frontend-sdd mediante modo híbrido (Text-to-Wireframe o Figma Extractor) con ux-designer-agent.
trigger: "cuando el usuario desee definir wireframes o extraer especificaciones visuales desde Figma antes de iniciar frontend-sdd"
tools_required:
  - Read
  - Write
  - AskUserQuestion
subagents:
  - ux-designer-agent
inputs:
  - Historia(s) de usuario (docs/backlog/**/us-*.md) o descripción funcional
  - Export/nodos/tokens de Figma (opcional, si modo = figma-extractor)
outputs:
  - docs/ui/<NNNN>-ui-spec-<sufijo>.json (si tiene_repositorio = true)
commits:
  - "El orquestador (nunca este skill ni sus subagentes) realiza commits tras confirmación explícita del usuario."
---

# ui-discovery

Skill previo y opcional para transformar requerimientos o diseños de Figma en un contrato visual estructurado (`ui-spec.json`) consumible por `frontend-sdd`.

---

## 🧭 VARIABLES DE SESIÓN HEREDADAS

| Variable | Valores | Uso en este skill |
|---|---|---|
| `idioma` | `español` / `inglés` | Idioma de los artefactos y mensajes |
| `tiene_repositorio` | `true` / `false` | Persistencia en `docs/ui/` o salida completa en chat |
| `prefijo_avance` | ej: `0001`, `0002` | Prefijo numérico incremental |
| `sufijo` | ej: `pos-carrito` | Sufijo en kebab-case |

---

## 📋 REGLAS GENERALES

1. **Límite Estricto de Fin de Turno:** Toda pausa `**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**` detiene inmediatamente el turno.
2. **Gobernanza de Git:** Prohibido ejecutar commits dentro de este skill o `ux-designer-agent`.
3. **Neutralidad Visual:** `ui-spec.json` describe roles semánticos, estados (`loading`, `empty`, `error`, `offline`, `ready`) y acciones requeridas, sin acoplarse a clases CSS.

---

## 👣 PROCEDIMIENTO PASO A PASO

### Paso 0 — Selección de Modo e Input Gate

1. Verificar la existencia de requerimientos (historias en `docs/backlog/**/us-*.md` o descripción del usuario).
2. Preguntar al usuario el modo de conceptualización:
   ```text
   🎨 ¿Cómo deseas generar la especificación visual (ui-spec.json)?
     [1] Text-to-Wireframe (generar wireframe estructural desde historias de usuario)
     [2] Figma Extractor — Human-in-the-Loop (extraer jerarquía, tokens y textos desde diseño Figma)
   ```
   **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la elección del usuario (y los datos/tokens de Figma si eligió `[2]`).

### Paso 1 — Generación de `ui-spec.json` (`ux-designer-agent`)

1. Invocar a `ux-designer-agent` pasando el modo elegido, las historias/requerimientos (y el diseño Figma si aplica) y la ruta destino `docs/ui/<prefijo_avance>-ui-spec-<sufijo>.json` (si `tiene_repositorio = true`).
2. `ux-designer-agent` valida 1:1 que todos los elementos de acción exigidos por la historia estén presentes en `ui-spec.json`.
3. Presentar resumen ejecutivo en chat (con enlace `file:///...` si `tiene_repositorio = true`, o contenido completo si `tiene_repositorio = false`):
   ```text
   🎨 Especificación visual generada:
   - Modo: <text-to-wireframe | figma-extractor>
   - Artefacto: [ui-spec.json](file:///<ruta>/docs/ui/<prefijo_avance>-ui-spec-<sufijo>.json)
   - Pantallas y acciones cubiertas: <resumen>

   ¿Apruebas esta especificación visual para pasar a frontend-sdd (o deseas ajustar algún flujo/elemento)?
   ```
   **🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera confirmación explícita.

### Paso 2 — Cierre y Handoff

1. Si `tiene_repositorio = true`, emitir la señal hacia el orquestador:
   ```text
   [LISTO PARA COMMIT] docs/ui/<prefijo_avance>-ui-spec-<sufijo>.json
   ```
2. Indicar al usuario que puede continuar con `_skills/frontend-sdd/SKILL.md` usando este `ui-spec.json` como entrada opcional.
