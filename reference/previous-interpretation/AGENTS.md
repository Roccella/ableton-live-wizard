# Ableton Live Wizard

## General Idea
Crear un "wizard" para Ableton Live que acelere tareas de producción musical con asistencia inteligente: generación/edición de clips MIDI, manipulación de tracks/dispositivos, workflows guiados y sugerencias contextuales dentro del DAW.

## Planned Features
- Asistente para crear y editar clips MIDI desde prompts estructurados.
- Acciones de sesión: crear tracks/escenas, disparar clips, ajustar tempo y parámetros globales.
- Sugerencias de sonido y samples según contexto musical (key/tempo/estilo).
- Plantillas de workflows (arranque de idea, variación, arreglo rápido, sound design).
- Modo "safe apply" para previsualizar cambios antes de aplicarlos.

## Decisions Made (Research)
- Empezar por una capa de control sobre Live usando APIs existentes (Max for Live / Live API / Remote Script) antes de explorar integración profunda no documentada.
- Priorizar un MVP "co-pilot de sesión" (acciones concretas y reversibles) en lugar de un generador full-track end-to-end.
- Diseñar el producto para Live 12.3+ como baseline inicial por ecosistema e integraciones recientes.
- Tratar integraciones de terceros (MCP/community tools) como referencia y no como dependencia rígida del core.

## Pending Decisions
- Perfil de usuario inicial: productor principiante, intermedio o power user.
- Superficie UX inicial: Max for Live device, app companion externa o híbrido.
- Nivel de autonomía del asistente: comandos atómicos vs "macro tareas" con múltiples pasos.
- Estrategia de recomendación musical: reglas + heurísticas, modelos locales o servicios remotos.
- Política de privacidad/telemetría y manejo de proyectos del usuario.

## Research Scope Boundaries
- No se definió stack final ni arquitectura definitiva (se define en `setup-project`).
- No se escribió código de producto en esta fase.

## Runtime
- Runtime objetivo actual: `codex`.
- Fase activa: `research`.
