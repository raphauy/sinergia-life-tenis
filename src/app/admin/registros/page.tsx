import { getPendingPlayerRegistrations } from '@/services/player-registration-service'
import { getLadder } from '@/services/ladder-service'
import { RegistrosClient } from './registros-client'

export const metadata = { title: 'Registros pendientes' }

export default async function RegistrosPage() {
  const [registrations, ladder] = await Promise.all([
    getPendingPlayerRegistrations(),
    getLadder(),
  ])
  return <RegistrosClient registrations={registrations} seedStep={ladder?.seedStep ?? 20} />
}
