---
description: Crea el plan.md técnico de una feature a partir de su spec
agent: build
---

Redacta el plan técnico de la feature specs/$1. No escribas código; solo puedes crear specs/$1/plan.md.

Lee docs/constitution.md y specs/$1/spec.md. Revisa también la estructura actual del proyecto (solo nombres de archivos; abre solo los que necesites).

El plan debe respetar la constitución y cubrir todos los RF. Estructura:
1. Archivos que se crean o modifican, con la responsabilidad de cada uno.
2. Funciones puras de lógica necesarias (firma y propósito). Las dependencias como la fecha "hoy" entran como parámetro.
3. Algoritmos no triviales en pseudocódigo.
4. Cómo se pinta en la interfaz.
5. Decisiones técnicas justificadas, con la alternativa descartada y por qué.
6. Estrategia de tests con node --test (qué casos prueba cada función).
7. Tabla de cobertura: cada RF-n y la parte del plan que lo cubre.

Marca en cada parte qué RF cubre. Si la spec no basta para decidir algo, márcalo como [NECESITA ACLARACIÓN] en lugar de suponer.
Al terminar, dime la ruta creada y detente. No hagas la lista de tareas.