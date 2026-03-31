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
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  LayoutDashboard,
  Trophy,
  Users,
  UserPlus,
  Swords,
  ChevronUp,
  LogOut,
  UserCircle,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { auth, signOut } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const navItems = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { title: 'Torneos', href: '/admin/torneos', icon: Trophy },
  { title: 'Jugadores', href: '/admin/jugadores', icon: Users },
  { title: 'Partidos', href: '/admin/partidos', icon: Swords },
  { title: 'Invitaciones', href: '/admin/invitaciones', icon: UserPlus, superadminOnly: true },
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
      <SidebarHeader className="!h-14 border-b px-4 bg-white dark:bg-black !flex !flex-row !items-center">
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
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton className="w-full" />}>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={session.user.image || undefined} />
                  <AvatarFallback className="text-xs">
                    {(session.user.name?.[0] || session.user.email?.[0] || '?').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{session.user.name || session.user.email}</span>
                <ChevronUp className="ml-auto h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-64">
                <div className="flex items-center justify-between px-2 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">
                      {session.user.name || 'Usuario'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {session.user.email}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] ml-2">
                    {session.user.role === 'SUPERADMIN' ? 'Superadmin' : 'Admin'}
                  </Badge>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/perfil" />}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>
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
