import { Suspense } from 'react'
import { LoginForm } from './login-form'

export const metadata = {
  title: 'Iniciar sesión - Sinergia Life Tenis',
}

export default function LoginPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<div>Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
