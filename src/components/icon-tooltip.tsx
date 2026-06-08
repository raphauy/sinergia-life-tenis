"use client"

import { useState, type ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Props {
  /** Texto del tooltip (también queda como aria-label del trigger). */
  label: string
  /** El ícono a mostrar (define su propio color/tamaño). */
  children: ReactNode
  className?: string
}

/**
 * Ícono con tooltip apto para mobile. El tooltip de base-ui solo abre por hover
 * (mouse) o focus de teclado, NO por tap; acá lo controlamos para que un tap lo
 * abra/cierre (toggle), conservando el hover en desktop y el cierre por
 * tap-afuera / Escape. Pensado para badges inline al lado de un nombre.
 */
export function IconTooltip({ label, children, className }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <TooltipProvider delay={0}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          closeOnClick={false}
          onClick={() => setOpen((o) => !o)}
          aria-label={label}
          className={cn(
            // -m-1 p-1 agranda el área de tap (~32px) sin correr a los vecinos
            'inline-flex shrink-0 -m-1 items-center justify-center rounded-sm p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
          )}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
