import { cookies } from 'next/headers'
import Link from 'next/link'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AdminSidebar } from '@/components/admin-sidebar'
import { AdminHeader } from '@/components/admin-header'
import { SidebarCloseOnNav } from '@/components/sidebar-close-on-nav'
import { getActiveTournament } from '@/services/tournament-service'
import { getPendingReservationCount } from '@/services/reservation-service'
import { CalendarCheck } from 'lucide-react'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  const tournament = await getActiveTournament()
  const reservationCount = tournament ? await getPendingReservationCount(tournament.id) : 0

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AdminSidebar />
      <SidebarCloseOnNav />
      <SidebarInset>
        <AdminHeader />
        {reservationCount > 0 && (
          <div className="mx-4 mt-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-2">
            <Link href="/admin" className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 hover:underline">
              <CalendarCheck className="h-4 w-4 shrink-0" />
              <span>
                Tenés <strong>{reservationCount}</strong> {reservationCount === 1 ? 'reserva pendiente' : 'reservas pendientes'} de confirmar
              </span>
            </Link>
          </div>
        )}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
