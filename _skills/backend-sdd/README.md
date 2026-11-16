# Sistema Multi-Agente de Desarrollo Backend (`backend-sdd`)

Documentación conceptual y arquitectónica del flujo SDD (Specification-Driven Development) para la **capa backend** (`capa:backend`).

---

## 🎯 Propósito: ¿Por qué separar el desarrollo backend en varios agentes?

Cuando **un solo agente hace todo a la vez** (diseña el contrato de la API, programa el código de negocio y escribe sus propias pruebas en la misma sesión), suelen aparecer tres problemas frecuentes:

1. **Desvío del contrato (*Contract Drift*):** El agente adapta silenciosamente los datos de entrada/salida a lo que le resulta más rápido programar, en vez de respetar la especificación funcional acordada.
2. **Modificación accidental de la Base de Datos:** Si una consulta falla o le resulta incómoda, el agente tiende a alterar migraciones SQL o relajar políticas de seguridad (RLS) para que su código funcione.
3. **Pruebas autocomplacientes:** Escribe tests diseñados a medida de lo que acaba de programar o modifica/debilita los tests cuando alguno falla, en lugar de corregir el bug en el código.

Para evitar estos tres problemas, `backend-sdd` aplica **separación de responsabilidades** mediante **1 Orquestador + 4 Subagentes Especializados** y **4 Validaciones Mecánicas Deterministas (Gates CLI)** donde ningún modelo de lenguaje opina.

---

## 🤖 Arquitectura de Agentes (`1 Orquestador + 4 Subagentes`)

| # | Componente | Ubicación | Qué hace | Qué tiene prohibido hacer |
|---|---|---|---|---|
| **0** | **Orquestador (`SKILL.md`)** | `_skills/backend-sdd/SKILL.md` | Coordina el paso a paso con el usuario, ejecuta los 4 Gates mecánicos en terminal, sugiere configurar `pre-commit`/`pre-push`/CI si faltan, y gestiona el cierre (`opsx:archive` y `git commit`). | No diseña ni programa por su cuenta; no avanza sin confirmación humana en las pausas `🛑`. |
| **1** | **`api-architect-agent`** | `agents/backend/api-architect-agent.md` | Explora el repositorio (`opsx:explore`) y ejecuta `opsx:propose` para crear la propuesta (`proposal.md`), los requisitos con escenarios Given/When/Then (`specs/<cap>/spec.md`), el diseño técnico (`design.md`), el contrato (`openapi.yaml` o esquemas tipados *Code-First* como FastAPI) y el plan de tareas (`tasks.md`). | Prohibido escribir código productivo en `<backend_dir>`, tocar la base de datos o hacer commits. |
| **2** | **`backend-qa-agent`** | `agents/backend/backend-qa-agent.md` | **Fase A (Antes del código):** Escribe la suite de pruebas organizada por dominio/módulo en `<tests_dir>` y la ejecuta para comprobar que falle en **🔴 ROJO**.<br>**Fase B (Después del código):** Verifica que todos los tests pasen en **🟢 VERDE**, audita la seguridad (sin bypass de RLS ni brechas de permisos/multi-tenancy) y genera `verification-report.md` (`opsx:verify`). | Prohibido modificar el código productivo del backend y **prohibido relajar o borrar tests** si el código falla. |
| **3** | **`backend-developer-agent`** | `agents/backend/backend-developer-agent.md` | Ejecuta `opsx:apply` e implementa las capas del backend (DTOs/Schemas, Repositorios, Servicios de Dominio y Controladores/Routers/Workers) hasta lograr que los tests escritos por QA pasen en verde, marcando el avance (`- [x]`) en `tasks.md`. | **Prohibido tocar directorios de Base de Datos** (`migrations/`, `security/`) y **prohibido modificar los archivos de `tests/`**. |
| **4** | **`backend-mutation-tester`** | `agents/backend/backend-mutation-tester.md` | **Gate Condicional (Paso 5):** Audita la falsabilidad de la suite en `<tests_dir>` ejecutando mutaciones controladas sobre `<backend_dir>` (herramienta nativa o catálogo `M1–M5`) y genera `mutation-report.md` para detectar aserciones complacientes o mocks permisivos. | Prohibido dejar mutaciones o cachés temporales persistidos en disco, modificar `<tests_dir>` o ejecutar comandos `git`. |

---

## ⚙️ Las 4 Validaciones Mecánicas Deterministas (`scripts/validate-backend.js`)

Son puntos de control ejecutados por comando CLI (código de salida `0` obligatorio para avanzar):

| Gate | Momento | Qué verifica mecánicamente |
|---|---|---|
| **Gate 1: Pre-condición BD e Introspección** | **Paso 0** (Al iniciar el flujo) | Si el ticket usa base de datos (`db_mode = 'with-db'`), comprueba que las migraciones/esquemas existan en disco y ejecuta la generación de tipos del ORM (`supabase gen types`, `prisma generate`, etc.) cuando aplica. Si el ticket no usa BD (`stateless`), se omite. |
| **Gate 2: Validación de Especificación y Contrato** | **Paso 1** (Tras `api-architect-agent`) | Ejecuta `openspec validate`, verifica que `spec.md` contenga escenarios `GIVEN / WHEN / THEN` completos y, si el proyecto usa `openapi.yaml` (`openapi-first`), valida su estructura OpenAPI 3.x y que no existan referencias `$ref` rotas. |
| **Gate 3: Linter, Tipado e Inmutabilidad de BD (`No-DB-Diff`)** | **Paso 3** (Tras `backend-developer-agent`) | 1. Ejecuta el linter y chequeador de tipos del proyecto (`ruff`/`mypy`, `eslint`/`tsc`).<br>2. Ejecuta `git diff --exit-code` sobre las carpetas de BD para garantizar que el desarrollador de backend no tocó ni una línea de la base de datos.<br>3. Escanea que no haya secretos hardcodeados ni uso indebido de `service_role`. |
| **Gate 4: Ejecución de Tests por Dominio en VERDE** | **Paso 4** (En `opsx:verify`) | Verifica que los archivos de test respeten la organización por dominio/módulo (sin nombres de tickets ni `<change-name>`) y ejecuta el runner de pruebas del proyecto (`pytest`, `vitest`, `jest`) exigiendo que toda la suite pase en verde. |

---

## 🔄 Adaptabilidad según el Tipo de Proyecto

El flujo no impone una única tecnología ni estructura rígida; en la exploración inicial detecta y se adapta a:
- **Relación con BD (`db_mode`):** Servicios con base de datos (`with-db`) vs. servicios de cálculo, workers en memoria o integraciones externas sin BD propia (`stateless`).
- **Modelo de Seguridad (`rls_mode` y `auth_mode`):** Proyectos con Row-Level Security en BD (ej. Supabase/PostgreSQL RLS, donde se propaga el JWT a la sesión de BD) vs. proyectos donde la autorización RBAC y el filtrado por `tenant_id` viven en la capa de aplicación (`rls_mode = 'none'`) vs. endpoints públicos (`auth_mode = 'none'`).
- **Estilo de Contrato (`contract_style`):** Frameworks *Code-First* que autogeneran OpenAPI desde el código (ej. **FastAPI** con Pydantic, NestJS, tRPC) vs. proyectos *Spec-First* con `openapi.yaml` vs. *Background Jobs / Workers*, GraphQL o gRPC.
- **Arquitectura (`arch_pattern`):** Estructura en capas estándar para proyectos nuevos (*Greenfield*) o adopción estricta de la organización existente en proyectos en marcha (*Brownfield*).
