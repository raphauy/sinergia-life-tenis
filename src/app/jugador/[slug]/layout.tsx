import { SiteHeader } from '@/components/site-header'

interface JugadorLayoutProps {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default function JugadorLayout({ children }: JugadorLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
