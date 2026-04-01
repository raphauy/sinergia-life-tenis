import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  LayoutDashboard,
  Trophy,
  Users,
  UserPlus,
  Swords,
  ChevronUp,
  ExternalLink,
  LogOut,
  UserCircle,
  UserPen,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { auth, signOut } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ThemeToggle } from '@/components/theme-toggle'

const navItems = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { title: 'Torneos', href: '/admin/torneos', icon: Trophy },
  { title: 'Jugadores', href: '/admin/jugadores', icon: Users },
  { title: 'Partidos', href: '/admin/partidos', icon: Swords },
  { title: 'Administradores', href: '/admin/invitaciones', icon: UserPlus, superadminOnly: true },
]

export async function AdminSidebar() {
  const session = await auth()
  if (!session?.user) return null

  const isSuperadmin = session.user.role === 'SUPERADMIN'

  const playerLink = await prisma.player.findFirst({
    where: { userId: session.user.id, isActive: true },
    select: { id: true },
  })

  return (
    <Sidebar>
      <SidebarHeader className="!h-14 border-b px-4 !flex !flex-row !items-center">
        <Link href="/admin" className="mr-auto">
          <Image src="/life-logo.png" alt="Life Tenis" width={120} height={40} className="block dark:hidden" />
          <Image src="/life-logo-dark.png" alt="Life Tenis" width={120} height={40} className="hidden dark:block" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems
                .filter((item) => !item.superadminOnly || isSuperadmin)
                .map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<Link href={item.href} />}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {playerLink && (
          <SidebarGroup>
            <SidebarGroupLabel>Jugador</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href={`/jugador/${playerLink.id}`} />}>
                    <UserCircle className="h-4 w-4" />
                    <span>Mi panel de jugador</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/" target="_blank" />}>
                  <ExternalLink className="h-4 w-4" />
                  <span>Ver sitio público</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton className="w-full" />}>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={session.user.image || undefined} />
                  <AvatarFallback className="text-xs bg-primary/15 text-primary font-semibold">
                    {[session.user.firstName?.[0], session.user.lastName?.[0]].filter(Boolean).join('').toUpperCase() || session.user.email?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{[session.user.firstName, session.user.lastName].filter(Boolean).join(' ') || session.user.email}</span>
                <ChevronUp className="ml-auto h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-64">
                <div className="flex items-center justify-between px-2 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">
                      {[session.user.firstName, session.user.lastName].filter(Boolean).join(' ') || 'Usuario'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {session.user.email}
                    </span>
                  </div>
                  <Badge className={cn(
                    'text-[10px] ml-2',
                    session.user.role === 'SUPERADMIN'
                      ? 'border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                      : 'border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                  )}>
                    {session.user.role === 'SUPERADMIN' ? 'Superadmin' : 'Admin'}
                  </Badge>
                </div>
                <DropdownMenuSeparator />
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
                  <DropdownMenuItem render={<button type="submit" />} nativeButton>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span className="text-destructive">Cerrar sesión</span>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
