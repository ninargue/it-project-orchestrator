---
name: stories-to-tickets
version: 0.1.0
description: Descompone historias en tickets técnicos y los materializa en GitHub o Linear
trigger: "cuando el tech lead o dev quiera convertir historias en tickets ejecutables"
tools_required:
  - Read
  - Write
  - bash (gh CLI o MCP de Linear para materialización)
  - bash (git — solo el orquestador; nunca este skill directamente)
subagents:
  - tickets-agent
  - issue-materializer-agent
inputs:
  - docs/backlog/<prefijo_avance>-<proyecto>-<sufijo>/E<N>-<nombre-epica>/us-<nombre-historia>.md  # output del Skill 1
  - docs/config-project-orchestrator/tool-config.md        # configuración de herramienta (opcional — se solicita al usuario si no existe)
outputs:
  - docs/backlog/<prefijo_avance>-<proyecto>-<sufijo>/E<N>-<nombre-epica>/tickets-<historia>.md    # tickets por historia
  - docs/backlog/<prefijo_avance>-<proyecto>-<sufijo>/<prefijo_avance>-backlog-priorizado.md       # grafo + sizing + matriz
  - issues creados en GitHub o Linear
commits:
  - "El orquestador (nunca este skill ni sus subagentes) hace todos los commits,
     siempre tras confirmación explícita del usuario."
---

# stories-to-tickets

Skill 2 del ciclo `it-project-orchestrator`.

Toma las historias enriquecidas del Skill 1 y produce tickets técnicos con DoD,
un grafo de dependencias, t-shirt sizing, una matriz de priorización, y los crea
en la herramienta de issues configurada.

---

## VARIABLES DE SESIÓN HEREDADAS

Este skill recibe del Skill 1 (product-discovery) las siguientes variables en memoria de sesión:

| Variable | Valores | Uso en este skill |
|---|---|---|
| `tiene_repositorio` | `true` / `false` | Determina si se escribe a disco o se trabaja en conversación |
| `prefijo_avance` | ej: `0001`, `0002` | Prefijo numérico incremental de la entrega/avance |
| `sufijo` | ej: `registro-ventas-mvp` | Nombre de archivos generados |
| `tipo_proyecto` | `greenfield` / `brownfield` | Contexto para tickets |

Si alguna de estas variables no está en memoria de sesión (usuario entró directo al Skill 2),
detectar `prefijo_avance` inspeccionando `docs/prd/` y `docs/backlog/` (o asignar `0001` si no hay previos) y preguntar al inicio:
```
1. Repositorio de destino:
   a) Sí (escribir archivos en el repositorio del proyecto)
   b) No (trabajar solo en la conversación)

2. Sufijo del proyecto: (ej: registro-ventas-mvp)

3. Origen de las historias:
   a) En esta sesión (misma conversación)
   b) Externas (pegar contenido aquí)
```

---

## REGLAS GENERALES

1. **Límite Estricto de Fin de Turno (Hard Turn Boundary):** Cada paso con pausa (`🛑 FIN DE TURNO OBLIGATORIO`) marca el fin absoluto de tu turno de respuesta.
   - Presenta únicamente el resultado o preguntas del paso actual.
   - **DETÉN tu respuesta inmediatamente.** No agregues texto anticipando el paso siguiente.
   - **QUEDA TERMINANTEMENTE PROHIBIDO** ejecutar múltiples pasos en un solo turno, asumir o simular respuestas del usuario, o invocar herramientas/subagentes para pasos posteriores.
   - Espera siempre el mensaje explícito del usuario antes de pasar al paso siguiente.
2. **Nunca hacer commits.** El orquestador es el único responsable de git.
   Cuando un paso produce un archivo listo para commitear, avisar con:
   `[LISTO PARA COMMIT] <ruta> — confirmar antes de continuar.`
3. **Fuente de datos:** Si `tiene_repositorio = true`, leer siempre desde disco.
   Si `tiene_repositorio = false`, usar el contenido de la conversación (las historias
   generadas en el Skill 1 están en el chat).
4. Los tickets **heredan** los criterios de las historias. No agregan criterios nuevos.
5. Los tickets **nombran la capa** que tocan (migración, modelo, endpoint, UI, test),
   pero **no diseñan**: sin tipos de columna, índices, nombres de ruta ni status codes.
   Esas decisiones son de la implementación.
6. **Idioma:** detectar leyendo archivos existentes en `docs/`. Si no hay archivos previos, preguntar al usuario:
   `"¿En qué idioma generamos los tickets y archivos? (español / inglés / otro)"`
   El idioma queda en memoria de sesión — no se escribe en ningún archivo de config.
7. **Concisión en Chat vs. Persistencia en Disco:**
   - **Si `tiene_repositorio = true`:** Los tickets y el backlog priorizado se escriben directamente a disco. En el chat solo se muestran resúmenes ejecutivos (tablas de tickets, diagramas y listas de archivos con enlaces). **QUEDA TERMINANTEMENTE PROHIBIDO volcar el contenido íntegro de todos los tickets generados en el chat**.
   - **Si `tiene_repositorio = false`:** Mostrar en conversación los bloques markdown completos para que el usuario los guarde cuando cree su repositorio.

---

## PASO 9 — De historias a tickets

**Subagente:** `it-project-orchestrator:tickets-agent` (Fase A)

**Invocación del subagente:**
- **Fuente de historias:**
  - Si `tiene_repositorio = true`: leer desde disco `docs/backlog/<prefijo_avance>-<proyecto>-<sufijo>/E<N>-<nombre-epica>/us-*.md`
  - Si `tiene_repositorio = false`: usar las historias del Skill 1 disponibles en la conversación
- **Tarea:** Descomponer cada historia en tickets atómicos de media jornada (`US-<XX>-T<N>`), nombrando la capa que tocan (sin diseñar el esquema) y con Definition of Done (DoD) como checklist de entrega (sin horas ni criterios inventados).

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**
1. Muestra los tickets técnicos al usuario.
2. DETÉN tu respuesta inmediatamente aquí.
3. QUEDA TERMINANTEMENTE PROHIBIDO generar el grafo de dependencias o pasar al Paso 10 en este mismo turno.
4. Espera la validación o ajustes del usuario antes de continuar.

---

## PASO 10 — Grafo de dependencias

**Subagente:** `it-project-orchestrator:tickets-agent` (Fase B)

**Invocación del subagente:**
- **Input:** Tickets validados en el Paso 9.
- **Tarea:** Generar el grafo de dependencias en Mermaid (`graph TD`) indicando qué bloquea a qué, junto con el orden de implementación por fases (distinguiendo qué tickets pueden realizarse en paralelo).
- **Estilo de alto contraste:** El diagrama debe incluir obligatoriamente `classDef default fill:#1e293b,stroke:#38bdf8,stroke-width:1.5px,color:#ffffff;` y `linkStyle default stroke:#94a3b8,stroke-width:1.5px;` para asegurar legibilidad perfecta en cualquier tema (oscuro o claro).

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**
1. Muestra el grafo Mermaid y el orden de fases propuesto.
2. DETÉN tu respuesta inmediatamente aquí.
3. QUEDA TERMINANTEMENTE PROHIBIDO estimar el sizing o pasar al Paso 11 en este mismo turno.
4. Espera la validación o ajustes del usuario antes de continuar.

---

## PASO 11 — T-shirt sizing

**Subagente:** `it-project-orchestrator:tickets-agent` (Fase C)

**Invocación del subagente:**
- **Input:** Tickets secuenciados en el Paso 10.
- **Tarea:** Estimar cada ticket en T-shirt sizing (S / M / L) con su nivel de riesgo (bajo / medio / alto) y fundamento técnico en una línea (sin inventar horas exactas ni story points arbitrarios), formateando la tabla con enlaces relativos a cada archivo de tickets (`[**US-<XX>-T<N>**](E<N>-<epica>/tickets-<historia>.md)`).

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**
1. Muestra la tabla de sizing y riesgos al usuario.
2. DETÉN tu respuesta inmediatamente aquí.
3. QUEDA TERMINANTEMENTE PROHIBIDO armar la matriz de impacto/complejidad o pasar al Paso 12 en este mismo turno.
4. Espera la validación o ajustes del usuario antes de continuar.

---

## PASO 12 — Matriz impacto/complejidad

**Subagente:** `it-project-orchestrator:tickets-agent` (Fase D)

**Invocación del subagente:**
- **Input:** Historias del backlog (incluyendo aquellas marcadas `[FUERA DE ALCANCE]`).
- **Tarea:** Ubicar las historias en matriz impacto vs. complejidad, identificar y destacar los Quick Wins (⭐) y proponer el orden de abordaje del backlog.

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**
1. Muestra la matriz de impacto vs complejidad y el orden de abordaje propuesto.
2. DETÉN tu respuesta inmediatamente aquí.
3. QUEDA TERMINANTEMENTE PROHIBIDO persistir archivos o pasar al Paso 13 en este mismo turno.
4. Espera la validación o ajustes del usuario antes de continuar.

---

## PASO 13 — Escribir backlog completo o emitir en conversación

**Subagente:** `it-project-orchestrator:tickets-agent` (Fase E)

**Invocación del subagente:**
- **Input:** Todo el backlog consensuado en los Pasos 9 al 12.
- **Tarea:**
  - **Si `tiene_repositorio = true`:** Escribir en disco:
    1. `docs/backlog/<prefijo_avance>-<proyecto>-<sufijo>/E<N>-<nombre-epica>/tickets-<nombre-historia>.md`: Un archivo por cada historia con sus tickets (`US-<XX>-T<N>`), DoD, talla y riesgo.
    2. `docs/backlog/<prefijo_avance>-<proyecto>-<sufijo>/<prefijo_avance>-backlog-priorizado.md`: Debe incluir en su encabezado el enlace y referencia al PRD correspondiente (`> PRD de referencia: [docs/prd/<prefijo_avance>-<proyecto>-<sufijo>.md](../../prd/<prefijo_avance>-<proyecto>-<sufijo>.md)`), seguido del grafo Mermaid con alto contraste, orden de implementación, matriz impacto/complejidad y orden priorizado de esta entrega.
    En el chat: mostrar únicamente un **resumen estructurado** de archivos generados con sus enlaces, tabla de historias con cantidad de tickets y tallas consolidadas. **QUEDA TERMINANTEMENTE PROHIBIDO volcar el contenido íntegro de todos los tickets en el chat**.
    Avisar al orquestador con: `[LISTO PARA COMMIT] docs/backlog/<prefijo_avance>-<proyecto>-<sufijo>/ completo.`
  - **Si `tiene_repositorio = false`:** Mostrar en conversación los dos bloques markdown listos para cuando el usuario cree el repositorio:
    1. `tickets-<sufijo>.md`: Todos los tickets por historia.
    2. `<prefijo_avance>-backlog-priorizado-<sufijo>.md`: Con referencia al PRD (`> PRD de referencia: <prefijo_avance>-<proyecto>-<sufijo>.md`), grafo, orden de implementación, matriz y orden priorizado.
    Avisar al orquestador con: `[LISTO PARA REVISIÓN] Backlog completo en conversación — confirmá para continuar al Paso 14.`

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**
1. Muestra el resumen de archivos creados con enlaces (si hay repo) o los dos bloques markdown completos en chat (si no hay repo) y avisa al orquestador.
2. DETÉN tu respuesta inmediatamente aquí.
3. QUEDA TERMINANTEMENTE PROHIBIDO crear issues en GitHub/Linear o pasar al Paso 14 en este mismo turno.
4. Espera la confirmación explícita del usuario antes de continuar.
- Si `tiene_repositorio = true`: `[LISTO PARA COMMIT] docs/backlog/ — el orquestador hace el commit tras confirmación.`
- Si `tiene_repositorio = false`: Continuar al Paso 14 sin commit.

---

## PASO 14 — Materializar en GitHub / Linear

**Subagente:** `it-project-orchestrator:issue-materializer-agent`

**Obtener configuración de herramienta:**
- Si `tiene_repositorio = true`: verificar si `docs/config-project-orchestrator/tool-config.md` existe y tiene los campos `herramienta_issues`, `metodo_issues` y `metodologia_equipo` completos. Si está completo, leer desde allí.
- Si `tiene_repositorio = false` o si el archivo no existe / tiene campos vacíos: preguntar al usuario:
  ```
  Para materializar los issues necesito saber:
  1. ¿Qué herramienta usás? (GitHub Issues / Linear / otra)
  2. ¿Cómo la tenés configurada? (gh CLI / MCP / ninguna aún)
  3. ¿Metodología del equipo? (Scrum / Kanban)
  ```

**Invocación del subagente:**
- **Fuente de datos:** Configuración de herramienta + historias + tickets.
- **Tarea:**
  - Ejecutar la creación de forma estrictamente SECUENCIAL (primero padres, luego hijos).
  - Si es GitHub, verificar si existen `.github/ISSUE_TEMPLATE/story.yml` y `ticket.yml` en el proyecto; si faltan, copiarlos desde `<raíz del plugin>/templates/github/`. Al invocar al subagente, sustituir `<raíz del plugin>` por la ruta absoluta: el subagente no la conoce.
  - Aplicar milestones y labels según Scrum o Kanban.
  - Generar y devolver el reporte consolidado con tabla de issues creados, sus IDs y URLs.

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:**
1. Pregunta al usuario antes de crear los issues:
`"¿Creo los issues en <herramienta>? Esto creará <N> items. Confirmar para continuar."`
2. DETÉN tu respuesta inmediatamente aquí.
3. QUEDA TERMINANTEMENTE PROHIBIDO invocar `issue-materializer-agent` o ejecutar la creación de issues antes de recibir la confirmación explícita del usuario.
4. Espera la confirmación del usuario para proceder a la materialización.

---

## CIERRE DEL CICLO

Al completar el Paso 14, emitir:

--- SI tiene_repositorio = true ---

```
✅ stories-to-tickets completado. Ciclo idea-to-backlog finalizado.

Resumen:
- Épicas: <N>
- Historias: <N> (+ <N> fuera de alcance documentadas)
- Tickets: <N>
- Quick wins identificados: <N>
- Issues creados en <herramienta>: <N>

Archivos en el repo:
- docs/prd/                   → PRD y alcance
- docs/backlog/               → historias, tickets y backlog priorizado

Próximos pasos sugeridos:
1. Commitear docs/backlog/ si aún no se hizo (el orquestador lo hace)
2. Asignar tickets en <herramienta>
3. Definir el primer sprint/ciclo según el orden de backlog propuesto
```

--- SI tiene_repositorio = false ---

Mostrar en la conversación el markdown completo listo para usar:

```
## tickets-<sufijo>.md
[todos los tickets por historia, con DoD, talla y riesgo — formato del Paso 9]

---
## <prefijo_avance>-backlog-priorizado-<sufijo>.md
> PRD de referencia: docs/prd/<prefijo_avance>-<proyecto>-<sufijo>.md
[grafo de dependencias, orden de implementación, matriz impacto/complejidad, orden de backlog]
```

```
✅ stories-to-tickets completado. Ciclo idea-to-backlog finalizado.

Resumen:
- Épicas: <N>
- Historias: <N> (+ <N> fuera de alcance documentadas)
- Tickets: <N>
- Quick wins identificados: <N>
- Issues creados en <herramienta>: <N>

Los archivos están listos en la conversación.
Cuando crees el repositorio del proyecto, guardá estos archivos en:
  docs/backlog/<prefijo_avance>-<proyecto>-<sufijo>/E<N>-<epica>/tickets-<historia>.md
  docs/backlog/<prefijo_avance>-<proyecto>-<sufijo>/<prefijo_avance>-backlog-priorizado.md

Próximos pasos sugeridos:
1. Crear el repositorio del proyecto y versionar los archivos generados
2. Asignar tickets en <herramienta>
3. Definir el primer sprint/ciclo según el orden de backlog propuesto
```

