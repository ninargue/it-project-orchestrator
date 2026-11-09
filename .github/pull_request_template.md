<!--
¿Es un PR de release/* o hotfix/* hacia master? Usa el template de release
agregando ?template=release.md a la URL de creación del PR:
https://github.com/ninargue/registro-venta-micro/compare/master...release/X.Y.Z?template=release.md
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
- [ ] Lint y tests en verde en **backend (FastAPI)** y **frontend (PWA)**
- [ ] Se probó manualmente el flujo principal
- [ ] No se incluyen credenciales ni archivos `.env`
- [ ] El nombre del branch sigue la convención (`feature/`, `fix/`, `hotfix/`, `chore/`, `refactor/`, `docs/`, `test/`, `release/`)

### 🏢 Si toca datos de negocio (multitenant)
- [ ] Toda tabla operativa nueva tiene `tenant_id` **NOT NULL**, política **RLS** activa y `FORCE ROW LEVEL SECURITY`
- [ ] Las FK entre tablas operativas son compuestas `(tenant_id, id)`
- [ ] Hay prueba de aislamiento: un usuario de otro tenant no puede leer ni modificar el recurso

### 🗄️ Si toca el esquema
- [ ] La migración la generó **Alembic** y se revisó el script generado
- [ ] Montos en `numeric(12,2)`, cantidades en `numeric(12,3)`, fechas en `timestamptz`
- [ ] Un `NOT NULL` sobre una tabla con datos se verificó antes contra filas nulas
- [ ] Se actualizó el diccionario de datos en `docs/04-modelo-de-datos/`

### 📶 Si toca ventas, caja o sincronización
- [ ] Las operaciones creadas offline siguen siendo **idempotentes** (UUID de cliente)
- [ ] El cálculo de totales y stock sigue siendo determinista (sin IA en el flujo transaccional)

### 🔍 Si cambia comportamiento
- [ ] **Ninguna aserción sobre la respuesta fue modificada.** Si hubo que tocar una, el PR cambia comportamiento y va separado
- [ ] Ninguna tabla ni dato se borró sin pedido explícito
- [ ] Si cambia una decisión de diseño, se agregó o actualizó el ADR correspondiente

## 📸 Screenshots (si aplica)
<!-- Agrega capturas de pantalla si hay cambios visuales (idealmente celular y PC) -->

## 💬 Notas adicionales
<!-- Contexto extra, decisiones tomadas, deuda técnica pendiente -->
