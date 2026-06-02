import { SiteHeader } from '@/components/site-header'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto p-4 md:p-6">{children}</main>
    </div>
  )
}
