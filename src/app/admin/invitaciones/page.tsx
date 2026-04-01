import { auth } from '@/lib/auth'
import { getPendingAdminInvitations } from '@/services/admin-invitation-service'
import { getAdminUsers } from '@/services/user-service'
import { AdminUsersClient } from './admin-invitations-client'

export const metadata = { title: 'Usuarios admin - Life Tenis' }

export default async function InvitacionesPage() {
  const session = await auth()
  const [invitations, adminUsers] = await Promise.all([
    getPendingAdminInvitations(),
    getAdminUsers(),
  ])

  return (
    <AdminUsersClient
      invitations={invitations as Parameters<typeof AdminUsersClient>[0]['invitations']}
      adminUsers={adminUsers as Parameters<typeof AdminUsersClient>[0]['adminUsers']}
      currentUserId={session!.user.id}
    />
  )
}
