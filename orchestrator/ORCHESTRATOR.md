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

---

## FASE 1 — Ejecutar Skill 1 (product-discovery)

1. Cargar y ejecutar `_skills/product-discovery/SKILL.md` desde el Paso 0.
2. Seguir todos los pasos hasta el HANDOFF AL SKILL 2 inclusive.
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

1. Verificar que `docs/backlog/<E-epica>/us-*.md` existen en disco.
   Si no existen: detener y avisar — Skill 1 no completó correctamente.

2. Cargar y ejecutar `_skills/stories-to-tickets/SKILL.md` desde el Paso 9.
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
