---
description: Crea el tasks.md (lista de tareas) a partir del plan
agent: build
---

Redacta la lista de tareas de specs/$1. No escribas código; solo puedes crear specs/$1/tasks.md.

Lee docs/constitution.md, specs/$1/spec.md y specs/$1/plan.md. No los modifiques ni añadas requisitos nuevos.

Tamaño: entre 8 y 16 tareas. Agrupa hasta 3 funciones relacionadas en una sola tarea. Cada tarea debe poder terminarse y probarse en una sola sesión.

Interfaz: corta por funcionalidad completa (HTML, CSS y JS juntos), no por capas. Cada tarea debe terminar con algo visible o comprobable.

Formato de cada tarea (exactamente estos 6 campos, máximo 2 líneas por campo, sin campos extra ni notas):

- [ ] T1: título corto
  - Archivos: los que crea o modifica
  - Cubre: RF-n (o «—»)
  - Depende de: T-n o «ninguna»
  - Tests: casos a probar en una frase («no aplica» si es solo interfaz)
  - Hecha cuando: un criterio verificable

Reglas:
- Tests antes que código en cada tarea.
- Todos los RF deben quedar cubiertos por alguna tarea.
- No crees tareas de verificación final ni de documentación: eso lo hace /validator.
- Si el plan no basta para decidir algo, ponlo al final como [NECESITA ACLARACIÓN] en vez de inventarlo.

Antes de terminar, cuenta las tareas: si hay más de 16, agrúpalas.
Cierra con una tabla RF → tareas, dime la ruta creada y detente. No implementes nada.