---
description: Revisión QA de un spec.md o plan.md (solo detecta, no corrige)
agent: plan
---

Revisa specs/$1/$2.md. Lee también docs/constitution.md. Si $2 es "plan", lee también specs/$1/spec.md. No modifiques archivos ni propongas soluciones: solo detecta.

Lista numerada por categoría, citando el RF-n o la sección afectada. Si una categoría no tiene hallazgos, escribe "Ninguno".

1. Ambigüedades restantes
2. Contradicciones internas
3. Casos límite no cubiertos
4. Conflictos con docs/constitution.md
5. Solo si es plan: requisitos del spec sin cubrir o que contradice el spec