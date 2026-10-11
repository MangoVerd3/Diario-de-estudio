---
description: Crea el spec.md de una nueva feature
agent: build
---

Redacta la especificación de una feature del Diario de Estudio. No escribas código; solo puedes crear el spec.md.

Lee solo docs/constitution.md.
Feature: specs/$1-$2/spec.md
Idea: $ARGUMENTS (ignora las dos primeras palabras: son el número y el nombre)

Proceso:
1. Hazme hasta 5 preguntas, UNA cada vez, esperando mi respuesta (casos límite, errores, qué queda fuera). Lo que siga dudoso va como [NECESITA ACLARACIÓN]. No crees archivos hasta terminar.
2. Crea la ruta indicada arriba con: contexto y objetivo, usuarios, historias de usuario, requisitos funcionales RF-n con criterios de aceptación EARS en español, requisitos no funcionales, casos límite, fuera de alcance, criterios de finalización, dudas abiertas.
3. Dime la ruta creada y detente. No hagas el plan.

Reglas: solo el QUÉ y el POR QUÉ, sin stack, arquitectura ni archivos de código.
EARS ejemplo: "Cuando el usuario registre una sesión, el sistema deberá sumar 1 a la racha si es un día nuevo."