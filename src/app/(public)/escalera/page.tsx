import type { Metadata } from 'next'
import Link from 'next/link'
import type { MatchFormat } from '@prisma/client'
import {
  Trophy,
  TrendingUp,
  Swords,
  CalendarClock,
  Star,
  LineChart,
  Mail,
  ChevronRight,
} from 'lucide-react'
import { getLadder } from '@/services/ladder-service'
import { DocSection } from '@/components/escalera-doc'

export const metadata: Metadata = {
  title: 'Cómo funciona La Escalera - Life Tenis',
  description:
    'Guía de jugador de La Escalera: cómo se calculan los puntos, los retos y sus plazos, el compromiso mensual, el jugador de la semana y las notificaciones que recibís.',
}

/** Resalta un valor de config dentro del texto. */
function Hl({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>
}

const days = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`

function matchFormatLabel(f: MatchFormat): string {
  if (f === 'TWO_SETS_SUPERTB') return '2 sets + súper tie-break (a 10 si quedan 1-1)'
  if (f === 'BEST_OF_THREE') return 'al mejor de 3 sets'
  return '1 set'
}

export default async function EscaleraDocPage() {
  const ladder = await getLadder()

  // Fallback a los @default del schema (prisma/schema.prisma) para que la doc
  // renderice aunque La Escalera todavía no esté sembrada.
  const cfg = {
    kFactor: ladder?.kFactor ?? 24,
    seedStep: ladder?.seedStep ?? 20,
    minMatchesPerMonth: ladder?.minMatchesPerMonth ?? 2,
    monthlyPenalty: ladder?.monthlyPenalty ?? 50,
    ratingFloor: ladder?.ratingFloor ?? 0,
    monthlyWarningLeadDays: ladder?.monthlyWarningLeadDays ?? 3,
    maxChallengesPerMonth: ladder?.maxChallengesPerMonth ?? 4,
    maxOpenChallenges: ladder?.maxOpenChallenges ?? 2,
    acceptanceWindowDays: ladder?.acceptanceWindowDays ?? 4,
    reservationLeadDays: ladder?.reservationLeadDays ?? 7,
    rematchCooldownDays: ladder?.rematchCooldownDays ?? 3,
    matchScheduleDeadlineDays: ladder?.matchScheduleDeadlineDays ?? 3,
    matchFormat: ladder?.matchFormat ?? 'SINGLE_SET',
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Cómo funciona La Escalera</h1>
        <p className="mt-1 text-muted-foreground">
          El ranking permanente del club, siempre vivo. Acá tenés todo lo que necesitás saber para
          jugar.
        </p>
      </header>

      <div className="space-y-3">
        <DocSection icon={<Trophy className="h-5 w-5" />} title="¿Qué es La Escalera?" defaultOpen>
          <p>
            Es la <Hl>liga permanente</Hl> del club: no es un torneo, no termina ni hay un campeón.
            Una <Hl>única lista</Hl> de todos los jugadores, ordenada por <Hl>puntos</Hl>. Premia
            tanto la habilidad (ganar partidos) como el compromiso (jugar seguido).
          </p>
          <p>
            <span className="font-medium text-foreground">¿Cómo arrancó?</span> La lista inicial salió
            de las posiciones del torneo <Hl>Singles Apertura 2026</Hl>: ese orden definió los puntos
            de partida de cada jugador (los de más arriba, con más puntos).
          </p>
          <p>
            <span className="font-medium text-foreground">¿Todavía no estás?</span>{' '}
            <Link href="/registro" className="font-medium text-primary underline underline-offset-2">
              Registrate
            </Link>{' '}
            y un administrador del club aprueba tu solicitud. Entrás con{' '}
            <Hl>{cfg.seedStep} puntos menos</Hl> que el último de la lista en ese momento: empezás
            abajo de todo y vas subiendo a medida que ganás.
          </p>
          <p>
            <span className="font-medium text-foreground">Puntos vs. puesto:</span> tu puntaje son
            tus <Hl>puntos</Hl>; tu lugar en la lista es el <Hl>Ranking #</Hl> (tu puesto). Subís de
            puesto sumando puntos.
          </p>
        </DocSection>

        <DocSection icon={<TrendingUp className="h-5 w-5" />} title="Cómo se calculan los puntos">
          <p>
            Usamos un sistema <Hl>ELO</Hl> de suma cero: en cada partido, los puntos que gana uno son
            exactamente los que pierde el otro.
          </p>
          <p>
            Cuánto se mueve depende de la diferencia entre los dos jugadores:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Si le ganás a alguien con <Hl>más puntos</Hl> que vos, sumás bastante (y él pierde lo
              mismo).
            </li>
            <li>
              Si le ganás a alguien con <Hl>menos puntos</Hl>, sumás poco. Si perdés contra alguien
              de menos puntos, perdés bastante.
            </li>
          </ul>
          <p>
            El máximo que puede moverse un partido parejo es el factor K = <Hl>{cfg.kFactor}</Hl>{' '}
            puntos. Antes de retar o aceptar siempre ves un <Hl>preview</Hl> de cuánto ganás si ganás
            y cuánto perdés si perdés.
          </p>
          <p>
            Un partido por <Hl>walkover</Hl> (el rival no se presenta) <Hl>no mueve puntos</Hl> (0
            para ambos). Si un resultado se corrige más adelante, los puntos se reajustan solos.
          </p>
        </DocSection>

        <DocSection icon={<Swords className="h-5 w-5" />} title="Retos y partidos">
          <p>
            Podés <Hl>retar a cualquiera</Hl> de la lista, esté donde esté. No hace falta retar al que
            está arriba de vos.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              El retado tiene <Hl>{days(cfg.acceptanceWindowDays)}</Hl> para aceptar o rechazar. Si no
              responde, el reto vence solo.
            </li>
            <li>
              <span className="font-medium text-foreground">Rechazar es libre:</span> no cuesta
              puntos ni penaliza… pero no está bueno, ¡y la comunidad se va a enterar! 🙂
            </li>
            <li>
              Podés tener hasta <Hl>{cfg.maxOpenChallenges}</Hl> retos abiertos a la vez, y empezar
              hasta <Hl>{cfg.maxChallengesPerMonth}</Hl> retos por mes. Aunque llegues al tope, seguís
              pudiendo <Hl>aceptar</Hl> retos que te manden.
            </li>
            {cfg.rematchCooldownDays > 0 && (
              <li>
                Después de jugar contra alguien, esperás <Hl>{days(cfg.rematchCooldownDays)}</Hl> para
                poder volver a retarlo (revancha).
              </li>
            )}
          </ul>
          <p>
            <span className="font-medium text-foreground">Cuando aceptan, se crea el partido.</span>{' '}
            Coordinan día y hora y reservan una cancha. La reserva se puede pedir con hasta{' '}
            <Hl>{days(cfg.reservationLeadDays)}</Hl> de anticipación: cualquiera de los dos la pide y
            Mati la confirma en la app del club.
          </p>
          <p>
            Tenés <Hl>{days(cfg.matchScheduleDeadlineDays)}</Hl> para concretar el partido desde que
            se aceptó el reto. Si no lo agendan a tiempo, se cancela solo (no afecta los puntos) y les
            llega un aviso el día antes.
          </p>
          <p className="text-xs">
            Formato de los partidos: <Hl>{matchFormatLabel(cfg.matchFormat)}</Hl>.
          </p>
        </DocSection>

        <DocSection icon={<CalendarClock className="h-5 w-5" />} title="Compromiso mensual y penalización">
          <p>
            La Escalera premia jugar seguido. Cada mes calendario tenés que jugar
            al menos <Hl>{cfg.minMatchesPerMonth}</Hl>{' '}
            {cfg.minMatchesPerMonth === 1 ? 'partido' : 'partidos'}.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Si no llegás, el 1º del mes siguiente se te descuentan <Hl>{cfg.monthlyPenalty} puntos</Hl>.
            </li>
            <li>
              Si te sumaron a La Escalera durante el mes, ese primer mes <Hl>no se te penaliza</Hl>{' '}
              (gracia).
            </li>
            <li>
              Te avisamos por email <Hl>{days(cfg.monthlyWarningLeadDays)}</Hl> antes de fin de mes si
              vas corto de partidos.
            </li>
          </ul>
          <p>
            <span className="font-medium text-foreground">Importante:</span> la penalización es{' '}
            <Hl>solo de puntos</Hl>. Nunca te bloquea retar, aceptar ni reservar.
          </p>
        </DocSection>

        <DocSection icon={<Star className="h-5 w-5" />} title="Jugador de la semana">
          <p>
            Cada semana (de <Hl>lunes a domingo</Hl>) se elige al jugador que más{' '}
            <Hl>puntos netos</Hl> ganó en sus partidos de esa semana.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Cuenta por la <Hl>fecha en que se jugó</Hl> el partido (el día agendado), no por cuándo
              se cargó el resultado.
            </li>
            <li>En caso de empate: primero quien jugó más partidos; si sigue empatado, quien tiene menos puntos.</li>
            <li>Las victorias por walkover no suman, así que no cuentan para esto.</li>
          </ul>
          <p>
            Aparece destacado en la portada y con un distintivo en su perfil durante toda la semana.
          </p>
        </DocSection>

        <DocSection icon={<LineChart className="h-5 w-5" />} title="Tu evolución y movimiento de puesto">
          <p>En tu perfil tenés dos cosas para seguir tu camino en La Escalera:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Un gráfico con la <Hl>evolución de tus puntos</Hl> desde que entraste.</li>
            <li>
              Una flecha <Hl>↑ / ↓</Hl> que muestra cuántos puestos subiste o bajaste en lo que va del
              mes.
            </li>
          </ul>
        </DocSection>

        <DocSection icon={<Mail className="h-5 w-5" />} title="Notificaciones que recibís">
          <p>Todo lo importante te llega por email. Estos son los avisos:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <span className="font-medium text-foreground">Te retaron</span> — con el plazo para
              responder y los puntos en juego.
            </li>
            <li>
              <span className="font-medium text-foreground">Aceptaron tu reto</span> — a coordinar el
              día y reservar la cancha.
            </li>
            <li>
              <span className="font-medium text-foreground">Rechazaron tu reto</span> — podés retar a
              otra persona cuando quieras.
            </li>
            <li>
              <span className="font-medium text-foreground">Partido cancelado</span> — si vos o tu
              rival cancelan un partido ya agendado.
            </li>
            <li>
              <span className="font-medium text-foreground">Recordatorio para coordinar</span> — el
              día antes de que venza el plazo para agendar.
            </li>
            <li>
              <span className="font-medium text-foreground">Partido cancelado por no coordinarse a tiempo</span>{' '}
              — no afecta tus puntos.
            </li>
            <li>
              <span className="font-medium text-foreground">Te faltan partidos este mes</span> — aviso
              antes del cierre si vas corto.
            </li>
            <li>
              <span className="font-medium text-foreground">Penalización aplicada</span> — si al cierre
              del mes no llegaste al mínimo, con los puntos descontados y tu nuevo total.
            </li>
          </ul>
        </DocSection>
      </div>

      <Link
        href="/"
        className="mt-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted/50"
      >
        <Trophy className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1">
          Mirá <span className="font-medium">La Escalera</span> y retá a alguien
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  )
}
