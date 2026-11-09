# Orquestador

Punto de entrada único para correr el ciclo completo cuando una sola persona
(o el agente) tiene acceso completo al proyecto.

Invoca en secuencia:
1. `product-discovery` (Pasos 0–8)
2. `stories-to-tickets` (Pasos 9–14)

**Regla de oro:** el orquestador es el único responsable de commits y pushes.
Ningún subagente hace commits. El orquestador confirma con el usuario antes de
cada operación git.

> Implementación en desarrollo.
