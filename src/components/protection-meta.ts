import { HeartPulse, Plane, Shield } from 'lucide-react'
import type { ProtectionReason } from '@prisma/client'

/**
 * Metadata de presentación del Ranking protegido por motivo (label en español,
 * ícono lucide, color del ícono y clases del pill). Fuente única para tabla,
 * perfil y admin.
 */
export const PROTECTION_META: Record<
  ProtectionReason,
  { label: string; Icon: typeof HeartPulse; icon: string; pill: string }
> = {
  INJURY: {
    label: 'Lesión',
    Icon: HeartPulse,
    icon: 'text-red-600 dark:text-red-400',
    pill: 'border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
  },
  TRAVEL: {
    label: 'Viaje',
    Icon: Plane,
    icon: 'text-sky-600 dark:text-sky-400',
    pill: 'border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  },
  OTHER: {
    label: 'Otro',
    Icon: Shield,
    icon: 'text-slate-500 dark:text-slate-400',
    pill: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  },
}
