import { getPendingPlayerRegistrations } from '@/services/player-registration-service'
import { RegistrosClient } from './registros-client'

export const metadata = { title: 'Registros pendientes' }

export default async function RegistrosPage() {
  const registrations = await getPendingPlayerRegistrations()
  return <RegistrosClient registrations={registrations} />
}
