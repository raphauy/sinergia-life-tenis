import { NextRequest, NextResponse } from 'next/server'
import { remindMissingResults } from '@/services/ladder-cron-service'

export const dynamic = 'force-dynamic'

// Diario 12:00 UTC = 9:00 UY. Recordatorio a los dos jugadores por cada partido de
// escalera cuyo horario ya pasó y sigue sin resultado, desde la mañana siguiente y
// todos los días hasta que lo carguen o cancelen el partido. Cuando alguno supera
// `resultReminderAdminDays`, el digest va también a los admins. Auth por CRON_SECRET.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await remindMissingResults()
  return NextResponse.json(result)
}
