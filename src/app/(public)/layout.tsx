import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  let userHref: string | null = null
  if (session?.user) {
    if (session.user.role === 'SUPERADMIN' || session.user.role === 'ADMIN') {
      userHref = '/admin'
    } else {
      const player = await prisma.player.findFirst({
        where: { userId: session.user.id, isActive: true },
        select: { slug: true },
      })
      userHref = player ? `/jugador/${player.slug}` : '/perfil'
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white dark:bg-black">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/">
            <Image src="/life-logo.png" alt="Life Tenis" width={120} height={40} className="block dark:hidden" />
            <Image src="/life-logo-dark.png" alt="Life Tenis" width={120} height={40} className="hidden dark:block" />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/ranking" className="text-muted-foreground hover:text-foreground">
              Ranking
            </Link>
            <Link href="/fixture" className="text-muted-foreground hover:text-foreground">
              Fixture
            </Link>
            {userHref ? (
              <Link href={userHref} className="text-muted-foreground hover:text-foreground">
                Mi panel
              </Link>
            ) : (
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                Iniciar sesión
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 md:p-6">{children}</main>
    </div>
  )
}
