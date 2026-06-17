import { CalendarPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { googleCalendarUrl } from '@/lib/google-calendar'

/**
 * Link "Agendar" → abre Google Calendar pre-llenado con el partido. Link (no botón)
 * para ocupar poco. Componente puro (sin estado): sirve en server y client. Cuando va
 * dentro de una card clickeable, envolver con un span que pare la propagación.
 */
export function AddToCalendarLink({
  start,
  title,
  details,
  location,
  className,
}: {
  start: Date
  title: string
  details?: string
  location?: string
  className?: string
}) {
  return (
    <a
      href={googleCalendarUrl({ start, title, details, location })}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline',
        className
      )}
    >
      <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
      Agendar
    </a>
  )
}
