# Guía de contribución

## Resumen

1. Toda tarea parte de un **issue** (bug, feature, deuda técnica o documentación).
2. Se crea una rama desde `develop` actualizado, siguiendo la [convención de nombres](#convención-de-nombres-de-branch).
3. Los commits siguen la [convención de mensajes](#convención-de-commits).
4. Los cambios llegan a `develop` y `master` **solo mediante Pull Request**: ambas ramas están protegidas (sin push directo ni push forzado).
5. Antes del merge, el check **Validar rama origen** debe estar en verde y la rama debe estar **actualizada** con su rama destino.
6. Al mergear, la rama remota se borra automáticamente.

El paso a paso de cada caso está en [Ciclo de trabajo](#ciclo-de-trabajo).

Las vulnerabilidades de seguridad **no** se reportan como issue: ver [SECURITY.md](SECURITY.md).

---

## Convención de nombres de branch

### Estructura general

```
<tipo>/<descripcion-en-kebab-case>
```

- El **tipo** indica la naturaleza del trabajo.
- La **descripción** es corta, en minúsculas, con palabras separadas por guiones (`-`), sin tildes ni caracteres especiales.
- Las ramas de release usan el número de versión: `release/vX.Y.Z`.

### Tipos de branch

| Tipo | Propósito | Ejemplo |
|------|-----------|---------|
| `feature/` | Nueva funcionalidad | `feature/cierre-de-caja` |
| `fix/` | Corrección de bug | `fix/sync-venta-duplicada` |
| `hotfix/` | Corrección urgente en producción | `hotfix/refresh-token-expirado` |
| `chore/` | Mantenimiento, configuración, dependencias | `chore/actualizar-fastapi` |
| `refactor/` | Reestructuración de código sin cambio de comportamiento | `refactor/servicio-de-ventas` |
| `docs/` | Documentación únicamente | `docs/modelo-de-datos` |
| `test/` | Pruebas unitarias o de integración | `test/aislamiento-entre-tenants` |
| `release/` | Preparación de una versión para producción | `release/v1.2.0` |

### Ramas permanentes

| Rama | Propósito |
|------|-----------|
| `master` | Código en producción. Solo recibe PRs desde `develop`, `release/*` o `hotfix/*`. |
| `develop` | Rama de integración. Las ramas de trabajo se mergean aquí antes de ir a `master`. |

### Reglas

1. **Siempre en minúsculas**: `feature/login-usuario`, no `feature/LoginUsuario`.
2. **Sin tildes, espacios ni guiones bajos**: `feature/gestion-usuarios`, no `feature/gestión_usuarios`.
3. **Descripción corta y concreta**: máximo 4-5 palabras que describan el cambio.
4. **Sin números de issue solos**: si se referencia un issue, agregar contexto: `feature/42-exportar-ventas`, no `feature/42`.
5. **La rama se borra** al mergear el PR (la remota, automáticamente; la local, a mano).

Las reglas 1, 2 y el formato de `release/vX.Y.Z` las valida el workflow **Branch Policy**; un PR con un nombre inválido no puede mergearse.

### Ejemplos correctos vs. incorrectos

| Correcto | Incorrecto | Motivo |
|----------|------------|--------|
| `feature/exportar-ventas-csv` | `feature/ExportarCSV` | Mayúsculas |
| `fix/error-500-login` | `fix/arreglo_login` | Guion bajo |
| `chore/actualizar-fastapi` | `chore/actualizacion` | Demasiado genérico |
| `hotfix/stock-negativo-al-anular` | `hotfix/urgente` | Sin contexto del problema |
| `release/v1.0.0` | `release/produccion` | Sin número de versión |

---

## Convención de commits

Los mensajes siguen [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):

```
<tipo>(<alcance opcional>): <descripción en imperativo y minúsculas>

<cuerpo opcional: qué y por qué, no cómo>

<pie opcional: Closes #42, BREAKING CHANGE: ...>
```

| Tipo | Uso | Ejemplo |
|------|-----|---------|
| `feat` | Nueva funcionalidad | `feat(caja): agrega arqueo con diferencia esperada vs. contada` |
| `fix` | Corrección de bug | `fix(sync): evita duplicar ventas al reintentar el envío` |
| `docs` | Documentación | `docs: agrega ADR de estrategia offline` |
| `refactor` | Cambio interno sin cambio de comportamiento | `refactor(ventas): extrae cálculo de totales a un servicio` |
| `test` | Pruebas | `test(tenancy): verifica aislamiento de productos entre negocios` |
| `chore` | Mantenimiento, dependencias, configuración | `chore: actualiza fastapi a 0.120` |
| `perf` | Mejora de rendimiento | `perf(reportes): agrega índice por tenant y fecha` |
| `ci` | Workflows y pipelines | `ci: valida formato de nombres de rama` |

- Alcances sugeridos: los módulos del sistema (`auth`, `tenancy`, `catalogo`, `ventas`, `caja`, `inventario`, `reportes`, `ia`, `sync`, `db`).
- Un cambio incompatible se marca con `!` (`feat(api)!: ...`) y un pie `BREAKING CHANGE: <detalle>`.
- Como los PRs a `develop` se mergean con **Squash and merge**, el **título del PR** se convierte en el commit final: debe seguir esta misma convención.

---

## Etiquetas

### Issues

| Grupo | Etiquetas | Quién la pone |
|-------|-----------|---------------|
| Criticidad (bugs) | `severidad:critica` · `alta` · `media` · `baja` | Automática, desde el formulario |
| Prioridad (features) | `prioridad:alta` · `media` · `baja` | Automática, desde el formulario |
| Riesgo (deuda técnica) | `riesgo:alto` · `medio` · `bajo` | Automática, desde el formulario |
| Complejidad | `talla:S` · `M` · `L` · `XL` | A mano, al hacer el triage |
| Capa | `capa:frontend` · `backend` · `db` · `infra` · `docs` | A mano |
| Módulo | `modulo:auth` · `tenancy` · `catalogo` · `ventas` · `caja` · `inventario` · `reportes` · `ia` | A mano |
| Fase | `mvp` · `fase-2` | A mano |

### Pull requests

| Grupo | Etiquetas | Quién la pone |
|-------|-----------|---------------|
| Tipo | `tipo:feature` · `fix` · `hotfix` · `docs` · `refactor` · `test` · `chore` · `release` | Automática, según el prefijo de la rama |
| Capa | `capa:docs` · `db` · `infra` (y `frontend`, `backend` cuando exista el código) | Automática, según los archivos modificados |
| Módulo | `modulo:auth` · `tenancy` · `catalogo` · `ventas` · `caja` · `inventario` · `reportes` · `ia` | A mano (automática cuando exista el código) |
| Alertas | `migracion` · `seguridad` · `breaking-change` · `sync-offline` | Automática por ruta o por `!` en el título; también a mano |
| Notas de versión | `sin-changelog` | A mano (automática en backports) |

Las etiquetas de tipo y alertas definen las secciones de las notas de versión (`.github/release.yml`).

---

## Ciclo de trabajo

### Feature, fix, docs, chore, refactor o test → `develop`

#### 1. Crear la rama desde `develop` actualizado

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nombre-descriptivo
```

#### 2. Abrir el PR en borrador al primer commit

```bash
git add <archivos>
git commit -m "feat(modulo): primer avance"
git push -u origin feature/nombre-descriptivo
```

En GitHub: **New pull request → `develop` ← `feature/nombre-descriptivo` → Create draft pull request**, o desde la terminal:

```bash
gh pr create --base develop --draft --fill
```

El PR queda en borrador mientras el trabajo está en curso, enlazado a su issue (`Closes #N` en la descripción).

#### 3. Desarrollar en la rama

Commits frecuentes y pequeños, siguiendo la [convención de commits](#convención-de-commits).

#### 4. Actualizar la rama antes del merge (obligatorio)

`develop` exige que la rama esté al día con ella. Si `develop` avanzó, incorpora esos cambios y resuelve conflictos localmente:

```bash
git checkout develop
git pull origin develop
git checkout feature/nombre-descriptivo
git merge develop
# resolver conflictos si los hay
git push
```

Si no hay conflictos, también puede usarse el botón **Update branch** del PR en GitHub.

#### 5. Autorrevisión y "Ready for review"

- Recorrer el checklist del template de PR y marcar lo que aplica.
- Revisar el diff completo en GitHub (pestaña *Files changed*).
- Verificar que el check **Validar rama origen** está en verde.
- Cambiar el PR de **Draft** a **Ready for review**.

#### 6. Merge y limpieza

- Mergear con **Squash and merge** (un commit por PR en `develop`), revisando que el título final siga la convención de commits.
- La rama remota se borra automáticamente. Borrar la local:

```bash
git checkout develop
git pull origin develop
git branch -d feature/nombre-descriptivo
```

---

### Release → `master`

Cuando `develop` está estable y se va a liberar una versión ([SemVer](https://semver.org/lang/es/): `MAYOR.MENOR.PARCHE`):

```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.2.0
git push -u origin release/v1.2.0
```

1. En la rama de release solo se permiten **correcciones menores**, el ajuste de versión y el changelog, y **siempre mediante PR** hacia `release/vX.Y.Z` desde una rama `fix/*`, `docs/*` o `chore/*` (squash). Las ramas `release/*` están protegidas: no admiten push directo, y **Branch Policy** rechaza cualquier otro tipo de rama. Así cada corrección queda como un PR con etiquetas y aparece en las notas de versión.
2. Cuando no queden correcciones pendientes, [actualizar `CHANGELOG.md`](#changelog) mediante un PR `docs/changelog-vX-Y-Z` → `release/vX.Y.Z`.
3. Abrir el PR `release/v1.2.0` → `master` usando el template de release:
   `https://github.com/ninargue/registro-venta-micro/compare/master...release/v1.2.0?template=release.md`
4. Completar el checklist de release (migraciones en staging, backup, plan de rollback, changelog).
5. Mergear con **Create a merge commit** (no squash, para que `master` y `develop` compartan historia).
6. [Crear el tag y el release](#tag-y-release-en-github) con las notas del changelog.
7. Completar el [backport a `develop`](#backport-a-develop).

---

### Hotfix → `master`

Correcciones urgentes que no pueden esperar el ciclo normal de `develop`:

```bash
git checkout master
git pull origin master
git checkout -b hotfix/descripcion-corta
# ... corrección + commit ...
git push -u origin hotfix/descripcion-corta
```

1. [Actualizar `CHANGELOG.md`](#changelog) con la versión de parche (`v1.2.1`) y commitearlo en la rama de hotfix.
2. Abrir **un solo PR**: `hotfix/descripcion-corta` → `master` (template de release: `?template=release.md`).
3. Mergear con **Create a merge commit**.
4. [Crear el tag y el release](#tag-y-release-en-github) de parche (`v1.2.1`).
5. Completar el [backport a `develop`](#backport-a-develop).

---

### Changelog

`CHANGELOG.md` (en la raíz) sigue el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), con la versión más nueva arriba. **No se edita en cada PR**: se genera en cada release o hotfix a partir de las etiquetas de los PRs (categorías de `.github/release.yml`), así el archivo y el release de GitHub dicen lo mismo.

**Qué entra en una versión:** los PRs cuyos commits están en la rama de release (o hotfix) y no en el tag anterior. En la práctica, los PRs mergeados a `develop` desde la última versión, más los PRs de corrección hechos hacia la rama de release. Como solo se listan **PRs**, nada debe llegar a una rama de release por push directo (está protegida).

**Qué queda fuera:**

- PRs con la etiqueta `sin-changelog`. Se aplica sola a los backports y a los PRs que solo tocan `.github/**` o `CHANGELOG.md` (CI, templates, el propio changelog). Ponla a mano en cualquier otro PR que no aporte al usuario (p. ej. un typo).
- El PR de release en sí (`tipo:release`).
- Los hotfix ya publicados: entran a `develop` por el PR de backport (`sin-changelog`), así que no se repiten en la versión siguiente. Por eso `previous_tag_name` debe ser siempre **el último tag**, aunque sea de un hotfix.

En la rama `release/vX.Y.Z` o `hotfix/*`, antes de abrir el PR a `master`:

```bash
# Notas desde el último tag (omitir previous_tag_name en la primera versión)
gh api repos/ninargue/registro-venta-micro/releases/generate-notes \
  -f tag_name=v1.2.0 -f target_commitish=release/v1.2.0 \
  -f previous_tag_name=v1.1.0 --jq .body
```

1. Copiar la salida a `CHANGELOG.md`, debajo del encabezado, como una sección `## [1.2.0] - AAAA-MM-DD`.
2. Editar: reescribir títulos poco claros para alguien que no vio el PR, quitar ruido y, si hay migraciones o cambios incompatibles, agregar instrucciones para actualizar.
3. Llevarlo a la rama:
   - **Release:** PR `docs/changelog-v1-2-0` → `release/v1.2.0` con título `docs: changelog v1.2.0` (la rama de release está protegida).
   - **Hotfix:** commit directo en la rama `hotfix/*` (`docs: changelog v1.2.1`), que no está protegida.

### Tag y release en GitHub

Después del merge a `master`, crear el tag y el release usando **la sección del changelog** como notas:

```bash
git checkout master
git pull origin master
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# Extrae la sección [1.2.0] de CHANGELOG.md y la usa como notas del release
awk '/^## \[1\.2\.0\]/{f=1; next} /^## \[/{f=0} f' CHANGELOG.md > "$TEMP/notas.md"
gh release create v1.2.0 --title "v1.2.0" --notes-file "$TEMP/notas.md"
```

---

### Backport a `develop`

Al mergear un `release/*` o `hotfix/*` en `master`, el workflow **Backport PR** abre automáticamente un PR `chore/backport-<n>-to-develop` hacia `develop`.

Los PRs creados por GitHub Actions **no disparan otros workflows**, por lo que el check obligatorio **Validar rama origen** queda pendiente. Para ejecutarlo:

1. Abrir el PR de backport.
2. **Close pull request** y, a continuación, **Reopen pull request** (o `gh pr close <n> && gh pr reopen <n>`).
3. Esperar el check en verde, actualizar la rama si hace falta y mergear con **Create a merge commit**.

Si el backport tiene conflictos, el workflow lo informa en el PR original; en ese caso, crear la rama `chore/backport-<n>-to-develop` a mano desde `develop`, hacer `git cherry-pick` de los commits y abrir el PR.

---

### Flujo visual

```
develop
  ├── feature/cierre-de-caja        ─┐
  ├── fix/sync-venta-duplicada       │ PR (squash) → develop
  ├── docs/modelo-de-datos           │
  └── chore/actualizar-fastapi      ─┘

develop
  └── release/v1.2.0                ─── PR (merge commit) → master ── tag v1.2.0
                                         └─ backport automático → develop

master
  └── hotfix/refresh-token-expirado ─── PR (merge commit) → master ── tag v1.2.1
                                         └─ backport automático → develop
```

---

## Resumen de reglas

| Regla | Detalle |
|-------|---------|
| Partir siempre de la rama base actualizada | `git pull` antes de crear la rama |
| Nombre de rama válido | Validado por **Branch Policy** |
| Commits con Conventional Commits | También el título del PR |
| PR en borrador al primer commit | Visibilidad desde el inicio |
| Rama actualizada antes del merge | Exigido por la protección de `develop` y `master` |
| Squash hacia `develop`; merge commit hacia `master` | Mantiene historias compatibles entre ramas |
| Cambios en `release/*` solo por PR | Desde `fix/*`, `docs/*` o `chore/*`; rama protegida y validada por **Branch Policy** |
| Changelog en cada release y hotfix | Generado desde las etiquetas de los PRs, editado y commiteado en la rama de release/hotfix |
| Release y hotfix terminan con tag | `vX.Y.Z` + release en GitHub con las notas del changelog |
| Backport a `develop` tras cada release o hotfix | Cerrar y reabrir el PR automático para ejecutar el check |
| Borrar la rama al cerrar el PR | Remota automática; local a mano |
