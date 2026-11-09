# Deploy: Copa Summum (torneo de dobles del sábado 14/11/2026)

Rama `dobles` → `main`. Mapa wayfinder #1; tickets #5, #6, #7, #8, #9, #10, #11, #12, #13 (todos cerrados el 9/11/2026).

## 1. Antes de mergear a main

- QA visual de Raphael en el worktree `sinergia-worktrees/dobles` (apunta al branch de Neon `dobles`, con el torneo de prueba `copa-summum` cargado). Lo único no verificado por agentes: el detalle privado `/jugador/[slug]/partidos/[matchId]` de un partido de dobles (requiere sesión).
- Revisar la tabla de diminutivos en `src/lib/display-name.ts` (apodos tipo Tincho, Nacho, Pato, Andy).

## 2. Migraciones en producción (5, todas aditivas)

```
20261109163415_tournament_featured_on_home   Tournament.featuredOnHome
20261109164921_match_format_short_set_4      MatchFormat.SHORT_SET_4
20261109170423_match_cup                     enum Cup + Match.cup
20261109171711_doubles_pairs                 TournamentModality + Tournament.modality + DoublesPair
20261109173512_user_display_name             User.displayName
```

`pnpm prisma migrate deploy` con `.env.local` apuntando a Production (o el pipeline de Vercel si ya corre `migrate deploy` en el build).

## 3. Después del deploy, en este orden

1. **Backfill del nombre para mostrar** (una sola vez; si se repite, rellena los que el usuario vació a propósito):
   ```
   pnpm tsx scripts/backfill-display-name.ts --dry-run
   pnpm tsx scripts/backfill-display-name.ts
   ```
2. **Cargar el torneo** con el mensaje de Mati (parejas: capitán primero, por email; 4 grupos de 4):
   - Armar el JSON a partir de `scripts/dobles/copa-summum.ejemplo.json`.
   - `pnpm tsx scripts/cargar-dobles.ts <json>` (con `--reset` si hay que recargar; `--force` si ya tiene resultados).
   - Crea el torneo `copa-summum` (DOUBLES, set a 4, `isActive = false`, fuera de portada), 32 jugadores, 16 parejas, 24 partidos de grupo y 6 llaves CONFIRMED con hora y cancha.
   - **No correrlo antes del deploy**: con el torneo cargado y el código viejo, los links de perfil de las 32 personas apuntarían a su ficha de dobles.
3. **Prender la portada** el viernes o el sábado temprano: `/admin/torneos/copa-summum` → switch "En portada". Apagarlo cuando termine el torneo (el home vuelve a La Escalera y el torneo queda en el archivo al pie).

## 4. El sábado

- El 14/11 está cerrado para reservas de La Escalera ("Reservado Copa Summum", #14 ya en main).
- Resultados: cualquiera de los cuatro desde su panel ("Próximos partidos") o el admin desde `/admin/partidos`. Set a 4; con 4-3 pide el mini tiebreak. W/O vale 4-0.
- Los 1° pasan solos a las semis de oro y los 2° a las de plata; el ganador de cada semi pasa solo a su final. Las llaves ya están CONFIRMED: se puede cargar apenas tienen las dos parejas.
- Si hay que rearmar el cuadro: solo con el script (`--reset --force`); el admin no puede generar, regenerar ni eliminar el cuadro de un torneo de dobles.
- La vista no se refresca sola: el público recarga.

## 5. Después del torneo

- Apagar el switch de portada.
- Opcional: borrar el branch de Neon `dobles` (`neon branches delete dobles --project-id quiet-sunset-70539171`) y el worktree `sinergia-worktrees/dobles`.
