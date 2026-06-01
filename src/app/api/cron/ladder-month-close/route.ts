import { NextRequest, NextResponse } from 'next/server'
import { previousMonthInUY } from '@/lib/date-utils'
import { closeLadderMonth } from '@/services/ladder-cron-service'

export const dynamic = 'force-dynamic'

// Cron mensual (1º 00:00 UY). Cierra el mes recién terminado: multa de puntos a
// quien no llegó al mínimo. Idempotente. Auth por CRON_SECRET (header de Vercel).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { year, month } = previousMonthInUY()
  const result = await closeLadderMonth(year, month)
  return NextResponse.json({ year, month, ...result })
}
