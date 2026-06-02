import Link from 'next/link'
import { signOut } from '@/lib/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { LogOut, UserPen, ChevronDown, Settings, User } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

interface UserMenuUser {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  image?: string | null
  role?: string | null
}

interface UserMenuProps {
  user: UserMenuUser
  /** Link al panel propio (panel de jugador o admin). Si null, no se muestra el ítem. */
  panelHref?: string | null
  panelLabel?: string | null
}

/**
 * Menú de cuenta (avatar + identidad + tema + cerrar sesión) para usuarios
 * logueados. Se usa en el header público y en el panel del jugador.
 */
export function UserMenu({ user, panelHref, panelLabel }: UserMenuProps) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
  const initials =
    [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const isAdmin = user.role === 'SUPERADMIN' || user.role === 'ADMIN'
  const PanelIcon = isAdmin ? Settings : User

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-auto gap-1.5 px-1.5 py-1" />}>
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.image || undefined} />
          <AvatarFallback className="text-xs bg-primary/15 text-primary font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="hidden sm:inline truncate max-w-[120px]">{fullName || user.email}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{fullName || 'Usuario'}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
          <Badge className="ml-2 shrink-0 text-[10px] border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            {isAdmin ? 'Admin' : 'Jugador'}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        {panelHref && panelLabel && (
          <DropdownMenuItem render={<Link href={panelHref} />}>
            <PanelIcon className="mr-2 h-4 w-4" />
            {panelLabel}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link href="/perfil" />}>
          <UserPen className="mr-2 h-4 w-4" />
          Perfil
        </DropdownMenuItem>
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <span>Tema</span>
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <DropdownMenuItem render={<button type="submit" className="w-full" />} nativeButton>
            <LogOut className="mr-2 h-4 w-4" />
            <span className="text-destructive">Cerrar sesión</span>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
