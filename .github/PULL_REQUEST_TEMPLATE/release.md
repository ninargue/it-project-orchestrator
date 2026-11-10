<!--
Template para PRs de release/* o hotfix/* hacia master.
Se usa agregando ?template=release.md a la URL de creación del PR:
https://github.com/ninargue/it-project-orchestrator/compare/master...release/X.Y.Z?template=release.md
-->

## 🚀 Release

- **Versión:** <!-- X.Y.Z -->
- **Tipo:** <!-- release / hotfix -->
- **Fecha prevista de despliegue:** 

## 📦 Contenido
<!-- PRs e issues incluidos -->
- #
- #

## ✅ Verificación y Calidad
- [ ] CI en verde (lint, validación de ramas, etiquetado)
- [ ] Prueba funcional de flujos completada exitosamente
- [ ] Gobernanza de subagentes (SSOT) y pausas interactivas respetadas
- [ ] Convenciones de nomenclatura canónica verificadas

## 📝 Changelog
- [ ] `CHANGELOG.md` contiene la sección `## [X.Y.Z] — AAAA-MM-DD` con descripciones breves y concisas
- [ ] Se actualizó la versión en `plugin.json`

## 🔁 Plan de rollback
<!-- Cómo volver atrás si algo falla: revert de commit / re-tag anterior -->

## 📝 Después del merge
- [ ] Se creó el tag `vX.Y.Z` y el release en GitHub con las notas del changelog
- [ ] `develop` y ramas activas sincronizadas con master tras el merge
