import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPostLoginRedirect } from '@/services/user-service'
import { LoginForm } from './login-form'

export const metadata = {
  title: 'Iniciar sesión',
  description: 'Accedé a tu cuenta de Life Tenis con tu email.',
}

export default async function LoginPage() {
  // Si ya está logueado, no mostrar el login: mandarlo a su destino según rol
  const session = await auth()
  if (session?.user) {
    redirect(await getPostLoginRedirect(session.user.id, session.user.role))
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<div>Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
