# Roadmap

Índice de producto de **alto nivel**: las features/épicas y el orden en que se encaran. NO lleva el detalle por fase.

El plan ejecutable de cada feature vive en `docs/PRPs/<feature>-prp.md` + `docs/PRPs/<feature>-roadmap.md` (ahí están las fases, sin checkboxes). El MVP ya construido está documentado en [`docs/prd.md`](../prd.md).

## Features

- **MVP — Sinergia Life Tenis** (construido) — spec en [`docs/prd.md`](../prd.md). Gestión de torneos: torneos/categorías/grupos, importación CSV, partidos (PENDING→CONFIRMED→PLAYED), resultados, bracket de eliminación, ranking, vista pública.
- **La Escalera** (liga permanente — fase 3 ✅ terminada) — PRP en [`docs/PRPs/la-escalera-prp.md`](../PRPs/la-escalera-prp.md) + roadmap en [`docs/PRPs/la-escalera-roadmap.md`](../PRPs/la-escalera-roadmap.md). Borradores originales en [`docs/new-features/`](../new-features/). Decisión arquitectónica clave en [ADR 0001](../adr/0001-match-polimorfico-escalera.md). Ranking ELO único; 4 fases: ~~fundación~~ → ~~retos+ELO~~ → ~~compromiso~~ → gamificación.
