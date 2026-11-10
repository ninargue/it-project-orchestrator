---
name: orchestrator
version: 0.1.0
description: Ciclo completo idea-to-backlog para quien tiene acceso a todo el proyecto
trigger: "cuando el usuario elige rol [3] Ciclo completo en el punto de entrada"
skills_invoked:
  - _skills/product-discovery/SKILL.md
  - _skills/stories-to-tickets/SKILL.md
---

# Orquestador — Ciclo completo

Instrucciones exclusivas para el rol `[3] Ciclo completo`.
Los roles `[1]` y `[2]` van directo a su SKILL.md — ver `AGENTS.md`.

Reglas generales, tono y convenciones de archivos: ver `AGENTS.md`.

> 💡 **Concisión en Chat vs. Persistencia:** Cuando `tiene_repositorio = true`, todos los entregables se persisten directamente en disco (`docs/prd/`, `docs/backlog/`). En el chat solo se emiten resúmenes ejecutivos con enlaces; **queda terminantemente prohibido volcar el contenido íntegro de los archivos Markdown en los mensajes**. El volcado completo en chat queda reservado exclusivamente para cuando `tiene_repositorio = false` (modo sin repo / previo a PDF).

---

## FASE 1 — Ejecutar Skill 1 (product-discovery)

> 🛑 **PROHIBIDO EJECUTAR EN LOTE (BATCH EXECUTION FORBIDDEN):**
> El orquestador NUNCA debe ejecutar los pasos de forma continua o desatendida. Cada paso individual (`Paso 0` a `Paso 8`) posee una barrera de fin de turno obligatoria. El agente debe detenerse y ceder el control al usuario en cada paso. Queda terminantemente prohibido encadenar pasos en un solo mensaje o simular respuestas del usuario.

1. Iniciar con `_skills/product-discovery/SKILL.md` desde el Paso 0.
2. Conducir la conversación paso a paso, respetando estrictamente el fin de turno en cada pausa hasta el HANDOFF AL SKILL 2 inclusive.
3. Al recibir la señal `[LISTO PARA COMMIT] docs/backlog/`:

   ```
   ⏸️ Skill 1 completado. Voy a commitear los archivos generados antes de continuar.
   Archivos:
   - docs/prd/alcance-<sufijo>.md
   - docs/prd/<proyecto>-<sufijo>.md
   - docs/backlog/<E-epica>/us-*.md

   ¿Confirmás el commit?
   ```

4. Tras confirmación explícita del usuario, hacer el commit:

   ```bash
   git add docs/prd/ docs/backlog/
   git commit -m "feat: product discovery — PRD y historias (<proyecto> <sufijo>)"
   ```

5. Confirmar al usuario y continuar a Fase 2.

---

## FASE 2 — Ejecutar Skill 2 (stories-to-tickets)

> 🛑 **PROHIBIDO EJECUTAR EN LOTE:** Al igual que en la Fase 1, cada paso (`Paso 9` a `Paso 14`) requiere validación interactiva y fin de turno antes de continuar.

1. Verificar que `docs/backlog/<E-epica>/us-*.md` existen en disco.
   Si no existen: detener y avisar — Skill 1 no completó correctamente.

2. Conducir `_skills/stories-to-tickets/SKILL.md` desde el Paso 9 paso a paso con el usuario.
   Los inputs son los archivos commiteados en la Fase 1.

3. Al recibir la señal `[LISTO PARA COMMIT] docs/backlog/ completo`:

   ```
   ⏸️ Skill 2 completado. Voy a commitear el backlog priorizado y los tickets.
   Archivos:
   - docs/backlog/<E-epica>/tickets-*.md
   - docs/backlog/backlog-priorizado.md

   ¿Confirmás el commit?
   ```

4. Tras confirmación:

   ```bash
   git add docs/backlog/
   git commit -m "feat: stories-to-tickets — tickets y backlog priorizado (<proyecto>)"
   ```

---

## MANEJO DE INTERRUPCIONES

Si el usuario detiene el flujo entre fases:
- Los archivos del Skill 1 ya están commiteados — no se pierden.
- Para retomar desde Skill 2: invocar directamente `_skills/stories-to-tickets/SKILL.md` con rol `[2]`.

Si un paso falla antes del commit:
- No commitear archivos parciales.
- Avisar al usuario qué paso falló y desde dónde puede retomar.
