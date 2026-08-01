'use client'

import type { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export type ProfileTab = 'estadisticas' | 'partidos'

/**
 * Tabs del perfil del jugador (estilo underline, variant line). Los paneles
 * llegan como children RSC — acá solo vive el switch. El cambio de tab se
 * refleja en la URL con replaceState (?tab=partidos; Estadísticas es la
 * default y va sin param) para que el link compartido caiga en la tab justa.
 */
export function ProfileTabs({
  defaultTab,
  pendingCount,
  statsPanel,
  matchesPanel,
}: {
  defaultTab: ProfileTab
  /** Retos recibidos sin responder del dueño (badge en la tab Partidos). */
  pendingCount: number
  statsPanel: ReactNode
  matchesPanel: ReactNode
}) {
  const onValueChange = (value: unknown) => {
    const url = new URL(window.location.href)
    if (value === 'partidos') url.searchParams.set('tab', 'partidos')
    else url.searchParams.delete('tab')
    window.history.replaceState(null, '', url)
  }

  return (
    <Tabs defaultValue={defaultTab} onValueChange={onValueChange}>
      {/* group-data-horizontal/tabs:h-auto pisa el h-8 del variant (mismo prefijo → tw-merge lo dedupea) */}
      <TabsList variant="line" className="mb-6 w-full justify-start gap-4 border-b p-0 group-data-horizontal/tabs:h-auto">
        <TabsTrigger value="estadisticas" className="h-auto flex-none px-1 pb-2 group-data-horizontal/tabs:after:bottom-[-1px]">
          Estadísticas
        </TabsTrigger>
        <TabsTrigger value="partidos" className="h-auto flex-none px-1 pb-2 group-data-horizontal/tabs:after:bottom-[-1px]">
          Partidos
          {pendingCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
              {pendingCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="estadisticas" className="text-base">
        {statsPanel}
      </TabsContent>
      <TabsContent value="partidos" className="text-base">
        {matchesPanel}
      </TabsContent>
    </Tabs>
  )
}
