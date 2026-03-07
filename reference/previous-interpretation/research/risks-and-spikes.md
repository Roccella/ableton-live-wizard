# Risks and Spikes

Date: 2026-03-05

## Main Risks
- UX risk: el asistente interrumpe más de lo que ayuda durante flujo creativo.
- Reliability risk: acciones automáticas sobre Live pueden producir cambios no deseados.
- Integration risk: diferencias entre versiones Live/Max/OS rompen compatibilidad.
- Scope risk: querer resolver generación musical completa en v1 diluye foco y tiempo.

## Proposed Spikes

### Spike 1 — Session Control Safety Loop
- Objective: validar flujo `plan -> preview -> apply -> undo` para 5 acciones comunes.
- Success criteria:
  - 100% de acciones con preview legible antes de aplicar.
  - Undo funcional para todas las acciones probadas.
  - Tiempo total por acción <= 3 segundos en sesión simple.

### Spike 2 — Prompt to MIDI Actionability
- Objective: medir si prompts estructurados producen ediciones MIDI útiles y predecibles.
- Success criteria:
  - Al menos 70% de prompts ejecutan una transformación correcta sin corrección manual.
  - Errores reportados con mensajes accionables.

### Spike 3 — Integration Surface Benchmark
- Objective: comparar esfuerzo/latencia entre Max for Live API directo vs capa OSC externa.
- Success criteria:
  - Matriz comparativa con tiempo de implementación, latencia y robustez.
  - Recomendación de superficie primaria para MVP.

## Recommendation Before Setup
- Ejecutar Spike 1 primero (reduce riesgo de producto y seguridad).
- Ejecutar Spike 3 en paralelo si hay tiempo.
- Dejar Spike 2 para cuando ya exista loop seguro de control.

## Exit Criteria from Research
- Usuario objetivo inicial confirmado.
- Superficie UX inicial definida.
- Dos spikes priorizados para la primera iteración técnica.
