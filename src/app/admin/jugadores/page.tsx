import { prisma } from '@/lib/prisma'
import { fullName } from '@/lib/format-name'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata = { title: 'Jugadores - Life Tenis' }

export default async function JugadoresPage() {
  const users = await prisma.user.findMany({
    where: { role: 'PLAYER' },
    include: {
      players: {
        include: {
          tournament: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Jugadores</h1>
      <p className="text-muted-foreground text-sm mb-4">
        Usuarios con rol jugador en la plataforma ({users.length})
      </p>

      {users.length === 0 ? (
        <p className="text-muted-foreground">No hay jugadores registrados.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Torneos</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{fullName(u.firstName, u.lastName) || '-'}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {u.players.length === 0 ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Sin torneo
                        </Badge>
                      ) : (
                        u.players.map((p) => (
                          <Badge key={p.id} variant="outline" className="text-xs">
                            {p.tournament.name} ({p.category.name})
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? 'default' : 'secondary'}>
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
