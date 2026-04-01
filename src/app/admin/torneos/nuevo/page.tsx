import { TournamentCreateForm } from './tournament-create-form'

export const metadata = { title: 'Nuevo torneo' }

export default function NuevoTorneoPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Nuevo torneo</h1>
      <TournamentCreateForm />
    </div>
  )
}
