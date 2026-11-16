# Runbook: Preparación de Copia de Producción (Ejecutado por Persona)

> [!CAUTION]
> **El agente nunca accede a producción ni lee copias sin anonimizar.** Los archivos `*.dump`, `*.bak` y directorios `backups/` están bloqueados por hook (`hooks/guards/destructive.js`). Todos los pasos de restauración y anonimización los ejecuta **una persona**.

## 1. Base intermedia inaccesible para el agente
1. Restaurar el respaldo en una instancia/base intermedia temporal (`DB_STAGING_SANITIZE_URL`) **sin** exponer esa URL al entorno del agente.
2. Nunca restaurar directamente sobre `DB_DEV_URL` ni `DB_TEST_URL`.

## 2. Reemplazo determinista de datos personales (PII)
1. Ejecutar el script de anonimización sobre la base intermedia (reemplazar nombres, emails con dominio `.invalid`, teléfonos sintéticos, documentos, tokens y secretos; rotar claves/tokens).
2. Truncar o limpiar tablas de auditoría/sesiones con tokens activos.

## 3. Auditoría de fuga residual (solo conteos)
1. Si se necesita verificar que no quedaron datos reales sin reemplazar, el agente puede redactar una consulta SQL que devuelva **únicamente conteos agregados** (`SELECT COUNT(*) ... WHERE email NOT LIKE '%@example.invalid'`), nunca filas ni muestras de texto.
2. **Una persona** ejecuta esa consulta contra la base intermedia y comparte solo el número resultante.
3. Solo cuando todos los conteos residuales sean `0`, exportar la copia sanitizada hacia desarrollo.
