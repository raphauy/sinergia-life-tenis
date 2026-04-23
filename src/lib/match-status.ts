export const MATCH_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  PLAYED: 'Jugado',
  CANCELLED: 'Cancelado',
}

export const MATCH_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning'> = {
  PENDING: 'warning',
  CONFIRMED: 'default',
  PLAYED: 'success',
  CANCELLED: 'destructive',
}

export const MATCH_STAGE_LABELS: Record<string, string> = {
  GROUP: 'Fase de grupos',
  QUARTERFINAL: 'Cuartos de final',
  SEMIFINAL: 'Semifinal',
  FINAL: 'Final',
}

export function stageLabel(stage: string | null | undefined): string | undefined {
  if (!stage || stage === 'GROUP') return undefined
  return MATCH_STAGE_LABELS[stage]
}
