import { IconTooltip } from '@/components/icon-tooltip'
import { PROTECTION_META } from '@/components/protection-meta'
import { formatDateUY } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { ProtectionReason } from '@prisma/client'

/**
 * Ícono de Ranking protegido por motivo (lesión = cruz roja, viaje = avión, otro =
 * escudo) con tooltip clickeable (apto mobile): "Protegido · {Motivo} · hasta
 * DD/MM · {nota}". No renderiza nada si no hay protección.
 */
export function ProtectionBadge({
  protection,
  className,
}: {
  protection: { reason: ProtectionReason; note: string | null; endDate: Date | null } | null
  className?: string
}) {
  if (!protection) return null
  const { label, Icon, icon } = PROTECTION_META[protection.reason]
  const until = protection.endDate ? ` · hasta ${formatDateUY(protection.endDate)}` : ''
  const note = protection.note ? ` · ${protection.note}` : ''

  return (
    <IconTooltip label={`Protegido · ${label}${until}${note}`} className={cn(icon, className)}>
      <Icon className="h-[18px] w-[18px]" />
    </IconTooltip>
  )
}
