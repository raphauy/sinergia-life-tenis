import { NextRequest, NextResponse } from 'next/server'
import { runLadderDailyTasks } from '@/services/ladder-cron-service'

export const dynamic = 'force-dynamic'

// Cron diario (~01:00 UY). Expira retos vencidos, avisa/auto-cancela partidos
// pendientes sin reserva y manda el aviso pre-cierre de mes. Auth por CRON_SECRET.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runLadderDailyTasks()
  return NextResponse.json(result)
}
