---
description: Valida que la implementación cumple la spec (solo verifica, no corrige)
agent: build
---

Valida la feature specs/$1. No modifiques código ni archivos: solo verifica e informa.

Lee specs/$1/spec.md y specs/$1/tasks.md.

1. Ejecuta node --test una vez y guarda el resultado.
2. Recorre el spec requisito por requisito (RF-n). Para cada uno indica:
   - Test que lo cubre (archivo y nombre) y su resultado real.
   - Si es de interfaz y no se puede testear con node --test, verifícalo con Chrome DevTools, incluida la vista móvil, y describe lo que viste.
3. Si no puedes ejecutar o verificar algo (por ejemplo, no tienes acceso a Chrome DevTools), marca ese RF como NO VERIFICADO. Nunca lo des por cumplido sin comprobarlo.
4. Comprueba cada criterio de finalización del spec.
5. Veredicto final: CUMPLIDA o NO CUMPLIDA, y la lista de RF sin cubrir, fallidos o no verificados.

Formato: tabla con columnas RF | Test o verificación | Resultado (OK / FALLA / SIN COBERTURA / NO VERIFICADO) | Observación.