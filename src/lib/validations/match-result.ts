import { z } from 'zod'
import type { MatchFormat } from '@prisma/client'

const scoreField = z.coerce.number().int().min(0).max(7)
const superTbField = z.coerce.number().int().min(0).max(99)
const tbField = z.coerce.number().int().min(0).max(99)

function isValidSetScore(p1: number, p2: number): boolean {
  if (p1 < 6 && p2 < 6) return false
  if ((p1 === 6 && p2 <= 4) || (p2 === 6 && p1 <= 4)) return true
  if ((p1 === 7 && p2 === 5) || (p2 === 7 && p1 === 5)) return true
  if ((p1 === 7 && p2 === 6) || (p2 === 7 && p1 === 6)) return true
  return false
}

function setWinner(p1: number, p2: number): 1 | 2 {
  return p1 > p2 ? 1 : 2
}

function isValidSuperTb(p1: number, p2: number): boolean {
  const winner = Math.max(p1, p2)
  const loser = Math.min(p1, p2)
  return winner >= 10 && winner - loser >= 2
}

function isValidTiebreak(p1: number, p2: number): boolean {
  const winner = Math.max(p1, p2)
  const loser = Math.min(p1, p2)
  return winner >= 7 && winner - loser >= 2
}

function isTiebreakSet(p1: number, p2: number): boolean {
  return (p1 === 7 && p2 === 6) || (p1 === 6 && p2 === 7)
}

/** Validate that the TB winner matches the set winner (player who got 7 games) */
function isTbWinnerConsistent(setP1: number, tbP1: number, tbP2: number): boolean {
  const setWonByP1 = setP1 === 7
  const tbWonByP1 = tbP1 > tbP2
  return setWonByP1 === tbWonByP1
}

const singleSetSchema = (player1Id: string, player2Id: string) =>
  z
    .object({
      set1Player1: scoreField,
      set1Player2: scoreField,
      tb1Player1: tbField.optional(),
      tb1Player2: tbField.optional(),
    })
    .refine((d) => isValidSetScore(d.set1Player1, d.set1Player2), {
      message: 'Score de set inválido',
      path: ['set1Player1'],
    })
    .superRefine((d, ctx) => {
      if (isTiebreakSet(d.set1Player1, d.set1Player2)) {
        if (d.tb1Player1 == null || d.tb1Player2 == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Tiebreak requerido para set 7-6',
            path: ['tb1Player1'],
          })
          return
        }
        if (!isValidTiebreak(d.tb1Player1, d.tb1Player2)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Tiebreak inválido (mínimo 7 puntos, diferencia de 2)',
            path: ['tb1Player1'],
          })
        } else if (!isTbWinnerConsistent(d.set1Player1, d.tb1Player1, d.tb1Player2)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El ganador del tiebreak no coincide con el ganador del set',
            path: ['tb1Player1'],
          })
        }
      }
    })
    .transform((d) => {
      const tb1 = isTiebreakSet(d.set1Player1, d.set1Player2)
      return {
        set1Player1: d.set1Player1,
        set1Player2: d.set1Player2,
        tb1Player1: tb1 ? (d.tb1Player1 ?? null) : null,
        tb1Player2: tb1 ? (d.tb1Player2 ?? null) : null,
        winnerId: setWinner(d.set1Player1, d.set1Player2) === 1 ? player1Id : player2Id,
      }
    })

const twoSetsSuperTbSchema = (player1Id: string, player2Id: string) =>
  z
    .object({
      set1Player1: scoreField,
      set1Player2: scoreField,
      tb1Player1: tbField.optional(),
      tb1Player2: tbField.optional(),
      set2Player1: scoreField,
      set2Player2: scoreField,
      tb2Player1: tbField.optional(),
      tb2Player2: tbField.optional(),
      superTbPlayer1: superTbField.optional(),
      superTbPlayer2: superTbField.optional(),
    })
    .refine((d) => isValidSetScore(d.set1Player1, d.set1Player2), {
      message: 'Score de set 1 inválido',
      path: ['set1Player1'],
    })
    .refine((d) => isValidSetScore(d.set2Player1, d.set2Player2), {
      message: 'Score de set 2 inválido',
      path: ['set2Player1'],
    })
    .superRefine((d, ctx) => {
      // Tiebreak set 1
      if (isTiebreakSet(d.set1Player1, d.set1Player2)) {
        if (d.tb1Player1 == null || d.tb1Player2 == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Tiebreak requerido para set 1 (7-6)',
            path: ['tb1Player1'],
          })
        } else if (!isValidTiebreak(d.tb1Player1, d.tb1Player2)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Tiebreak set 1 inválido (mínimo 7 puntos, diferencia de 2)',
            path: ['tb1Player1'],
          })
        } else if (!isTbWinnerConsistent(d.set1Player1, d.tb1Player1, d.tb1Player2)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El ganador del tiebreak no coincide con el ganador del set 1',
            path: ['tb1Player1'],
          })
        }
      }

      // Tiebreak set 2
      if (isTiebreakSet(d.set2Player1, d.set2Player2)) {
        if (d.tb2Player1 == null || d.tb2Player2 == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Tiebreak requerido para set 2 (7-6)',
            path: ['tb2Player1'],
          })
        } else if (!isValidTiebreak(d.tb2Player1, d.tb2Player2)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Tiebreak set 2 inválido (mínimo 7 puntos, diferencia de 2)',
            path: ['tb2Player1'],
          })
        } else if (!isTbWinnerConsistent(d.set2Player1, d.tb2Player1, d.tb2Player2)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El ganador del tiebreak no coincide con el ganador del set 2',
            path: ['tb2Player1'],
          })
        }
      }

      // Super tiebreak
      const s1 = setWinner(d.set1Player1, d.set1Player2)
      const s2 = setWinner(d.set2Player1, d.set2Player2)
      const isTied = s1 !== s2

      if (isTied) {
        if (d.superTbPlayer1 == null || d.superTbPlayer2 == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Super tiebreak requerido cuando los sets están 1-1',
            path: ['superTbPlayer1'],
          })
          return
        }
        if (!isValidSuperTb(d.superTbPlayer1, d.superTbPlayer2)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Super tiebreak inválido (mínimo 10 puntos, diferencia de 2)',
            path: ['superTbPlayer1'],
          })
        }
      }
    })
    .transform((d) => {
      const s1 = setWinner(d.set1Player1, d.set1Player2)
      const s2 = setWinner(d.set2Player1, d.set2Player2)
      const tb1 = isTiebreakSet(d.set1Player1, d.set1Player2)
      const tb2 = isTiebreakSet(d.set2Player1, d.set2Player2)

      let winnerId: string
      if (s1 === s2) {
        winnerId = s1 === 1 ? player1Id : player2Id
      } else {
        winnerId =
          (d.superTbPlayer1 ?? 0) > (d.superTbPlayer2 ?? 0) ? player1Id : player2Id
      }

      return {
        set1Player1: d.set1Player1,
        set1Player2: d.set1Player2,
        tb1Player1: tb1 ? (d.tb1Player1 ?? null) : null,
        tb1Player2: tb1 ? (d.tb1Player2 ?? null) : null,
        set2Player1: d.set2Player1,
        set2Player2: d.set2Player2,
        tb2Player1: tb2 ? (d.tb2Player1 ?? null) : null,
        tb2Player2: tb2 ? (d.tb2Player2 ?? null) : null,
        superTbPlayer1: d.superTbPlayer1,
        superTbPlayer2: d.superTbPlayer2,
        winnerId,
      }
    })

export function createMatchResultSchema(
  matchFormat: MatchFormat,
  player1Id: string,
  player2Id: string
) {
  switch (matchFormat) {
    case 'SINGLE_SET':
      return singleSetSchema(player1Id, player2Id)
    case 'TWO_SETS_SUPERTB':
      return twoSetsSuperTbSchema(player1Id, player2Id)
    case 'BEST_OF_THREE':
      throw new Error('Formato BEST_OF_THREE no soportado todavía')
  }
}
