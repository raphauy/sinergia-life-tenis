import type { ChallengeBalance, ChallengeSideBalance } from '@/services/ladder-player-stats-service'

/** "8 aceptados · 2 rechazados · 1 expirado" — omite los desenlaces en cero. */
function breakdown(side: ChallengeSideBalance): string {
  const parts: string[] = []
  const p = (n: number, singular: string, plural: string) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? singular : plural}`)
  }
  p(side.accepted, 'aceptado', 'aceptados')
  p(side.rejected, 'rechazado', 'rechazados')
  p(side.expired, 'expirado', 'expirados')
  p(side.cancelled, 'cancelado', 'cancelados')
  p(side.open, 'abierto', 'abiertos')
  return parts.join(' · ')
}

function Row({ label, side, extra }: { label: string; side: ChallengeSideBalance; extra?: string }) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-3">
      <span className="w-20 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="shrink-0 text-sm font-bold tabular-nums">{side.total}</span>
      <span className="min-w-0 flex-1 text-xs text-muted-foreground">
        {breakdown(side)}
        {extra && <span className="ml-1.5 font-semibold text-foreground">· {extra}</span>}
      </span>
    </div>
  )
}

/**
 * Balance de retos del miembro (público a conciencia; ver glosario): enviados y
 * recibidos con desglose por desenlace + % de respuesta positiva al ser retado.
 * Oculta si nunca participó de un reto.
 */
export function ChallengeBalanceCard({ balance }: { balance: ChallengeBalance | null }) {
  if (!balance || balance.sent.total + balance.received.total === 0) return null

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Retos</h2>
      <div className="divide-y rounded-lg border bg-card">
        <Row label="Enviados" side={balance.sent} />
        <Row
          label="Recibidos"
          side={balance.received}
          extra={balance.positivePct != null ? `${balance.positivePct}% acepta` : undefined}
        />
      </div>
    </section>
  )
}
