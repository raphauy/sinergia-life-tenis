# Deploy: Copa Summum (torneo de dobles del sábado 14/11/2026)

Rama `dobles` → `main`. Mapa wayfinder #1; tickets #5, #6, #7, #8, #9, #10, #11, #12, #13 (todos cerrados el 9/11/2026).

## 1. Antes de mergear a main

- QA visual de Raphael en el worktree `sinergia-worktrees/dobles` (apunta al branch de Neon `dobles`, con el torneo de prueba `copa-summum` cargado). Lo único no verificado por agentes: el detalle privado `/jugador/[slug]/partidos/[matchId]` de un partido de dobles (requiere sesión).
- Revisar la tabla de diminutivos en `src/lib/display-name.ts` (apodos tipo Tincho, Nacho, Pato, Andy).

## 2. Migraciones en producción (6, todas aditivas) — ANTES de pushear `main`

El build de Vercel es `next build` a secas: **no migra**. Si `main` se publica antes de migrar, el código lee columnas que no existen (`modality`, `featuredOnHome`, `displayName`, `cup`, `tiebreakOrder`) y casi todas las páginas dan 500. Las migraciones son aditivas, así que el código viejo sigue funcionando con el schema nuevo: primero migrar, después pushear.

```
20261109163415_tournament_featured_on_home   Tournament.featuredOnHome
20261109164921_match_format_short_set_4      MatchFormat.SHORT_SET_4
20261109170423_match_cup                     enum Cup + Match.cup
20261109171711_doubles_pairs                 TournamentModality + Tournament.modality + DoublesPair
20261109173512_user_display_name             User.displayName
20261110092904_group_tiebreak_order          Group.tiebreakOrder (desempate manual)
```

Las 6 migraciones solo existen en la rama `dobles`: correr esto **desde el worktree `sinergia-worktrees/dobles`** (o desde `main` ya mergeado en local y SIN pushear). Desde `main` sin mergear, `migrate status` dice que no hay nada pendiente y el deploy rompe.

```
# .env.local del worktree apuntando a Production (comentar Test, descomentar Production), después:
pnpm prisma migrate status    # tiene que listar las 6 como pendientes
pnpm prisma migrate deploy
```

Recién entonces: merge de `dobles` a `main` y push.

Antes de migrar conviene crear un branch de Neon de producción como punto de restauración.

## 3. Después del deploy, en este orden

1. **Cargar el torneo** con el mensaje de Mati (parejas: capitán primero, por email; 4 grupos de 4):
   - Armar el JSON a partir de `scripts/dobles/copa-summum.ejemplo.json`.
   - **Validarlo días antes**, sin escribir nada: `pnpm tsx scripts/cargar-dobles.ts <json> --check` (con `.env.local` en Production). El script no crea usuarios: corta si alguna de las 32 personas no existe con ese email exacto o está inactiva (no podría iniciar sesión). Hay que darlas de alta o corregir el email antes.
   - `pnpm tsx scripts/cargar-dobles.ts <json>` (con `--reset` si hay que recargar; `--force` si ya tiene resultados). Imprime el host de la base y pide confirmación: verificar que sea Production. `--reset` conserva la portada.
   - Crea el torneo `copa-summum` (DOUBLES, set a 4, `isActive = false`; la primera vez fuera de portada, con `--reset` conserva la que tenga), 32 jugadores, 16 parejas, 24 partidos de grupo y 6 llaves CONFIRMED con hora y cancha.
   - `--reset --force` **borra todos los resultados cargados** y recrea el torneo de cero.
   - **No correrlo antes del deploy**: con el torneo cargado y el código viejo, los links de perfil de las 32 personas apuntarían a su ficha de dobles.
2. **Nombres para mostrar** de los 32 jugadores (después de cargar el torneo; solo toca a sus jugadores que no tengan uno):
   ```
   pnpm tsx scripts/backfill-display-name.ts --torneo copa-summum --dry-run
   pnpm tsx scripts/backfill-display-name.ts --torneo copa-summum
   ```
   El dry-run marca los apodos que no salen del nombre (Martín → "Tincho") y los repetidos ("Nico P." dos veces): corregirlos a mano en `/admin/torneos/copa-summum` ("Para mostrar: …") antes de prender la portada. No repetirlo más adelante: rellena a quien lo vació a propósito en su perfil.
3. **Verificar** entrando como un compañero (no capitán): ve sus 3 partidos en su panel.
4. **Volver `.env.local` a Test.** Con Production activa, NO correr `scripts/qa-dobles-*.ts` (tienen freno, pero no confiarse).
5. **Prender la portada** el viernes o el sábado temprano: `/admin/torneos/copa-summum` → switch "Torneo en portada". Apagarlo cuando termine el torneo (el home vuelve a La Escalera y el torneo queda en el archivo al pie).

## 4. El sábado

- El 14/11 está cerrado para reservas de La Escalera ("Reservado Copa Summum", #14 ya en main).
- Resultados: cualquiera de los cuatro desde su panel ("Próximos partidos") o el admin desde `/admin/partidos`. Set a 4; con 4-3 pide el mini tiebreak. W/O vale 4-0.
- El sábado se puede cargar cualquier partido del día aunque todavía no sea su hora (por si la mañana va adelantada), siempre que tenga las dos parejas.
- Los 1° pasan solos a las semis de oro y los 2° a las de plata **cuando su posición está decidida** (no antes: no hay parejas "tentativas"); el ganador de cada semi pasa solo a su final. Si falta cargar un partido de un grupo, sus semis quedan esperando.
- **Triple empate** (tres parejas de un grupo con los mismos ganados y la misma diferencia de games): la app no elige. La tabla pública las marca con "=" y avisa que lo define la organización; las semis de ese grupo quedan esperando. El admin entra a `/admin/torneos/copa-summum`, donde aparece arriba un recuadro amarillo con las parejas empatadas: las ordena con las flechas y toca "Guardar este orden". Ahí pasan solas a las semis. Se puede volver a cambiar mientras esas semis no tengan resultado. **Acordar antes con Mati cómo se desempata en la cancha** (sorteo, games a favor, etc.).
- **Corregir un resultado** (solo el admin, `/admin/partidos/<id>` → Editar resultado):
  - De grupo: la tabla y las semis se recalculan solas. Si el cambio movería a una pareja de una semi **que ya tiene resultado**, se rechaza con un mensaje y no se guarda nada.
  - De semi: la final se actualiza sola, salvo que la final ya tenga resultado (se rechaza).
- Reprogramar un partido de dobles (hora/cancha) no manda emails. Cancelar está bloqueado.
- Si hay que rearmar el cuadro entero: solo con el script (`--reset --force`, **borra todos los resultados**); el admin no puede generar, regenerar ni eliminar el cuadro de un torneo de dobles.
- La vista no se refresca sola: el público recarga.

## 5. Después del torneo

- Apagar el switch de portada.
- Opcional: borrar el branch de Neon `dobles` (`neon branches delete dobles --project-id quiet-sunset-70539171`) y el worktree `sinergia-worktrees/dobles`.
