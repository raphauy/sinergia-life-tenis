import Image from 'next/image'
import Link from 'next/link'
import { auth, signOut } from '@/lib/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { LogOut, Settings, UserCircle, ChevronDown } from 'lucide-react'

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
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href={`/jugador/${playerId}`} className="flex items-center gap-2">
            <Image src="/favicon.ico" alt="" width={20} height={20} className="h-5 w-5" />
            <span className="font-bold">Sinergia Life Tenis</span>
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
                    <AvatarFallback className="text-xs">
                      {(session.user.name?.[0] || '?').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline truncate max-w-[120px]">
                    {session.user.name || session.user.email}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem render={<Link href="/perfil" />}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    Editar perfil
                  </DropdownMenuItem>
                  <form
                    action={async () => {
                      'use server'
                      await signOut({ redirectTo: '/login' })
                    }}
                  >
                    <DropdownMenuItem render={<button type="submit" className="w-full" />}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Cerrar sesión
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
