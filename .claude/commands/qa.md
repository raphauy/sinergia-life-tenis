---
description: Corre QA de UI sobre el desarrollo actual. Sin args → cambios sin commitear. Con "fase N" (incluye decimales como "3.5", opcional prefijo de feature como "escalera fase 2") → fase puntual del roadmap.
argument-hint: "[fase N | nada]"
---

Lanzá el subagent `qa-ui` pasándole `$ARGUMENTS` tal cual (puede estar vacío). Esperá a que termine.

Cuando devuelva el resumen, mostrá al usuario solo la línea final que retornó (formato: `QA Fase N ciclo M: X ✓, Y ✗, Z 🔧 — docs/qa/fase-N.md`). No ejecutes el QA vos mismo, no edites código, no abras el browser. El subagent hace todo el trabajo en su contexto aislado.

Si el subagent reporta fallos (`✗`), recordale al usuario que puede pedirte fixear con `/qa-fix` leyendo el reporte.
