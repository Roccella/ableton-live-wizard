# Project Journal — Ableton Live Wizard

## Origin
Proyecto iniciado para construir una capa de asistencia sobre Ableton Live que reduzca fricción entre idea musical y ejecución técnica.

Contexto disponible hasta ahora:
- Se pidió explícitamente comenzar con research antes de cualquier setup.
- No hay todavía narrativa completa del origen personal (motivación, dolor principal, historia de uso).

Pendiente de completar con tu input:
- Qué problema te frustra más hoy en Live.
- Qué tipo de usuario querés priorizar primero.
- Qué resultado concreto te haría decir "esto ya aporta valor" en una semana.

## Key Decisions

### 2026-03-05 — Hacer research primero y diferir setup
**Context**: Repo vacío y solicitud explícita de investigar antes de estructurar.
**Decision**: Ejecutar fase de research completa (idea, competencia, viabilidad, riesgos, spikes) antes de `setup-project`.
**Outcome**: Se creó base canónica (`AGENTS.md`, `research/`) y se consolidó una recomendación de dirección inicial.

### 2026-03-05 — Enfoque MVP en control asistido de sesión
**Context**: El espacio "AI music" está saturado de generadores, pero hay hueco en acciones precisas/reversibles dentro de Live.
**Decision**: Priorizar co-pilot orientado a acciones concretas dentro del DAW (no generación total de track como v1).
**Outcome**: Se definieron riesgos técnicos y spikes para validar interfaz de control y latencia percibida.

## Milestones

### Research baseline — 2026-03-05
- Competencia y ecosistema relevados.
- Viabilidad técnica inicial documentada.
- Riesgos y spikes definidos para reducir incertidumbre antes de setup.

## Learnings
- La oportunidad diferencial no está en "más generación", sino en "mejor control y flujo" dentro de Live.
- Integraciones comunitarias (OSC/MCP) aceleran prototipado, pero requieren capa de seguridad y validación robusta.
- Definir el usuario inicial impacta más que elegir stack en esta etapa.

## Explored Alternatives
- Enfoque "generador full song" como v1: descartado por alto riesgo de calidad percibida y baja controlabilidad inicial.
- Enfoque puramente externo al DAW: descartado por peor ergonomía de uso en flujo real de producción.

## Article Seeds
- "Por qué un co-pilot de Ableton necesita control antes que creatividad generativa".
- "Qué aprendimos comparando herramientas AI para productores en 2026".
