import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'

/**
 * Sección colapsable de la doc de usuario de La Escalera (/escalera).
 * Es un componente de servidor: el estado abierto/cerrado lo maneja el
 * primitivo Collapsible (base-ui) en el cliente, y el chevron rota por CSS
 * (`group-data-[open]`). Recibe `children` ya renderizados con los valores de
 * config interpolados.
 */
export function DocSection({
  icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border bg-card">
      <CollapsibleTrigger className="group flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-left cursor-pointer transition-colors hover:bg-muted/50">
        <span className="shrink-0 text-primary">{icon}</span>
        <span className="flex-1 font-semibold">{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <div className="space-y-3 pt-1 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
