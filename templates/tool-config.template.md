# Configuración de herramienta — Project Orchestrator

> Este archivo es generado automáticamente por el plugin en el Paso 0.
> Para configurar, deja solo la opción deseada en cada campo y elimina o comenta el resto.
> El plugin leerá este archivo antes de materializar issues (Paso 14).

---

## 1. Tipo de Proyecto
# Deja activa solo una opción:
tipo_proyecto: greenfield    # Proyecto nuevo desde cero
# tipo_proyecto: brownfield  # Código o base existente a explorar

---

## 2. Herramienta de Issues
# Deja activa solo una opción:
herramienta_issues: github   # GitHub Issues
# herramienta_issues: linear # Linear
# herramienta_issues: otra   # Indicar nombre de la herramienta

---

## 3. Método de Creación de Issues
# Deja activa solo una opción:
metodo_issues: cli           # CLI oficial instalada (ej: gh CLI)
# metodo_issues: mcp         # Servidor MCP conectado en la sesión

---

## 4. Metodología del Equipo
# Deja activa solo una opción:
metodologia_equipo: scrum    # Scrum (épicas como milestones/proyectos y sprints)
# metodologia_equipo: kanban # Kanban (flujo continuo con labels de estado)

---

## 5. GitHub Projects v2 y Vistas (Opcional — solo para GitHub)
# Indica si deseas crear/vincular un GitHub Project con vistas nativas (Roadmap/Kanban/Backlog):
crear_github_project: false  # true para crear/vincular y armar vistas según metodología

---

## 6. Estrategia de Ramas (Git Flow)
# Deja activa solo una opción:
estrategia_git: gitflow-strict     # master + develop + release/* + hotfix/*
# estrategia_git: gitflow-standard  # master + develop directo con sincronización
# estrategia_git: github-flow       # solo main / trunk-based

---

## Metadatos
fecha_configuracion: YYYY-MM-DD
configurado_por: <tu-nombre-o-rol>
