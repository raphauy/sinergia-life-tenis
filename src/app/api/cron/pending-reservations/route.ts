import { NextRequest, NextResponse } from 'next/server'
import { notifyAdminsPendingReservations } from '@/services/ladder-cron-service'

export const dynamic = 'force-dynamic'

// Diario 23:00 UTC = 20:00 UY. Avisa a los admins de las reservas de escalera sin
// confirmar cuando hay alguna para mañana o pasado mañana: la app del club abre el
// día anterior al partido a las 9 hs y ahí se pierde el horario. Auth por CRON_SECRET.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await notifyAdminsPendingReservations()
  return NextResponse.json(result)
}
