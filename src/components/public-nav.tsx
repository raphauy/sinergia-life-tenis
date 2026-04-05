import Link from 'next/link'
import { Trophy, CalendarDays, LayoutList, User, LogIn } from 'lucide-react'

interface PublicNavProps {
  userHref: string | null
}

export function PublicNav({ userHref }: PublicNavProps) {
  return (
    <nav className="flex items-center gap-1">
      <NavLink href="/ranking" icon={<Trophy className="h-5 w-5" />} label="Ranking" />
      <NavLink href="/fixture" icon={<LayoutList className="h-5 w-5" />} label="Fixture" />
      <NavLink href="/calendario" icon={<CalendarDays className="h-5 w-5" />} label="Calendario" />
      {userHref ? (
        <NavLink href={userHref} icon={<User className="h-5 w-5" />} label="Mi panel" />
      ) : (
        <NavLink href="/login" icon={<LogIn className="h-5 w-5" />} label="Ingresar" />
      )}
    </nav>
  )
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
    >
      {icon}
      <span className="text-[10px] leading-none font-medium">{label}</span>
    </Link>
  )
}
