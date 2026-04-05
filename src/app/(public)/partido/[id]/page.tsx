import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMatchById } from '@/services/match-service'
import { prisma } from '@/lib/prisma'
import { fullName } from '@/lib/format-name'
import { formatMatchScore } from '@/lib/format-score'
import { formatDateUY, formatTimeUY, friendlyDateTimeUY } from '@/lib/date-utils'
import { COURTS, TIMEZONE } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { BackButton } from '@/components/back-button'
import { MATCH_STATUS_LABELS, MATCH_STATUS_VARIANTS } from '@/lib/match-status'
import { auth } from '@/lib/auth'
import { toZonedTime } from 'date-fns-tz'
import { differenceInCalendarDays } from 'date-fns'
import { CalendarCheck, Sun, Sunset } from 'lucide-react'
import { getReservationByMatch } from '@/services/reservation-service'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const match = await getMatchById(id)
  if (!match) return { title: 'Partido no encontrado' }

  const p1 = fullName(match.player1.firstName, match.player1.lastName)
  const p2 = fullName(match.player2.firstName, match.player2.lastName)
  const title = `${p1} vs ${p2} - ${match.tournament.name}`
  const description = `${p1} vs ${p2} - Categoría ${match.category.name} - ${match.tournament.name}`

  return { title, description, openGraph: { title, description } }
}


export default async function PartidoPublicPage({ params }: Props) {
  const { id } = await params
  const match = await getMatchById(id)
  if (!match) notFound()

  const p1Name = fullName(match.player1.firstName, match.player1.lastName) || 'Jugador 1'
  const p2Name = fullName(match.player2.firstName, match.player2.lastName) || 'Jugador 2'
  const court = COURTS.find((c) => c.number === match.courtNumber)

  // Get player slugs for linking
  const playerSlugs = await prisma.player.findMany({
    where: { userId: { in: [match.player1Id, match.player2Id] }, isActive: true },
    select: { slug: true, userId: true },
  })
  const slugMap = new Map(playerSlugs.map((p) => [p.userId, p.slug]))
  const p1Slug = slugMap.get(match.player1Id)
  const p2Slug = slugMap.get(match.player2Id)

  // Check if logged-in user is a participant
  const session = await auth()
  const currentUserId = session?.user?.id
  const isAdmin = session?.user?.role === 'SUPERADMIN' || session?.user?.role === 'ADMIN'
  const isParticipant = currentUserId === match.player1Id || currentUserId === match.player2Id
  const canAct = isParticipant || isAdmin
  // Find the slug of the current user's player to build the action href
  const currentPlayerSlug = currentUserId ? slugMap.get(currentUserId) : undefined

  const winnerIs1 = match.result?.winnerId === match.player1Id
  const winnerIs2 = match.result?.winnerId === match.player2Id

  const r = match.result
  const score = r ? formatMatchScore(r) : null
  const reservation = match.status === 'PENDING' ? await getReservationByMatch(match.id) : null

  return (
    <div className="max-w-xl mx-auto">
      <BackButton />

      <div className="rounded-lg border p-6">
        {/* Tournament & category header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">{match.tournament.name}</h1>
            <Badge variant={MATCH_STATUS_VARIANTS[match.status] || 'outline'} className="text-[10px] px-1.5 py-0 min-w-[72px] text-center justify-center font-bold">
              {MATCH_STATUS_LABELS[match.status] || match.status}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <CategoryBadge name={match.category.name} />
            {match.group && (
              <Badge variant="secondary-outline">Grupo {match.group.number}</Badge>
            )}
          </div>
        </div>

        {/* Players & score */}
        <div className="flex items-center justify-between py-4 border-t">
          <div className="flex items-center gap-2 text-2xl">
            {p1Slug ? (
              <Link href={`/jugador/${p1Slug}`} className={`hover:underline ${winnerIs1 ? 'font-bold' : match.result ? 'font-normal' : 'font-semibold'}`}>
                {p1Name}
              </Link>
            ) : (
              <span className={winnerIs1 ? 'font-bold' : match.result ? 'font-normal' : 'font-semibold'}>{p1Name}</span>
            )}
            <span className="text-muted-foreground text-base">vs</span>
            {p2Slug ? (
              <Link href={`/jugador/${p2Slug}`} className={`hover:underline ${winnerIs2 ? 'font-bold' : match.result ? 'font-normal' : 'font-semibold'}`}>
                {p2Name}
              </Link>
            ) : (
              <span className={winnerIs2 ? 'font-bold' : match.result ? 'font-normal' : 'font-semibold'}>{p2Name}</span>
            )}
          </div>

          {score && (
            <span className="font-mono text-2xl font-bold">{score}</span>
          )}
        </div>

        {/* Winner */}
        {match.result && (
          <div className="pt-3 border-t text-sm">
            Ganador: <span className="font-medium">{winnerIs1 ? p1Name : p2Name}</span>
          </div>
        )}

        {/* Date & court */}
        {(match.scheduledAt || court) && (() => {
          let dateLabel = ''
          let isMorning = false
          if (match.scheduledAt) {
            const scheduledUY = toZonedTime(match.scheduledAt, TIMEZONE)
            isMorning = scheduledUY.getHours() < 12
            const time = `${formatTimeUY(match.scheduledAt)} hs`

            if (match.status !== 'PLAYED') {
              const nowUY = toZonedTime(new Date(), TIMEZONE)
              const diff = differenceInCalendarDays(scheduledUY, nowUY)
              if (diff === 0) dateLabel = `Hoy ${time}`
              else if (diff === 1) dateLabel = `Mañana ${time}`
              else if (diff >= 2 && diff <= 6) {
                const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
                dateLabel = `${days[scheduledUY.getDay()]} ${time}`
              } else {
                dateLabel = `${formatDateUY(match.scheduledAt, 'dd/MM')} ${time}`
              }
            } else {
              dateLabel = `${formatDateUY(match.scheduledAt, 'dd/MM')} ${time}`
            }
          }

          return (
            <div className={`flex items-center justify-between text-sm text-muted-foreground ${match.result ? 'pt-1' : 'pt-3 border-t'}`}>
              <span className="flex items-center gap-1.5">
                <span className="font-bold text-foreground">{dateLabel}</span>
                {match.scheduledAt && (
                  isMorning
                    ? <Sun className="h-4 w-4 text-yellow-500" />
                    : <Sunset className="h-4 w-4 text-indigo-400" />
                )}
              </span>
              {court && <span>{court.name}</span>}
            </div>
          )
        })()}

        {/* Reservation info */}
        {reservation && (
          <div className="pt-3 border-t mt-3 flex items-center justify-center gap-1.5 text-sm text-blue-600 dark:text-blue-400">
            <CalendarCheck className="h-4 w-4 shrink-0" />
            <span>
              Reservado {friendlyDateTimeUY(reservation.scheduledAt)} — pendiente de confirmación
            </span>
          </div>
        )}

        {/* Action link for participants */}
        {canAct && currentPlayerSlug && (
          <>
            {match.status === 'PENDING' && (
              <div className="pt-3 border-t mt-3">
                <Link href={`/jugador/${currentPlayerSlug}/partidos/${match.id}`} className="text-sm font-medium text-primary hover:underline">
                  Coordinar con tu rival →
                </Link>
              </div>
            )}
            {match.status === 'CONFIRMED' && !match.result && (
              <div className="pt-3 border-t mt-3">
                <Link href={`/jugador/${currentPlayerSlug}/partidos/${match.id}`} className="text-sm font-medium text-primary hover:underline">
                  Cargar resultado →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
