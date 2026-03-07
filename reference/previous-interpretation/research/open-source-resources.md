# Open Source Resources

Date: 2026-03-05

## High-signal repositories

### AbletonOSC
- Repo: https://github.com/ideoforms/AbletonOSC
- Señal: repositorio maduro para control OSC de Live, con comunidad activa.
- Tracción observada: ~2.6k stars (consulta 2026-03-05).
- Uso potencial: capa de control remoto para comandos del wizard y telemetría de estado.

### pylive
- Repo: https://github.com/ideoforms/pylive
- Señal: cliente Python para interactuar con Live, útil para scripting rápido y prototipos.
- Tracción observada: ~255 stars (consulta 2026-03-05).
- Uso potencial: prototipado de pipelines y utilidades de test para acciones sobre sesión.

### ableton-mcp
- Repo: https://github.com/ahujasid/ableton-mcp
- Señal: puente MCP para controlar Ableton con agentes/LLMs.
- Tracción observada: ~2.3k stars (consulta 2026-03-05).
- Caveat explícito del repo: integración third-party, no oficial de Ableton.
- Uso potencial: referencia de diseño para comandos de alto nivel + capa de seguridad.

## Selection Criteria for MVP
- Priorizar proyectos con mantenimiento reciente y documentación clara.
- Validar licencia/compatibilidad antes de incorporar código o patrones.
- Tratar repos comunitarios como aceleradores de aprendizaje, no como cimiento crítico.

## Adopt / Avoid (initial)
- **Adopt for learning**: AbletonOSC + docs de Live API para mapear comandos MVP.
- **Adopt selectively**: ideas de interfaz de comando en MCP, sin acoplar core al protocolo.
- **Avoid as hard dependency in v1**: componentes sin estrategia clara de versionado/seguridad.

## Sources
- https://github.com/ideoforms/AbletonOSC
- https://github.com/ideoforms/pylive
- https://github.com/ahujasid/ableton-mcp
