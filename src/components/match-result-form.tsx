'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { MatchFormat } from '@/generated/prisma/client'
import type { ActionResult } from '@/lib/action-types'

interface MatchResultFormProps {
  matchFormat: MatchFormat
  player1Name: string
  player2Name: string
  defaultValues?: {
    set1Player1: number
    set1Player2: number
    set2Player1?: number | null
    set2Player2?: number | null
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
  const [set2P1, setSet2P1] = useState(defaultValues?.set2Player1?.toString() ?? '')
  const [set2P2, setSet2P2] = useState(defaultValues?.set2Player2?.toString() ?? '')
  const [stbP1, setStbP1] = useState(defaultValues?.superTbPlayer1?.toString() ?? '')
  const [stbP2, setStbP2] = useState(defaultValues?.superTbPlayer2?.toString() ?? '')
  const [error, setError] = useState('')

  const isTwoSets = matchFormat === 'TWO_SETS_SUPERTB'

  // Detect if sets are 1-1 for showing super tiebreak
  const s1Winner = Number(set1P1) > Number(set1P2) ? 1 : Number(set1P2) > Number(set1P1) ? 2 : 0
  const s2Winner = Number(set2P1) > Number(set2P2) ? 1 : Number(set2P2) > Number(set2P1) ? 2 : 0
  const showSuperTb = isTwoSets && s1Winner !== 0 && s2Winner !== 0 && s1Winner !== s2Winner

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const data: Record<string, unknown> = {
      set1Player1: set1P1,
      set1Player2: set1P2,
    }

    if (isTwoSets) {
      data.set2Player1 = set2P1
      data.set2Player2 = set2P2
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
      {/* Header */}
      <div className="grid grid-cols-[1fr_80px_80px] gap-2 items-end">
        <div />
        <Label className="text-center text-xs truncate">{player1Name}</Label>
        <Label className="text-center text-xs truncate">{player2Name}</Label>
      </div>

      {/* Set 1 */}
      <div className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
        <Label>Set 1</Label>
        <Input
          type="number"
          min={0}
          max={7}
          value={set1P1}
          onChange={(e) => setSet1P1(e.target.value)}
          className="text-center"
          required
        />
        <Input
          type="number"
          min={0}
          max={7}
          value={set1P2}
          onChange={(e) => setSet1P2(e.target.value)}
          className="text-center"
          required
        />
      </div>

      {/* Set 2 */}
      {isTwoSets && (
        <div className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
          <Label>Set 2</Label>
          <Input
            type="number"
            min={0}
            max={7}
            value={set2P1}
            onChange={(e) => setSet2P1(e.target.value)}
            className="text-center"
            required
          />
          <Input
            type="number"
            min={0}
            max={7}
            value={set2P2}
            onChange={(e) => setSet2P2(e.target.value)}
            className="text-center"
            required
          />
        </div>
      )}

      {/* Super Tiebreak */}
      {showSuperTb && (
        <div className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
          <Label>Super TB</Label>
          <Input
            type="number"
            min={0}
            max={99}
            value={stbP1}
            onChange={(e) => setStbP1(e.target.value)}
            className="text-center"
            required
          />
          <Input
            type="number"
            min={0}
            max={99}
            value={stbP2}
            onChange={(e) => setStbP2(e.target.value)}
            className="text-center"
            required
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Guardando...' : defaultValues ? 'Actualizar resultado' : 'Cargar resultado'}
      </Button>
    </form>
  )
}
