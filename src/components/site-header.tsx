import Link from 'next/link'
import Image from 'next/image'
import { LogIn } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getActivePlayerSlugByUserId } from '@/services/player-service'
import { PublicNav } from '@/components/public-nav'
import { UserMenu } from '@/components/user-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Header común de todo el sitio: logo + navegación (La Escalera / Partidos /
 * Calendario) + menú de cuenta (o "Ingresar"). Único en home, páginas públicas y
 * panel de jugador, para que el menú sea idéntico y no se desincronice.
 */
export async function SiteHeader({ sticky = false }: { sticky?: boolean }) {
  const session = await auth()
  const user = session?.user

  const panels: { href: string; label: string; kind: 'admin' | 'player' }[] = []
  if (user) {
    const isAdmin = user.role === 'SUPERADMIN' || user.role === 'ADMIN'
    if (isAdmin) {
      panels.push({ href: '/admin', label: 'Panel de administración', kind: 'admin' })
    }
    // Un admin/superadmin puede además ser jugador del torneo: mostramos ambos accesos.
    const slug = await getActivePlayerSlugByUserId(user.id)
    if (slug) {
      panels.push({
        href: `/jugador/${slug}`,
        label: isAdmin ? 'Mi panel de jugador' : 'Mi panel',
        kind: 'player',
      })
    }
  }

  return (
    <header className={cn('border-b bg-white dark:bg-black', sticky && 'sticky top-0 z-50')}>
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/">
          <Image src="/life-logo.png" alt="Life Tenis" width={120} height={40} className="block dark:hidden" />
          <Image src="/life-logo-dark.png" alt="Life Tenis" width={120} height={40} className="hidden dark:block" />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <PublicNav />
          {user ? (
            <UserMenu user={user} panels={panels} />
          ) : (
            <Button variant="ghost" size="sm" render={<Link href="/login" />}>
              <LogIn className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Ingresar</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
