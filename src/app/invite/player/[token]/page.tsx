import { getPlayerByInvitationToken } from '@/services/player-invitation-service'
import { AcceptPlayerInvitation } from './accept-player-invitation'

interface Props {
  params: Promise<{ token: string }>
}

export const metadata = { title: 'Aceptar invitación - Life Tenis' }

export default async function PlayerInvitePage({ params }: Props) {
  const { token } = await params
  const player = await getPlayerByInvitationToken(token)

  if (!player) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2">Invitación no encontrada</h1>
          <p className="text-muted-foreground">
            Este enlace es inválido o ya fue utilizado.
          </p>
        </div>
      </div>
    )
  }

  if (player.acceptedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2">Invitación ya aceptada</h1>
          <p className="text-muted-foreground">
            Ya aceptaste esta invitación. Podés iniciar sesión.
          </p>
          <a href="/login" className="text-primary underline text-sm mt-2 inline-block">
            Ir a login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="rounded-lg border bg-card p-8 text-center space-y-5">
          <h1 className="text-xl font-bold text-primary">Life Tenis</h1>
          <h2 className="text-lg font-semibold">¡Hola {player.name}!</h2>
          <p className="text-muted-foreground text-sm">
            Has sido invitado al torneo <strong>{player.tournament.name}</strong> en la
            categoría <strong>{player.category.name}</strong>.
          </p>
          <AcceptPlayerInvitation token={token} email={player.email || ''} />
        </div>
      </div>
    </div>
  )
}
