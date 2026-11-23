// Núcleo ELO puro (sin Prisma). Lo reusan el preview de la UI y el hook que
// aplica el resultado al rating. Un único redondeo del lado del ganador; el
// perdedor recibe el negativo exacto, salvo que eso lo deje por debajo del piso
// de la escalera (ratingFloor): ahí pierde solo lo que le queda hasta el piso.

/** Probabilidad esperada de que A le gane a B (0..1). */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
}

/**
 * Delta de rating que GANA el ganador (entero ≥ 1). El perdedor recibe el
 * negativo de este valor, recortado por el piso (ver eloLoserLoss). `score = 1` para el ganador.
 *
 * Piso de 1: ganarle a alguien muy por debajo redondearía a 0; forzamos ≥ 1 para
 * que todo reto/partido mueva algo (ganar nunca da 0, perder nunca cuesta 0). El
 * walkover (ELO-neutral, delta 0) no pasa por acá, así que mantiene su 0.
 */
export function eloWinnerDelta(kFactor: number, winnerRating: number, loserRating: number): number {
  return Math.max(1, Math.round(kFactor * (1 - expectedScore(winnerRating, loserRating))))
}

/**
 * Puntos que PIERDE el perdedor (entero ≥ 0, se resta). Es el delta del ganador
 * recortado por el piso: nadie baja de `ratingFloor` por perder un partido (un
 * recién llegado con 0 puntos se queda en 0). El ganador cobra su delta entero,
 * así que en ese caso el partido deja de ser suma-cero. Quien ya esté por debajo
 * del piso no pierde nada.
 */
export function eloLoserLoss(winnerDelta: number, loserRating: number, ratingFloor: number): number {
  return Math.min(winnerDelta, Math.max(0, loserRating - ratingFloor))
}

/**
 * Preview desde la perspectiva del actor: cuánto sube si gana, cuánto baja si
 * pierde. `ifLose` se calcula como el negativo del delta que ganaría el rival,
 * recortado por el piso, para que coincida EXACTAMENTE con el delta real que se
 * aplicaría al perder (el redondeo se hace siempre del lado del ganador del escenario).
 */
export function eloPreview(
  kFactor: number,
  actorRating: number,
  rivalRating: number,
  ratingFloor: number
): { ifWin: number; ifLose: number } {
  const loss = eloLoserLoss(eloWinnerDelta(kFactor, rivalRating, actorRating), actorRating, ratingFloor)
  return {
    ifWin: eloWinnerDelta(kFactor, actorRating, rivalRating),
    ifLose: loss === 0 ? 0 : -loss,
  }
}
