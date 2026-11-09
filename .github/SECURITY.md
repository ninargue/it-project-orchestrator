# Política de seguridad

**registro-venta-micro** almacena datos de ventas, stock y caja de múltiples negocios en una base compartida. El aislamiento entre negocios (tenants) es la propiedad de seguridad más importante del sistema.

## Versiones con soporte

El proyecto está en desarrollo previo a su primera versión estable. Solo recibe correcciones de seguridad la última versión de la rama `master`.

| Versión | Soporte |
|---------|---------|
| `master` (última) | ✅ |
| Anteriores | ❌ |

## Cómo reportar una vulnerabilidad

**No abras un issue público.** Usa el reporte privado de GitHub:

👉 [Reportar una vulnerabilidad](https://github.com/ninargue/registro-venta-micro/security/advisories/new) (pestaña *Security* → *Report a vulnerability*).

Incluye, en lo posible:

- Descripción del problema y su impacto.
- Pasos para reproducirlo (endpoint, payload, rol del usuario).
- Versión, branch o commit afectado.
- Si lo conoces, una propuesta de mitigación.

No uses datos reales de terceros para demostrar el problema: crea tus propios negocios y usuarios de prueba.

## Qué esperar

- Acuse de recibo del reporte.
- Evaluación de la criticidad y, si se confirma, una corrección priorizada según su impacto.
- Publicación de un aviso de seguridad (GitHub Security Advisory) una vez corregido, con crédito a quien lo reportó si así lo desea.

## Alcance

Se consideran especialmente relevantes:

- Acceso o modificación de datos de **otro negocio** (fallas de aislamiento multitenant / RLS).
- Escalada de privilegios entre roles (p. ej. un cajero que accede a costos o reportes del dueño).
- Omisión de autenticación, robo o reutilización de tokens.
- Inyección (SQL, XSS) o exposición de secretos.
- Manipulación de ventas, stock o caja que eluda la validación del servidor.
- Abuso de las funciones de IA para acceder a datos fuera del propio negocio.

Fuera de alcance:

- Ataques de denegación de servicio por volumen.
- Ingeniería social o ataques físicos.
- Vulnerabilidades en dependencias sin un vector de explotación demostrable en este proyecto (repórtalas al proyecto correspondiente).
