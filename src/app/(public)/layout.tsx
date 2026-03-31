import Link from 'next/link'
import Image from 'next/image'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/favicon.ico" alt="" width={20} height={20} className="h-5 w-5" />
            <span className="font-bold">Sinergia Life Tenis</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/ranking" className="text-muted-foreground hover:text-foreground">
              Ranking
            </Link>
            <Link href="/fixture" className="text-muted-foreground hover:text-foreground">
              Fixture
            </Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 md:p-6">{children}</main>
    </div>
  )
}
