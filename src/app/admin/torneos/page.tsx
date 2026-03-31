import Link from 'next/link'
import { getTournaments } from '@/services/tournament-service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/category-badge'
import { formatDateUY } from '@/lib/date-utils'
import { Plus } from 'lucide-react'

export const metadata = { title: 'Torneos - Sinergia Life Tenis' }

export default async function TorneosPage() {
  const tournaments = await getTournaments()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Torneos</h1>
          <p className="text-muted-foreground text-sm">{tournaments.length} torneo(s)</p>
        </div>
        <Button render={<Link href="/admin/torneos/nuevo" />}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo torneo
        </Button>
      </div>

      {tournaments.length === 0 ? (
        <p className="text-muted-foreground">No hay torneos creados.</p>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/admin/torneos/${t.id}`}
              className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{t.name}</h2>
                    {t.isActive && <Badge>Activo</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDateUY(t.startDate)} - {formatDateUY(t.endDate)}
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>{t._count.players} jugadores</p>
                  <p>{t._count.matches} partidos</p>
                </div>
              </div>
              <div className="flex gap-1 mt-2">
                {t.categories.map((c) => (
                  <CategoryBadge key={c.id} name={c.name} />
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
