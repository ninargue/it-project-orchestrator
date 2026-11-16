# Convenciones de Base de Datos (Fuente Única)

Esta guía centraliza las reglas operativas de la capa de datos para OpenSpec y los subagentes `db-*`.

## 1. Ambientes y quién aplica
| Ambiente | Variable de entorno | Quién aplica migraciones | Acceso del agente |
|---|---|---|---|
| **Pruebas (efímera)** | `DB_TEST_URL` | Agente (en cada ciclo) | Lectura/escritura + roundtrip + M3 |
| **Desarrollo** | `DB_DEV_URL` / `DB_DEV_RO_URL` | Agente **solo tras verde en pruebas** | Exploración en solo lectura (`agent_ro`) |
| **Producción** | *(no expuesta al agente)* | **Persona humana** (manual / CI) | **Ninguno** (`agent_access: none`) |

## 2. Exploración y diseño (`design.md`)
- Consultar el esquema real y valores distintos/nulos en columnas afectadas usando `DB_DEV_RO_URL` y registrar en `## Estado observado de la base`.
- Incluir `## Reversibilidad` con conteo real de filas y clasificación: `reversible` | `falla-en-alto` | `pierde-datos`.
- **Expand / Contract:** prohibido borrar una columna con datos en el mismo cambio en que se deja de usar (dividir en 2 changes).
- **Normalización:** si una regla nueva afecta filas existentes, declarar en `## Normalización` cuántas filas la violan y el valor elegido para cada clase antes del constraint.
- **Estilo Mermaid `erDiagram`:** usar alto contraste `%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#1e293b', 'primaryTextColor': '#ffffff', 'primaryBorderColor': '#38bdf8', 'lineColor': '#94a3b8' }}}%%` (nunca `linkStyle` ni `classDef`).

## 3. Seeds de desarrollo
- Derivados de las reglas de negocio declaradas en `specs/`.
- Datos 100% inventados (nunca reales ni copiados de producción).
- Fechas relativas a hoy (`now() - interval '...'`), nunca fechas fijas obsoletas.
- Idempotentes (`ON CONFLICT DO NOTHING` / upsert) y marcados como **solo para desarrollo**.

## 4. Copias de producción
- El agente tiene bloqueado leer archivos `*.dump`, `*.bak` o carpetas `backups/`. Ver `_skills/db-sdd/references/prod-copy.md`.
