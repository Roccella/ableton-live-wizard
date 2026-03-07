# Technical Feasibility Research

Date: 2026-03-05

## What was researched
- Superficies oficiales para interactuar con Live.
- Capacidades de Max for Live Live API.
- Caminos de integración externa (OSC/MCP) y sus tradeoffs.

## Findings
- Max for Live + Live API proveen superficie oficial para inspeccionar/controlar objetos de Live (tracks, clips, devices, params).
- Node for Max habilita puentes JS/procesamiento externo dentro del ecosistema Max, útil para capas de inteligencia y orquestación.
- OSC permite control remoto rápido para prototipos y automatizaciones, con buen ecosistema comunitario.
- Integraciones MCP sobre Live son viables para orquestación con LLMs, pero no son oficiales de Ableton y requieren hardening de seguridad/permisos.

## Feasibility Assessment
- **MVP co-pilot de sesión**: alta viabilidad.
- **Generación musical de alta calidad 100% automática (v1)**: viabilidad media-baja para estándar de producto.
- **Automatización segura en proyectos reales**: viable con capa de guardrails (preview, confirm, undo).

## Constraints and Caveats
- Dependencia de versión de Live/Max y compatibilidad por OS.
- Riesgo de latencia/UX si la capa de IA interrumpe el flujo creativo.
- Necesidad de permisos y límites claros para acciones destructivas.

## Recommended Technical Direction (pre-setup)
1. Prototipo controlable sobre Live API/Max for Live para acciones atómicas.
2. Capa de orquestación externa opcional (OSC/MCP) desacoplada del núcleo.
3. Mecanismo de "plan -> preview -> apply" para minimizar errores en sesión.

## Sources
- https://docs.cycling74.com/max8/vignettes/live_api_overview
- https://docs.cycling74.com/max8/vignettes/nodeformax
- https://docs.cycling74.com/max8/vignettes/live_object_model
- https://github.com/ideoforms/AbletonOSC
- https://github.com/ahujasid/ableton-mcp
