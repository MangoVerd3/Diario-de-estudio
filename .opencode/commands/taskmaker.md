---
description: Crea el tasks.md (lista de tareas) a partir del plan
agent: build
---

Redacta la lista de tareas de specs/$1. No escribas código; solo puedes crear specs/$1/tasks.md.

Lee docs/constitution.md, specs/$1/spec.md y specs/$1/plan.md.

Divide el plan en tareas pequeñas, ordenadas y verificables (una función o un archivo por tarea). Formato de cada una:

- [ ] T1: título corto
  - Archivos: los que crea o modifica
  - Cubre: RF-n
  - Depende de: T-n o "ninguna"
  - Tests: qué casos se prueban primero
  - Hecha cuando: criterio verificable

Reglas: tests antes que código en cada tarea; ninguna tarea debe cambiar más de un archivo de lógica y uno de tests; todos los RF del spec deben quedar cubiertos por alguna tarea.
Al terminar, dime la ruta creada y detente. No implementes nada.