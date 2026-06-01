# QA Fase 3 — Compromiso (penalización por inactividad) + automatización de vencimientos

- Fecha: 2026-06-01
- Ciclo: 1
- Modo: fase explícita (escalera fase 3)
- Roles testeados: SUPERADMIN (rapha.uy@rapha.uy), PLAYER (hugo.oxoby@gmail.com), público sin login, cron (CRON_SECRET)

## Casos de uso

- [x] **Admin cierra el mes previo (mayo 2026) desde el panel — golden**
  - Estado: ✓ pasa
  - Tab "Actividad" → "Cierre de período" con selector default "mayo de 2026" (mes previo a junio, correcto). "Cerrar mes" pide confirmación ("Confirmar cierre"/"No"); al confirmar, toast "Mes 5/2026 cerrado: 0 penalizados de 41 miembros" y la línea pasa a "Último cierre: mayo de 2026 · 01/06/2026". En DB: `LadderPeriodClose{2026,5}` creado, 0 filas `RatingHistory PENALTY`. 0 penalizados es correcto por gracia de alta: los 41 miembros tienen `joinedAt` 30/05/2026 (dentro de mayo) → no se penalizan ese mes. Verificado vía script de inspección.

- [x] **Re-cerrar mayo 2026 es idempotente — edge**
  - Estado: ✓ pasa
  - Segundo "Cerrar mes" + "Confirmar cierre" del mismo período → toast "El mes 5/2026 ya estaba cerrado (no se hizo nada)." En DB sigue habiendo 1 solo cierre (mismo `closedAt`) y 0 penalizaciones. El `closeLadderMonth` aborta por P2002 del `@@unique([ladderId,year,month])` y devuelve `alreadyClosed: true`.

- [x] **Admin corre "tareas diarias" desde el panel — golden**
  - Estado: ✓ pasa
  - Botón "Correr tareas diarias" → toast "Tareas diarias: 0 avisados, 0 cancelados, 0 avisos de cierre." Coherente: no hay partidos PENDING sin reserva vencidos y hoy (1/6) no es el día N=3 antes de fin de mes. Sin errores propios en dev.log para `runDailyTasksAction`.

- [x] **Cron `/api/cron/ladder-daily` con Bearer correcto — golden (endpoint)**
  - Estado: ✓ pasa
  - `GET` con `Authorization: Bearer $CRON_SECRET` → HTTP 200 `{"matchesWarned":0,"matchesCancelled":0,"monthWarnings":0}`. Sin errores en dev.log. (CRON_SECRET levantado de `.env.local`.)

- [x] **Crons rechazan request sin secret / secret incorrecto — edge permisos**
  - Estado: ✓ pasa
  - `/api/cron/ladder-month-close` y `/api/cron/ladder-daily` sin header → HTTP 401; con `Bearer wrong-secret` → HTTP 401. `/api/cron` está en publicRoutes del proxy pero la ruta valida el secret, como diseñado.

- [x] **Badge de estado mensual en panel propio del dueño — golden**
  - Estado: ✓ pasa
  - SUPERADMIN en `/jugador/raphael-carvalho` (es LadderMember activo): badge "En riesgo · 0/2 partidos este mes" (0 jugados en junio, mínimo 2). PLAYER Hugo en su propio `/jugador/hugo-oxoby`: mismo badge "En riesgo · 0/2". Sin nota de penalización (ninguno fue penalizado; gracia de alta).

- [x] **Visibilidad del badge: admin sobre panel ajeno sí, público no — edge**
  - Estado: ✓ pasa
  - SUPERADMIN viendo `/jugador/hugo-oxoby` (ajeno) ve el badge (admin canAct). El mismo perfil sin login (público) NO muestra el badge. Condición `canAct && userId` respetada.

- [x] **PLAYER no accede a `/admin/escalera` — edge permisos**
  - Estado: ✓ pasa
  - Hugo (PLAYER) navega a `/admin/escalera` → redirige a `/` (home). Bloqueado por el proxy.

- [x] **Migración: `priorityEligible` eliminado + nuevos campos de Ladder — schema**
  - Estado: ✓ pasa
  - `LadderMember.priorityEligible` ya no existe en el schema. `Ladder.ratingFloor Int @default(0)` y `Ladder.monthlyWarningLeadDays Int @default(3)` presentes; en DB la escalera tiene `ratingFloor=0`, `monthlyWarningLeadDays=3`. Selects de Prisma sobre `User`/`LadderMember` no referencian el campo eliminado.

## Notas

- **`prisma:error` esperado en re-cierre (no bloqueante):** el re-cierre idempotente loguea `prisma:error Unique constraint failed on the fields: ("ladderId","year","month")` en dev.log. Es el mecanismo de idempotencia diseñado (P2002 capturado en `closeLadderMonth`); la action devuelve `success` con el mensaje "ya estaba cerrado". El log es ruido del datasource, no un fallo. Si molesta en producción, podría silenciarse chequeando existencia antes del `create`, pero está fuera de alcance de esta fase.
- **Penalización no ejercitada en vivo:** con el seed actual (todos los miembros con `joinedAt` en mayo) no hay forma de gatillar una multa real desde la UI sin mutar DB (prohibido para QA). La lógica de multa, piso (`ratingFloor`) y `RatingHistory PENALTY` quedó cubierta solo por code review + el cierre vacío. El piso (`Math.min(monthlyPenalty, rating - ratingFloor)`) no se ejerció con datos reales.
- **Crons diferidos sin escenario real:** aviso pre-vencimiento, auto-cancelación de partidos vencidos y aviso pre-cierre devolvieron 0 porque no hay datos en estado de disparo (sin PENDING sin reserva vencidos; hoy no es N días antes de fin de mes). Sus efectos (emails, CANCELLED) no se observaron end-to-end; verificados por lectura de `ladder-cron-service.ts`.
- **Mobile no testeado:** el arg no incluyó `mobile`; el badge de jugador es UI mobile-first (87% celular) — vale considerar un caso 375x667 en un ciclo futuro.
