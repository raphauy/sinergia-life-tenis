import { getPendingAdminInvitations } from '@/services/admin-invitation-service'
import { AdminInvitationsClient } from './admin-invitations-client'

export const metadata = { title: 'Invitaciones de admin - Sinergia Life Tenis' }

export default async function InvitacionesPage() {
  const invitations = await getPendingAdminInvitations()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Invitaciones de administrador</h1>
      <AdminInvitationsClient invitations={invitations} />
    </div>
  )
}
