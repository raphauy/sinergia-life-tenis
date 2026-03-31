import Image from 'next/image'
import Link from 'next/link'
import { auth, signOut } from '@/lib/auth'
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
import { LogOut, Settings, UserPen, ChevronDown } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

interface JugadorLayoutProps {
  children: React.ReactNode
  params: Promise<{ playerId: string }>
}

export default async function JugadorLayout({ children, params }: JugadorLayoutProps) {
  const { playerId } = await params
  const session = await auth()
  const isAdmin = session?.user?.role === 'SUPERADMIN' || session?.user?.role === 'ADMIN'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white dark:bg-black">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/">
            <Image src="/life-logo.png" alt="Life Tenis" width={120} height={40} className="block dark:hidden" />
            <Image src="/life-logo-dark.png" alt="Life Tenis" width={120} height={40} className="hidden dark:block" />
          </Link>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="ghost" size="sm" render={<Link href="/admin" />}>
                <Settings className="h-4 w-4 mr-1" />
                Admin
              </Button>
            )}

            {session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={session.user.image || undefined} />
                    <AvatarFallback className="text-xs bg-primary/15 text-primary font-semibold">
                      {(session.user.name?.[0] || '?').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline truncate max-w-[120px]">
                    {session.user.name || session.user.email}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="flex items-center justify-between px-2 py-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">
                        {session.user.name || 'Usuario'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {session.user.email}
                      </span>
                    </div>
                    <Badge className="text-[10px] ml-2 border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      Jugador
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
                    <DropdownMenuItem render={<button type="submit" className="w-full" />} nativeButton>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span className="text-destructive">Cerrar sesión</span>
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="sm" render={<Link href="/login" />}>
                Iniciar sesión
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
