---
name: sdd-init
version: 0.1.0
description: Inicializa la estructura de Specification-Driven Development (OpenSpec) y genera openspec/config.yaml en el repositorio de desarrollo sin instalar comandos locales (usados vía plugin).
trigger: "cuando el usuario quiera inicializar o configurar SDD / OpenSpec en un repositorio de desarrollo"
tools_required:
  - Read
  - Write
  - AskUserQuestion
subagents: []
inputs:
  - Ruta del repositorio de desarrollo (o directorio actual si se opera sobre él)
  - docs/tech-briefing.md (opcional, para extraer stack y contexto)
  - docs/prd/*.md (opcional, para extraer dominio y reglas de negocio)
  - package.json, pyproject.toml, Cargo.toml, go.mod u otros manifiestos (opcional)
outputs:
  - openspec/
  - openspec/config.yaml
  - openspec/specs/
  - openspec/changes/
  - openspec/changes/archive/
commits:
  - "El orquestador (nunca este skill ni sus subagentes) hace todos los commits, siempre tras confirmación explícita del usuario."
---

# sdd-init

Skill para inicializar el entorno de **Specification-Driven Development (SDD / OpenSpec)** en un repositorio de código de destino.

---

## 🧭 VARIABLES DE SESIÓN

Este skill recibe o inicializa las variables de sesión globales (§7.3.4):

| Variable | Valores | Uso en este skill |
|---|---|---|
| `idioma` | `español` / `inglés` | Idioma de los textos y reglas generadas |
| `tiene_repositorio` | `true` / `false` | Determina si se crea la estructura en disco o solo se expone en chat |
| `tipo_proyecto` | `greenfield` / `brownfield` | Detección de manifiestos y stack para el bloque context de config.yaml |

---

## 🎯 OBJETIVO Y FILOSOFÍA

1. **Uso Exclusivo vía Plugin:** Las habilidades, workflows y comandos de OpenSpec **NO** se instalan en el repositorio de código del usuario (evitando ensuciar el proyecto con `.agent/`, `.claude/`, `.windsurf/`, etc.). Los agentes ejecutan SDD directamente a través de las capacidades instaladas en el plugin (`it-project-orchestrator`).
2. **Estructura Limpia y sin `.gitkeep`:** Crea únicamente las carpetas del framework (`openspec/`, `specs/`, `changes/`, `archive/`) y el archivo de configuración `openspec/config.yaml`. No se colocan archivos `.gitkeep`: las carpetas se poblarán naturalmente en cuanto se inicie el primer cambio o desarrollo SDD.
3. **`config.yaml` Enriquecido y Contextual:** No genera un archivo vacío ni genérico; extrae proactivamente el contexto del proyecto (stack tecnológico, convenciones de arquitectura y commits) a partir de la documentación existente (`docs/tech-briefing.md`, `docs/prd/`, manifiestos de paquetes) para que los agentes cuenten con contexto inmediato al generar especificaciones y código.

---

## 📋 REGLAS GENERALES

1. **Límite Estricto de Fin de Turno:** Al pedir confirmación de la ruta o del contenido propuesto para `config.yaml`, **DETÉN TU RESPUESTA INMEDIATAMENTE** y cede el turno al usuario.
2. **No instalar herramientas locales:** Queda estrictamente prohibido ejecutar comandos como `openspec init --tools all` o crear carpetas de agentes locales (`.agent/`, `.claude/`, `.cursor/`, etc.) en el repositorio de código.
3. **No agregar `.gitkeep`:** Las carpetas `openspec/specs/` y `openspec/changes/` deben crearse como directorios limpios en disco.

---

## 👣 PROCEDIMIENTO PASO A PASO

### Paso 1 — Identificar el Repositorio de Desarrollo

1. Determinar el directorio raíz del proyecto destino:
   - Si el agente ya está operando en la raíz del repositorio de desarrollo, confirma la ubicación actual.
   - Si se opera desde el orquestador principal, solicita al usuario la ruta del repositorio donde se desarrollará el software.
2. Comprobar si `openspec/` ya existe en ese repositorio:
   - Si ya existe `openspec/config.yaml`, advertir al usuario y preguntar si desea actualizar la configuración o mantenerla intacta.

---

### Paso 2 — Inspeccionar Contexto y Convenciones del Proyecto

Inspeccionar el repositorio de desarrollo en busca de fuentes de contexto técnico:

1. **Documentación previa:**
   - `docs/tech-briefing.md` (stack, arquitectura, base de datos, convenciones).
   - `docs/prd/*.md` (dominio del problema, usuarios, reglas de negocio).
   - `docs/config-project-orchestrator/tool-config.md` (herramientas y metodología).
2. **Manifiestos y configuración de código:**
   - `package.json`, `pnpm-lock.yaml`, `tsconfig.json` (Node / TypeScript / Frontend).
   - `pyproject.toml`, `requirements.txt`, `Pipfile` (Python).
   - `Cargo.toml` (Rust), `go.mod` (Go), `pom.xml` / `build.gradle` (Java/Kotlin), etc.
   - Linter/formateadores (`.eslintrc`, `biome.json`, `ruff.toml`).
   - `.github/workflows/` (pipelines CI/CD, convenciones de testing y ramas).

Si no se encuentra documentación ni manifiestos técnicos claros, formular una única pregunta concisa al usuario:
> *"¿Cuál es el stack tecnológico principal y convenciones clave de este proyecto para incluirlas en el contexto de OpenSpec?"*

---

### Paso 3 — Proponer el Contenido de `openspec/config.yaml`

Elaborar la propuesta para `openspec/config.yaml` respetando el esquema oficial `spec-driven` y alineado con los estándares del orquestador:

```yaml
schema: spec-driven

# Contexto del proyecto visible para los agentes al crear propuestas, especificaciones y código
context: |
  Tech stack: <lenguajes, frameworks, bases de datos, librerías clave>
  Architecture: <patrón arquitectónico: modular monolith, clean architecture, microservicios, etc.>
  Testing: <framework de testing y cobertura esperada>
  Git & Commits: Conventional Commits (<feat, fix, docs, chore, etc.>)
  Domain & Standards: <resumen conciso del dominio y reglas generales>

# Reglas por artefacto para guiar el ciclo de desarrollo
rules:
  proposal:
    - Mantener las propuestas enfocadas exclusivamente en el problema y la necesidad planteada.
    - Explicar siempre la sección "Non-goals" (lo que NO se implementará en este cambio).
    - Longitud concisa (máximo 500 palabras).
  specs:
    - Redactar los requisitos en formato Given / When / Then o reglas de negocio observables.
    - Mantener las especificaciones desacopladas de nombres de variables internas temporales.
  design:
    - Diseñar contratos claros de interfaces, tipos y modelos de datos antes de codificar.
    - Evitar sobre-ingeniería; preferir soluciones simples y extensibles.
  tasks:
    - Cada tarea debe representar una unidad atómica terminable en media jornada (máx. 2 a 4 horas).
    - Ordenar las tareas respetando estrictamente el grafo de dependencias técnicas.
    - Incluir checklist Definition of Done (DoD) con tests y manejo de errores.
```

Presentar al usuario el resumen del archivo y pedir su visto bueno:

```text
💡 He preparado la configuración inicial de OpenSpec para el proyecto.
- Ubicación: openspec/config.yaml
- Schema: spec-driven
- Stack detectado: <resumen del stack>

¿Confirmas la creación de las carpetas y este archivo config.yaml?
```

**🛑 FIN DE TURNO OBLIGATORIO — ESPERA AL USUARIO:** Detén tu turno aquí y espera la confirmación explícita del usuario.

---

### Paso 4 — Creación de la Estructura (Modo Dual)

Tras recibir la confirmación del usuario:

- **Si `tiene_repositorio = true`:**
  1. **Crear directorios:**
     - `<repo>/openspec/`
     - `<repo>/openspec/specs/`
     - `<repo>/openspec/changes/`
     - `<repo>/openspec/changes/archive/`
     *(Sin crear archivos `.gitkeep`).*

  2. **Crear archivo de configuración:**
     - Escribir `<repo>/openspec/config.yaml` con el contenido aprobado.

  3. **Verificación:**
     - Confirmar que `openspec/config.yaml` existe y no tiene errores de sintaxis YAML.

- **Si `tiene_repositorio = false`:**
  - Mostrar el archivo completo en chat y notificar al usuario que para el desarrollo asistido por OpenSpec se requerirá crear esta estructura en disco al momento de inicializar un repositorio.

---

### Paso 5 — Cierre y Próximos Pasos

Informar al usuario de la finalización del setup:

```text
✅ Entorno SDD / OpenSpec inicializado con éxito en el repositorio.

Archivos y carpetas generados:
- openspec/config.yaml
- openspec/specs/
- openspec/changes/

🚀 Los comandos y skills de SDD se ejecutan directamente mediante este plugin (sin contaminar tu repo con configuraciones locales de agentes).
Puedes comenzar el primer cambio solicitando: "proponer un nuevo cambio con SDD" o usando /opsx:propose.
```
