# Constitución — Diario de Estudio

1. **Stack mínimo**: solo HTML, CSS y JS vanilla en `index.html`, `styles.css` y
   `app.js`. Añadir cualquier dependencia exige antes cambiar este principio.
2. **La spec manda**: `AGENTS.md` y las especificaciones de `specs/` definen el
   comportamiento; toda regla nueva se escribe primero ahí y el código se
   actualiza en el mismo paso.
3. **Lógica separada de la interfaz**: racha, semana y días estudiados son funciones
   puras sobre los datos; el DOM solo se toca al renderizar o en listeners.
4. **Pruebas sin instalar nada**: se verifica en el navegador, a mano o con
   Chrome DevTools si el usuario lo aprueba. Ningún framework de test. La
   lógica pura podrá verificarse además con el runner integrado de Node
   (`node --test`), sin instalar nada.
5. **Los datos del usuario no se tocan**: todo vive en `localStorage` y es
   exportable; ante datos antiguos o corruptos, normalizar, nunca perder.
6. **En español**: interfaz, comentarios y docs en español;
   El codigo tiene que ser legible y humanamente manejable.
