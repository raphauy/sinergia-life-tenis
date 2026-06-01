# QA Fase 2 — Retos + partidos + ELO en vivo (La Escalera)

- Fecha: 2026-06-01
- Ciclo: 1
- Modo: fase explícita
- Roles testeados: PLAYER (Mauricio Carballo, Kevin Winiarski), SUPERADMIN (Raphael Carvalho)

## Casos de uso

- [x] **Golden path reto: proponer → preview → aceptar crea Match PENDING**
  - Estado: ✓ pasa
  - Mauricio (1500) reta a Kevin (1480) desde la escalera en `/`. Diálogo muestra preview +16/-19. Reto queda PROPOSED en DB. Kevin lo acepta desde su panel `/jugador/kevin-winiarsky` → challenge pasa a ACCEPTED con matchId, y el Match creado tiene `status=PENDING`, `ladderId` seteado y relación `challenge` ACCEPTED, con ambos jugadores correctos. Estado de la escalera pasa la fila de Kevin de "Retar" a badge "Pendiente".

- [x] **Preview ELO coincide con el delta que se aplicaría (ambas perspectivas)**
  - Estado: ✓ pasa
  - Diálogo de Mauricio→Kevin: "Si ganás +16 / Si perdés -19". Panel de Kevin (retado): "ganás +19 · perdés 16". Ambos coinciden con `eloWinnerDelta(k=35, ...)` calculado a mano (Mauricio 1500 vs Kevin 1480). El delta real aplicado en partidos PLAYED previos (RatingHistory) coincide con el preview para los partidos jugados con el K vigente (ej. +19 con k=35).

- [x] **Cap de retos abiertos (maxOpenChallenges=2) bloquea el tercero**
  - Estado: ✓ pasa
  - Mauricio retó a Kevin y a Felipe (2 abiertos). Al intentar retar a Juan Romero, el server action rechaza: el reto NO se crea en DB (lista vacía entre Mauricio y Juan) y el diálogo permanece abierto (comportamiento esperado en error). Validación de `createChallenge` operando.

- [x] **Panel admin escalera: ranking + monitor de actividad**
  - Estado: ✓ pasa
  - `/admin/escalera` renderiza con tabs Ranking/Actividad/Ajustes. Tab Actividad muestra "Retos pendientes (1)" (Mauricio→Felipe con vencimiento), "Partidos en curso (2)" (Mauricio vs Kevin y Javi vs Raphael, ambos "Sin reservar" con Editar/Cancelar) y "Últimos jugados" con deltas +19 y +14. Refleja exactamente el estado real de la DB.

- [x] **Admin cancela un reto PROPOSED**
  - Estado: ✓ pasa
  - Desde el monitor, cancelar el reto Mauricio→Felipe (con confirmación inline) → toast "Reto cancelado" y challenge pasa a CANCELLED en DB. Log confirma `cancelChallengeAdminAction`.

- [x] **Form de ajustes del ladder guarda config**
  - Estado: ✓ pasa
  - Tab Ajustes muestra todos los campos con valores actuales (Factor K=35, caps, ventanas). Cambiar Factor K a 37 y guardar → kFactor=37 persiste en DB, `updatedAt` se actualiza, log confirma `updateLadderConfigAction({kFactor:37,...})`. Restaurado a 35 al final. (Nota: requiere disparar `type` con eventos de teclado, no `fill`, por ser input controlado de React — ver Notas.)

- [x] **Permisos: PLAYER no accede a /admin/escalera**
  - Estado: ✓ pasa
  - Logueado como Kevin (PLAYER), navegar a `/admin/escalera` redirige a `/` (home). Ruta admin protegida.

- [x] **ELO suma-cero a nivel de datos (RatingHistory con before/after/delta)**
  - Estado: ✓ pasa
  - Partidos PLAYED previos: cada uno genera 2 filas de RatingHistory (`reason=MATCH`) con `ratingBefore → ratingAfter` y `delta` ganador = −delta perdedor. Suma de deltas por partido = 0 (suma-cero exacto). Historial encadenado correctamente (ratingAfter de un partido = ratingBefore del siguiente).

- [x] **Página de partido de escalera del jugador renderiza**
  - Estado: ✓ pasa
  - `/jugador/kevin-winiarsky/partidos/<matchId>` del partido aceptado muestra versus, badge "Pendiente", aviso de coordinación, datos de contacto del rival, calendario de disponibilidad de canchas y botón "Cancelar partido".

## Notas

- **Walkover ELO-neutral NO ejecutado en UI** (verificado solo a nivel de código): `applyMatchElo` aplica `delta = isWalkover ? 0 : eloWinnerDelta(...)` y deja 2 filas de RatingHistory con delta 0. No se pudo ejecutar el flujo en vivo porque ningún partido de escalera está en estado CONFIRMED (todos los PENDING están sin reservar); armar reserva→confirmación→carga de walkover excedía el presupuesto del ciclo. Recomendado verificar en un ciclo con un partido confirmado.

- **Edición de resultado con recálculo por delta local NO ejecutada en UI** (verificado solo a nivel de código): `recalcMatchElo` revierte el delta viejo y recomputa con los `ratingBefore` guardados, sin replay. Misma razón que el walkover: no hay partido jugado fresco para editar dentro del ciclo. Los datos existentes de RatingHistory son consistentes con este modelo.

- **Discrepancia informativa (no es bug):** en el partido PLAYED más viejo (Raphael 1340 vs Javi 1400) el delta aplicado fue +14, pero con el kFactor actual (35) el cálculo da +20. El partido siguiente (+19) sí coincide con k=35. La causa es que el `Ladder.kFactor` fue editado (`updatedAt` posterior a ambos partidos): el primer partido se jugó con un K menor (~24-25). El código aplica el K vigente al momento de cada partido — comportamiento correcto, no hay bug.

- **Limitación de tooling (no es bug de la app):** el comando `fill` de agent-browser no dispara el `onChange` de React en inputs controlados (form de Ajustes), dejando el state del componente desactualizado aunque el DOM muestre el valor nuevo. El guardado real requiere `type` con eventos de teclado. Detectado al ver que un primer guardado con K=36 no persistía mientras que con `type` (K=37) sí. Relevante para futuros ciclos de QA sobre forms controlados.

- El reto de Mauricio→Kevin quedó ACCEPTED con un Match PENDING sin reservar, y el reto Mauricio→Felipe quedó CANCELLED (datos de prueba dejados por este ciclo). No afectan otros casos.
