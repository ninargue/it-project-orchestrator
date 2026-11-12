<!--
¿Es un PR de release/* o hotfix/* hacia master? Usa el template de release
agregando ?template=release.md a la URL de creación del PR:
https://github.com/ninargue/it-project-orchestrator/compare/master...release/X.Y.Z?template=release.md
-->

## 📋 Descripción
<!-- Explica brevemente qué hace este PR y por qué es necesario -->

## 🔗 Issue relacionado
Closes #<!-- número del issue -->

## 🏷️ Tipo de cambio
- [ ] 🐛 Bug fix
- [ ] ✨ Nueva funcionalidad
- [ ] ♻️ Refactor
- [ ] 📝 Documentación
- [ ] ⚙️ Configuración / Infraestructura

## 🔧 Cambios realizados
<!-- Lista los cambios principales -->
- 
- 

## 🌿 Rama base
<!-- ¿Hacia dónde va este PR? -->
- [ ] `develop`
- [ ] `master`
- [ ] otra, si corresponde

## ✅ Checklist
- [ ] Se probó manualmente el flujo o comando modificado
- [ ] No se incluyen credenciales, secretos ni archivos temporales
- [ ] El nombre del branch sigue la convención Git Flow (`feature/`, `fix/`, `hotfix/`, `chore/`, `refactor/`, `docs/`, `test/`, `release/`)
- [ ] Título del PR sigue Conventional Commits (`feat(...)`, `fix(...)`, etc.)

### 🤖 Gobernanza de Agentes y Skills (si aplica)
- [ ] Se respetó la Única Fuente de Verdad (SSOT en `agents/`) sin duplicar prompts
- [ ] Se mantuvieron los límites duros de fin de turno (`🛑 FIN DE TURNO OBLIGATORIO`) en pausas
- [ ] Rutas de persistencia alineadas con la estructura canónica (`docs/prd/`, `docs/backlog/<NNNN>-.../`)
- [ ] (Si aporta cambios al usuario) Se registró el cambio neto en `## [Unreleased]` de `CHANGELOG.md` (la versión se consolida en `release/*` o `hotfix/*`)

## 💬 Notas adicionales
<!-- Contexto extra, decisiones tomadas, trade-offs -->
