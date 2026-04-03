'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { MatchFormat } from '@prisma/client'
import type { ActionResult } from '@/lib/action-types'

interface MatchResultFormProps {
  matchFormat: MatchFormat
  player1Name: string
  player2Name: string
  defaultValues?: {
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
  onSubmit: (data: Record<string, unknown>) => Promise<ActionResult>
  isPending: boolean
}

export function MatchResultForm({
  matchFormat,
  player1Name,
  player2Name,
  defaultValues,
  onSubmit,
  isPending,
}: MatchResultFormProps) {
  const [set1P1, setSet1P1] = useState(defaultValues?.set1Player1?.toString() ?? '')
  const [set1P2, setSet1P2] = useState(defaultValues?.set1Player2?.toString() ?? '')
  const [tb1P1, setTb1P1] = useState(defaultValues?.tb1Player1?.toString() ?? '')
  const [tb1P2, setTb1P2] = useState(defaultValues?.tb1Player2?.toString() ?? '')
  const [set2P1, setSet2P1] = useState(defaultValues?.set2Player1?.toString() ?? '')
  const [set2P2, setSet2P2] = useState(defaultValues?.set2Player2?.toString() ?? '')
  const [tb2P1, setTb2P1] = useState(defaultValues?.tb2Player1?.toString() ?? '')
  const [tb2P2, setTb2P2] = useState(defaultValues?.tb2Player2?.toString() ?? '')
  const [stbP1, setStbP1] = useState(defaultValues?.superTbPlayer1?.toString() ?? '')
  const [stbP2, setStbP2] = useState(defaultValues?.superTbPlayer2?.toString() ?? '')
  const [error, setError] = useState('')

  const isTwoSets = matchFormat === 'TWO_SETS_SUPERTB'

  const s1Winner = Number(set1P1) > Number(set1P2) ? 1 : Number(set1P2) > Number(set1P1) ? 2 : 0
  const s2Winner = Number(set2P1) > Number(set2P2) ? 1 : Number(set2P2) > Number(set2P1) ? 2 : 0
  const showSuperTb = isTwoSets && s1Winner !== 0 && s2Winner !== 0 && s1Winner !== s2Winner

  const showTb1 = (set1P1 === '7' && set1P2 === '6') || (set1P1 === '6' && set1P2 === '7')
  const showTb2 = isTwoSets && ((set2P1 === '7' && set2P2 === '6') || (set2P1 === '6' && set2P2 === '7'))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const data: Record<string, unknown> = {
      set1Player1: set1P1,
      set1Player2: set1P2,
    }

    if (showTb1) {
      data.tb1Player1 = tb1P1
      data.tb1Player2 = tb1P2
    }

    if (isTwoSets) {
      data.set2Player1 = set2P1
      data.set2Player2 = set2P2
      if (showTb2) {
        data.tb2Player1 = tb2P1
        data.tb2Player2 = tb2P2
      }
      if (showSuperTb) {
        data.superTbPlayer1 = stbP1
        data.superTbPlayer2 = stbP2
      }
    }

    const result = await onSubmit(data)
    if (!result.success) {
      setError(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Scoreboard table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="text-left font-normal pb-2">Jugador</th>
              <th className="text-center font-normal pb-2 w-16">Set 1</th>
              {showTb1 && <th className="text-center font-normal pb-2 w-16">TB</th>}
              {isTwoSets && <th className="text-center font-normal pb-2 w-16">Set 2</th>}
              {showTb2 && <th className="text-center font-normal pb-2 w-16">TB</th>}
              {showSuperTb && <th className="text-center font-normal pb-2 w-16">STB</th>}
            </tr>
          </thead>
          <tbody>
            {/* Player 1 row */}
            <tr>
              <td className="pr-4 py-1.5">
                <span className="text-sm font-medium">{player1Name}</span>
              </td>
              <td className="py-1.5">
                <Input type="number" min={0} max={7} value={set1P1} onChange={(e) => setSet1P1(e.target.value)} className="w-14 text-center mx-auto" />
              </td>
              {showTb1 && (
                <td className="py-1.5">
                  <Input type="number" min={0} max={99} value={tb1P1} onChange={(e) => setTb1P1(e.target.value)} className="w-14 text-center mx-auto" />
                </td>
              )}
              {isTwoSets && (
                <td className="py-1.5">
                  <Input type="number" min={0} max={7} value={set2P1} onChange={(e) => setSet2P1(e.target.value)} className="w-14 text-center mx-auto" />
                </td>
              )}
              {showTb2 && (
                <td className="py-1.5">
                  <Input type="number" min={0} max={99} value={tb2P1} onChange={(e) => setTb2P1(e.target.value)} className="w-14 text-center mx-auto" />
                </td>
              )}
              {showSuperTb && (
                <td className="py-1.5">
                  <Input type="number" min={0} max={99} value={stbP1} onChange={(e) => setStbP1(e.target.value)} className="w-14 text-center mx-auto" />
                </td>
              )}
            </tr>
            {/* Player 2 row */}
            <tr>
              <td className="pr-4 py-1.5">
                <span className="text-sm font-medium">{player2Name}</span>
              </td>
              <td className="py-1.5">
                <Input type="number" min={0} max={7} value={set1P2} onChange={(e) => setSet1P2(e.target.value)} className="w-14 text-center mx-auto" />
              </td>
              {showTb1 && (
                <td className="py-1.5">
                  <Input type="number" min={0} max={99} value={tb1P2} onChange={(e) => setTb1P2(e.target.value)} className="w-14 text-center mx-auto" />
                </td>
              )}
              {isTwoSets && (
                <td className="py-1.5">
                  <Input type="number" min={0} max={7} value={set2P2} onChange={(e) => setSet2P2(e.target.value)} className="w-14 text-center mx-auto" />
                </td>
              )}
              {showTb2 && (
                <td className="py-1.5">
                  <Input type="number" min={0} max={99} value={tb2P2} onChange={(e) => setTb2P2(e.target.value)} className="w-14 text-center mx-auto" />
                </td>
              )}
              {showSuperTb && (
                <td className="py-1.5">
                  <Input type="number" min={0} max={99} value={stbP2} onChange={(e) => setStbP2(e.target.value)} className="w-14 text-center mx-auto" />
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Guardando...' : defaultValues ? 'Actualizar resultado' : 'Cargar resultado'}
      </Button>
    </form>
  )
}
