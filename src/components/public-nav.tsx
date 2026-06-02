'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, CalendarDays, LayoutList } from 'lucide-react'
import { cn } from '@/lib/utils'

/** El home (ranking) se llega por el logo; cada ítem matchea su ruta y sub-rutas. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PublicNav() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-1">
      <NavLink href="/escalera" icon={<BookOpen className="h-5 w-5" />} label="La Escalera" pathname={pathname} />
      <NavLink href="/partidos" icon={<LayoutList className="h-5 w-5" />} label="Partidos" pathname={pathname} />
      <NavLink href="/calendario" icon={<CalendarDays className="h-5 w-5" />} label="Calendario" pathname={pathname} />
    </nav>
  )
}

function NavLink({
  href,
  icon,
  label,
  pathname,
}: {
  href: string
  icon: React.ReactNode
  label: string
  pathname: string
}) {
  const active = isActive(pathname, href)
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-md transition-colors',
        active
          ? 'text-primary bg-muted font-semibold'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      )}
    >
      {icon}
      <span className="text-[10px] leading-none font-medium whitespace-nowrap">{label}</span>
    </Link>
  )
}
