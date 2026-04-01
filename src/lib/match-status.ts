export const MATCH_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  PLAYED: 'Jugado',
  CANCELLED: 'Cancelado',
}

export const MATCH_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive' | 'success'> = {
  PENDING: 'outline',
  CONFIRMED: 'default',
  PLAYED: 'success',
  CANCELLED: 'destructive',
}
