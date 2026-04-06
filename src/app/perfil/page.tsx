import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getUserById } from '@/services/user-service'
import { blobUrl } from '@/lib/blob-url'
import { ProfileForm } from './profile-form'
import { BackButton } from './back-button'

export const metadata = {
  title: 'Mi perfil',
}

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await getUserById(session.user.id)
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <BackButton />
      <div className="mx-auto max-w-2xl md:min-w-[36rem] lg:min-w-[42rem] mt-4">
        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-xl font-bold">Perfil de usuario</h1>
            <p className="text-sm text-muted-foreground">Actualizá tu nombre y foto de perfil</p>
          </div>
          <ProfileForm
            user={{
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              email: user.email,
              image: blobUrl(user.image) || null,
              phone: user.phone,
              cedula: user.cedula || '',
            }}
          />
        </div>
      </div>
    </div>
  )
}
