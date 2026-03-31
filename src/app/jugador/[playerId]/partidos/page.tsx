import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMatchesByPlayer } from '@/services/match-service'
import { Badge } from '@/components/ui/badge'
import { formatDateTimeUY } from '@/lib/date-utils'
import { COURTS } from '@/lib/constants'

interface Props {
  params: Promise<{ playerId: string }>
}

export const metadata = { title: 'Mis partidos - Sinergia Life Tenis' }

export default async function JugadorPartidosPage({ params }: Props) {
  const { playerId } = await params
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { userId: true },
  })
  if (!player?.userId) notFound()
  const userId = player.userId

  const matches = await getMatchesByPlayer(userId)
  const upcoming = matches.filter((m) => m.status === 'CONFIRMED')
  const pending = matches.filter((m) => m.status === 'PENDING')
  const played = matches.filter((m) => m.status === 'PLAYED')

  function getRivalName(match: (typeof matches)[0]) {
    return match.player1Id === userId ? match.player2.name : match.player1.name
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Mis partidos</h1>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold mb-2">Confirmados ({upcoming.length})</h2>
          <div className="space-y-2">
            {upcoming.map((m) => (
              <Link
                key={m.id}
                href={`/jugador/${playerId}/partidos/${m.id}`}
                className="block rounded-lg border p-3 hover:bg-muted/50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">vs {getRivalName(m)}</p>
                    {m.scheduledAt && (
                      <p className="text-sm text-muted-foreground">
                        {formatDateTimeUY(m.scheduledAt)}
                        {m.courtNumber && ` — ${COURTS.find((c) => c.number === m.courtNumber)?.name}`}
                      </p>
                    )}
                  </div>
                  <Badge>Confirmado</Badge>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold mb-2">Pendientes ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((m) => (
              <div key={m.id} className="rounded-lg border p-3">
                <div className="flex justify-between items-center">
                  <p className="font-medium">vs {getRivalName(m)}</p>
                  <Badge variant="outline">Pendiente</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      <section>
        <h2 className="font-semibold mb-2">Historial ({played.length})</h2>
        {played.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin partidos jugados.</p>
        ) : (
          <div className="space-y-2">
            {played.map((m) => {
              const won = m.result?.winnerId === userId
              const r = m.result
              let score = ''
              if (r) {
                score = `${r.set1Player1}-${r.set1Player2}`
                if (r.set2Player1 != null) score += ` ${r.set2Player1}-${r.set2Player2}`
                if (r.superTbPlayer1 != null) score += ` [${r.superTbPlayer1}-${r.superTbPlayer2}]`
              }
              return (
                <Link
                  key={m.id}
                  href={`/jugador/${playerId}/partidos/${m.id}`}
                  className="block rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">vs {getRivalName(m)}</p>
                      <p className="text-sm font-mono">{score}</p>
                    </div>
                    <Badge variant={won ? 'default' : 'secondary'}>
                      {won ? 'Victoria' : 'Derrota'}
                    </Badge>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
