---
description: Lee el reporte de QA. Si hay ✗, fixea y marca 🔧. Si todo está verde, commitea la fase + reporte. Sin args usa el reporte más reciente.
argument-hint: "[fase N | nada]"
---

Sos el agente desarrollador. Tu tarea es procesar el reporte de QA del tester (`qa-ui`).

## Paso 1 — Localizar el reporte

- Si `$ARGUMENTS` contiene `"fase N"` o solo `"N"` (incluye decimales como `3.5`) → leé `docs/qa/fase-N.md`.
- Si está vacío → el reporte más reciente bajo `docs/qa/fase-*.md` (más reciente por mtime). Si no hay ninguno, mostrá `No hay reportes de QA. Corré /qa primero.` y terminá.

## Paso 2 — Diagnóstico

Leé el reporte completo y contá ítems por estado:

- `✗ falla`
- `🔧 fix listo, re-testear`
- `pendiente`
- `✓ pasa`
- `✅ pasa tras fix`

Decidí la rama:

| Estado del reporte | Acción |
|---|---|
| Hay al menos un `✗` | **Modo FIX** (paso 3) |
| No hay `✗` pero hay `🔧` | Mostrá `Hay N ítems en 🔧 esperando re-testeo. Corré /qa antes de seguir.` y terminá |
| No hay `✗` ni `🔧` pero hay `pendiente` | Mostrá `QA incompleto: N ítems pendientes. Corré /qa.` y terminá |
| Todos en `✓` o `✅` | **Modo COMMIT** (paso 4) |

## Paso 3 — Modo FIX

Para cada ítem en `✗`:

1. Leé `Error`, `Reproducción` y mirá la `Evidencia` (PNG con Read si hace falta).
2. Investigá código: Grep por nombres de funciones, archivos cambiados en `git diff --stat`, lectura de los archivos involucrados. Cruzá con la sección **Architecture** de `CLAUDE.md` (capas: actions → services → Prisma, validaciones Zod) si tocás patrones de capa. Si dudás de un patrón, el skill `/revisar` tiene la referencia.
3. Aplicá el **fix más chico que arregla el bug**. NO refactorices de paso. NO agregues features. NO toques cosas no mencionadas en el ítem.
4. Edit el reporte: cambiá el ítem a:
   ```
   - [ ] **<título del caso>**
     - Estado: 🔧 fix listo, re-testear
     - Fix: <qué cambiaste en 1 línea, ej. "Filtrar jugadores ya enrolados en searchChallengeable (ladder-service.ts:148)">
   ```
   El checkbox queda `[ ]` (no pasa hasta que el tester re-testee). Borrá las líneas `Error:`, `Reproducción:` y `Evidencia:` originales — el tester las regenera si vuelve a fallar.

Reglas:

- Si **no podés reproducir** el bug → dejá `Estado: ✗ falla` y agregá `- Comentario dev: no se reproduce — revisar manualmente`. NO inventes fix.
- Si el fix requiere **decisión de producto** (cambia UX, comportamiento esperado no es claro) → pará, mostrá al usuario el ítem y preguntá antes de tocar.
- Si fixear un ítem te lleva a tocar **>5 archivos** o introducir migraciones de schema (`prisma/schema.prisma` + `pnpm db:migrate`) → pará y avisá. Probablemente el bug indica algo más profundo que merece discusión.
- No toques ítems con estado `✓`, `✅`, `🔧` o `pendiente`.

Cuando termines TODOS los fixes:

```bash
pnpm typecheck
```

Si rompe:
- Identificá qué ítem causó el break (revertí los Edit con el contexto que tenés).
- Marcá ese ítem de vuelta como `✗ falla` con `- Comentario dev: el fix rompe typecheck — revisar`.
- Seguí con los demás si todavía hay otros aplicados sin romper.

Output al usuario:

```
Fixeados: N ítems en docs/qa/fase-X.md
- <ítem 1>: <fix de 1 línea>
- <ítem 2>: <fix de 1 línea>

Listo para /qa de nuevo.
```

## Paso 4 — Modo COMMIT

Todo verde. Cerramos la fase.

### 4.1 Verificación final

```bash
pnpm typecheck
pnpm build
```

Si cualquiera falla, parar y mostrar al usuario. NO commitear.

### 4.2 Actualizar estado del roadmap (si aplica)

Identificá la fase del reporte (del header `# QA Fase N — ...`) y a qué **feature** pertenece. Las fases viven en el roadmap de cada feature: `docs/PRPs/<feature>-roadmap.md` (hoy la feature activa es La Escalera → `docs/PRPs/la-escalera-roadmap.md`). Si el header no nombra la feature, deducila del git log reciente (`git log --oneline -10`) o del único roadmap con una fase no terminada.

En ese roadmap, ubicá la fase (`## Fase N — <título>`). Si su `**Estado:**` es `pendiente` o `en curso`, flipealo a `✅ terminada`:

- Edit en `docs/PRPs/<feature>-roadmap.md` (línea `**Estado:**` de esa fase).
- Edit en `docs/roadmap/README.md` (índice de alto nivel): el bullet de la feature lista las fases en prosa (ej. `~~fundación~~ → retos+ELO → compromiso → gamificación`). Tachá (`~~...~~`) la fase recién terminada y/o actualizá el `(... fase N ✅ terminada)`. Es prosa libre: si el patrón no es claro, no rompas — dejalo como está y comentalo en el output para que el usuario lo marque a mano.

Si la fase ya está `✅ terminada`, o está `pendiente` pero el reporte fue en modo uncommitted sobre trabajo que no cierra una fase del roadmap, no toques el roadmap. Comentalo en el output.

> Nota: el repo a veces marca el roadmap en un commit `docs:` aparte. Acá lo incluimos en el mismo commit de la fase para no fragmentar; si preferís separarlo, avisá.

### 4.3 Inspección de archivos a commitear

```bash
git status -s
```

Filtrá la lista. Marcá como **sospechosos** archivos que matcheen:

- `\.env`
- `secret|token|credential` en el path
- Archivos `>5MB` (vía `du -sh`)
- Archivos fuera de los paths esperados: `src/`, `prisma/`, `docs/`, `public/`, `scripts/`, `.claude/` (commands + agents versionados), root configs (`package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `eslint.config.*`, `components.json`, `.gitignore`, `README.md`, `CLAUDE.md`, `AGENTS.md`)
- Scripts de inspección de QA olvidados: `scripts/qa-inspect-*.ts` (el tester debió borrarlos; si aparecen, no los commitees)

Si hay sospechosos:
- Mostralos al usuario con la lista completa.
- Preguntá si proceder.
- Si dice no, abortar.

### 4.4 Stage explícito

Stage los archivos uno por uno (no `git add -A`):

```bash
git add <path1> <path2> ...
```

### 4.5 Mensaje de commit

Estilo del repo (mirá `git log --oneline -10` para confirmar): `feat: <Feature> fase N — <título corto>`.

El título corto sale del `## Fase N — <título>` del roadmap de la feature. Ejemplo: `feat: La Escalera fase 2 — retos, ELO en vivo y panel admin`.

Body opcional con 2-3 bullets de qué incluyó la fase (sacalo del `**Alcance:**` del roadmap, condensado).

```bash
git commit -m "$(cat <<'EOF'
feat: <Feature> fase N — título corto

- bullet 1
- bullet 2

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 4.6 Output al usuario

```
Commit: <hash corto> feat: <Feature> fase N — título
Archivos: K modificados, J nuevos
Roadmap: Fase N marcada como ✅ terminada (la-escalera-roadmap.md + roadmap/README.md)

El push lo hacés vos cuando quieras.
```

NO ejecutes `git push`. NUNCA.

## Notas generales

- Trabajás en `main` (solo dev). No crees branches.
- Si hay algo que no encaja en este flow (ej. el reporte es de una fase que ya está commiteada), pará y consultá.
- Mensajes al usuario en español rioplatense, concisos.
