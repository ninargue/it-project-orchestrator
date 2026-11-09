<!--
Template para PRs de release/* o hotfix/* hacia master.
Se usa agregando ?template=release.md a la URL de creación del PR:
https://github.com/ninargue/registro-venta-micro/compare/master...release/X.Y.Z?template=release.md
-->

## 🚀 Release

- **Versión:** <!-- X.Y.Z -->
- **Tipo:** <!-- release / hotfix -->
- **Fecha prevista de despliegue:**

## 📦 Contenido
<!-- PRs e issues incluidos -->
- #
- #

## 🗄️ Base de datos
- [ ] La release **no** incluye migraciones
- [ ] Las migraciones de Alembic se aplicaron y probaron en **staging**
- [ ] Las migraciones son compatibles con la versión anterior del backend (despliegue sin interrupción)
- [ ] Las políticas RLS de tablas nuevas o modificadas están activas en staging
- [ ] Hay **backup** reciente de producción y se verificó que se puede restaurar

## ✅ Verificación en staging
- [ ] CI en verde (lint, tests, pruebas de aislamiento entre tenants)
- [ ] Flujo de venta probado en celular y PC, **con y sin conexión** (incluida la sincronización)
- [ ] Apertura y cierre de caja probados
- [ ] Sin errores nuevos en el monitoreo de staging

## 📝 Changelog
- [ ] `CHANGELOG.md` tiene la sección `## [X.Y.Z] - AAAA-MM-DD`, generada desde las etiquetas de los PRs y revisada
- [ ] Si hay migraciones o cambios incompatibles, la sección incluye instrucciones para actualizar

## 🔁 Plan de rollback
<!-- Cómo volver atrás si algo falla: versión anterior de la imagen, migración de downgrade, flags a desactivar -->

## ⚙️ Configuración y secretos
- [ ] Variables de entorno o secretos nuevos cargados en producción
- [ ] Feature flags definidos (p. ej. funciones de IA)

## 📝 Después del merge
- [ ] Se creó el tag `vX.Y.Z` y el release en GitHub con la sección del changelog como notas
- [ ] El backport automático a `develop` se creó y mergeó
- [ ] Monitoreo de producción revisado tras el despliegue
