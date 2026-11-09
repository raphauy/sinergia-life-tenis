/**
 * Format a set score with tiebreak notation.
 * Standard tennis: 7-6(5) where 5 is the loser's TB score.
 * Set a 4 (SHORT_SET_4): 4-3(3) con el mini tiebreak a 5.
 */
function formatSet(p1: number, p2: number, tbP1?: number | null, tbP2?: number | null): string {
  const isTbSet =
    (p1 === 7 && p2 === 6) || (p1 === 6 && p2 === 7) || (p1 === 4 && p2 === 3) || (p1 === 3 && p2 === 4)
  if (isTbSet) {
    if (tbP1 != null && tbP2 != null) {
      const loserTb = p1 > p2 ? tbP2 : tbP1
      // TB goes with the loser's score: 6(2)-7 or 7-6(2)
      if (p1 < p2) return `${p1}(${loserTb})-${p2}`
      return `${p1}-${p2}(${loserTb})`
    }
  }
  return `${p1}-${p2}`
}

interface MatchResultScore {
  walkover?: boolean
  set1Player1: number
  set1Player2: number
  tb1Player1?: number | null
  tb1Player2?: number | null
  set2Player1?: number | null
  set2Player2?: number | null
  tb2Player1?: number | null
  tb2Player2?: number | null
  superTbPlayer1?: number | null
  superTbPlayer2?: number | null
}

export function formatMatchScore(r: MatchResultScore): string {
  if (r.walkover) return 'W/O'
  let score = formatSet(r.set1Player1, r.set1Player2, r.tb1Player1, r.tb1Player2)
  if (r.set2Player1 != null && r.set2Player2 != null) {
    score += `  ${formatSet(r.set2Player1, r.set2Player2, r.tb2Player1, r.tb2Player2)}`
  }
  if (r.superTbPlayer1 != null && r.superTbPlayer2 != null) {
    score += `  [${r.superTbPlayer1}-${r.superTbPlayer2}]`
  }
  return score
}
