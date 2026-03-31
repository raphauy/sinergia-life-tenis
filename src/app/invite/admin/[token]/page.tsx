import { getAdminInvitationByToken } from '@/services/admin-invitation-service'
import { AcceptAdminInvitation } from './accept-admin-invitation'

interface Props {
  params: Promise<{ token: string }>
}

export const metadata = { title: 'Aceptar invitación - Sinergia Life Tenis' }

export default async function AdminInvitePage({ params }: Props) {
  const { token } = await params
  const invitation = await getAdminInvitationByToken(token)

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2">Invitación no encontrada</h1>
          <p className="text-muted-foreground">Este enlace es inválido o ya fue utilizado.</p>
        </div>
      </div>
    )
  }

  if (invitation.acceptedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2">Invitación ya aceptada</h1>
          <a href="/login" className="text-primary underline text-sm">Ir a login</a>
        </div>
      </div>
    )
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2">Invitación expirada</h1>
          <p className="text-muted-foreground">Contactá al administrador para una nueva invitación.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="rounded-lg border bg-card p-8 text-center space-y-5">
          <h1 className="text-xl font-bold text-primary">Sinergia Life Tenis</h1>
          <h2 className="text-lg font-semibold">Invitación de administrador</h2>
          <p className="text-muted-foreground text-sm">
            <strong>{invitation.invitedBy.name || invitation.invitedBy.email}</strong> te
            invitó a ser administrador de la plataforma.
          </p>
          <AcceptAdminInvitation token={token} />
        </div>
      </div>
    </div>
  )
}
