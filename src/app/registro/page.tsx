import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPostLoginRedirect } from '@/services/user-service'
import { RegistroForm } from './registro-form'

export const metadata = {
  title: 'Registrarse',
  description: 'Registrate para sumarte a La Escalera de Life Tenis.',
}

export default async function RegistroPage() {
  // Si ya está logueado, no mostrar el registro: mandarlo a su destino según rol.
  const session = await auth()
  if (session?.user) {
    redirect(await getPostLoginRedirect(session.user.id, session.user.role))
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <RegistroForm />
    </div>
  )
}
