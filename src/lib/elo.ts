// Núcleo ELO puro (sin Prisma). Lo reusan el preview de la UI y el hook que
// aplica el resultado al rating. Suma-cero: un único redondeo del lado del
// ganador; el perdedor recibe el negativo exacto.

/** Probabilidad esperada de que A le gane a B (0..1). */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
}

/**
 * Delta de rating que GANA el ganador (entero ≥ 0). El perdedor recibe el
 * negativo exacto de este valor (suma-cero exacto). `score = 1` para el ganador.
 */
export function eloWinnerDelta(kFactor: number, winnerRating: number, loserRating: number): number {
  return Math.round(kFactor * (1 - expectedScore(winnerRating, loserRating)))
}

/**
 * Preview desde la perspectiva del actor: cuánto sube si gana, cuánto baja si
 * pierde. `ifLose` se calcula como el negativo del delta que ganaría el rival,
 * para que coincida EXACTAMENTE con el delta real que se aplicaría al perder
 * (el redondeo se hace siempre del lado del ganador del escenario).
 */
export function eloPreview(
  kFactor: number,
  actorRating: number,
  rivalRating: number
): { ifWin: number; ifLose: number } {
  return {
    ifWin: eloWinnerDelta(kFactor, actorRating, rivalRating),
    ifLose: -eloWinnerDelta(kFactor, rivalRating, actorRating),
  }
}
