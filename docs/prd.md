# PRD: Sinergia Life Tenis

## 1. Resumen del proyecto

Sinergia Life Tenis es una plataforma web de gestión de torneos de tenis para el Club Sinergia Life. Permite a los administradores crear torneos, importar jugadores por CSV, gestionar partidos (crear, confirmar con cancha/horario, registrar resultados) y publicar rankings. Los jugadores pueden iniciar sesión mediante OTP por email, ver sus partidos programados, cargar resultados y editar su perfil. Existe además una vista pública (sin login) para consultar rankings y resultados, compartible por WhatsApp.

**No es multi-tenant**: es una plataforma de un solo club.

**Co-creador**: Mati (profesor de tenis) — define la modalidad de juego y ranking.

---

## 2. Stack tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 16.2.1 | Framework fullstack (App Router, RSC, Server Actions) |
| React | 19.2.4 | UI |
| TypeScript | 5.x | Tipado |
| Prisma | 6.x | ORM + migraciones |
| PostgreSQL (Neon) | - | Base de datos serverless |
| NextAuth v5 | 5.x beta | Autenticación (OTP + Credentials provider) |
| Resend | 6.x | Envío de emails transaccionales |
| React Email | 1.x | Templates de email |
| Vercel Blob | 2.x | Almacenamiento de imágenes (avatares) |
| shadcn/ui | base-nova style | Componentes UI |
| Tailwind CSS | 4.x | Estilos |
| Zod | 4.x | Validación de schemas |
| PapaParse | 5.x | Parsing de CSV |
| react-hook-form | 7.x | Manejo de formularios |
| date-fns | 4.x | Manejo de fechas |
| Lucide React | 1.x | Iconos |
| Sonner | 2.x | Notificaciones toast |
| pnpm | - | Package manager |

---

## 3. Arquitectura

### Patrón de capas (basado en OnMind)

```
UI (RSC por defecto) --> Server Actions --> Services --> Prisma
                      \-> API Routes (solo webhooks/cron externo)
```

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| Services | `src/services/*-service.ts` | Unica capa que usa Prisma directamente. Funciones puras (no clases). Throw errors directamente. |
| Actions | `actions.ts` en cada ruta | Orquestación. Llama a services. Valida con Zod. Retorna `ActionResult<T>`. try-catch aquí. |
| API Routes | `src/app/api/` | Solo para webhooks o cron jobs externos |
| UI | `src/app/`, `src/components/` | RSC por defecto. `"use client"` solo para interactividad (formularios, clicks, state hooks) |
| Validaciones | `src/lib/validations/*.ts` | Schemas Zod reutilizables |
| Emails | `src/components/emails/*.tsx` | Templates React Email |

### Tipo de retorno estándar para Actions

```typescript
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }
```

### Proxy (autenticación de rutas)

Archivo `src/proxy.ts` (reemplaza middleware.ts en Next.js 16):
- Rutas públicas: `/`, `/login`, `/ranking`, `/fixture`, `/jugador/[playerId]` (solo vista pública), `/api/auth`, `/invite`
- Rutas `/admin/*`: solo roles `SUPERADMIN` y `ADMIN`
- Rutas `/jugador/[playerId]/*` (sub-rutas privadas como partidos, cargar resultado): requiere login. PLAYER solo accede a su propio playerId; SUPERADMIN/ADMIN accede a cualquiera.
- Verificación de usuario activo en BD en cada request protegido

### Convenciones de nombres

- Archivos: `kebab-case` — `match-service.ts`, `player-form.tsx`
- Funciones: `camelCase` — `getMatches()`, `createTournament()`
- Componentes: `PascalCase` — `MatchCard`, `TournamentForm`
- Types: `*WithRelations`, `*Filters`, `Create*Input`, `Update*Input`

### Loading states

- Usar `<Suspense fallback={<Skeleton />}>` (NO `loading.tsx`)

---

## 4. Roles y permisos

### Enum de roles

```
SUPERADMIN | ADMIN | PLAYER
```

### Matriz de permisos

**Nota:** Un SUPERADMIN o ADMIN puede también ser jugador del torneo (tener un registro `Player` vinculado a su User). En ese caso tiene acceso completo al panel de administración Y a su propio panel de jugador con todas las acciones de jugador (cargar resultados, ver sus partidos, etc.).

| Acción | SUPERADMIN | ADMIN | PLAYER | Público |
|---|---|---|---|---|
| Gestionar admins (invitar) | Si | No | No | No |
| Crear/editar torneos | Si | Si | No | No |
| Importar jugadores CSV | Si | Si | No | No |
| Agregar email a jugador | Si | Si | No | No |
| Invitar jugador (enviar email) | Si | Si | No | No |
| Crear/confirmar partidos | Si | Si | No | No |
| Editar/cargar resultado de cualquier partido | Si | Si | No | No |
| Ver dashboard admin | Si | Si | No | No |
| Ver panel de cualquier jugador | Si | Si | No | No |
| Cargar resultado de partido propio | Si (*) | Si (*) | Si | No |
| Ver mis partidos (panel jugador) | Si (*) | Si (*) | Si | No |
| Editar perfil propio | Si | Si | Si | No |
| Ver ranking público | Si | Si | Si | Si |
| Ver fixture/resultados público | Si | Si | Si | Si |
| Ver perfil público de jugador | Si | Si | Si | Si |

(*) Solo si el SUPERADMIN/ADMIN tiene un registro `Player` vinculado en el torneo.

---

## 5. Modelo de datos

### Enums

```prisma
enum Role {
  SUPERADMIN
  ADMIN
  PLAYER
}

enum MatchStatus {
  PENDING     // Creado sin fecha/hora/cancha
  CONFIRMED   // Fecha, hora y cancha asignados - se envía email
  PLAYED      // Resultado cargado
  CANCELLED   // Cancelado por admin
}

enum MatchFormat {
  SINGLE_SET        // 1 solo set (default)
  TWO_SETS_SUPERTB  // 2 sets + super tiebreak (10 puntos) si empate 1-1
  BEST_OF_THREE     // Mejor de 3 sets completos (futuro)
}

enum ImportedPlayerStatus {
  PENDING
  PROCESSED
  ERROR
}
```

### Modelos

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?  // URL Vercel Blob
  phone     String?  // WhatsApp del jugador
  role      Role
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  otpTokens              OtpToken[]
  players                Player[]
  matchesAsPlayer1       Match[]         @relation("MatchPlayer1")
  matchesAsPlayer2       Match[]         @relation("MatchPlayer2")
  matchesWon             MatchResult[]   @relation("MatchWinner")
  matchResultsReported   MatchResult[]   @relation("MatchReporter")
  invitationsSent        AdminInvitation[] @relation("InvitationSender")

  @@index([email])
  @@index([role])
  @@index([isActive])
}

model OtpToken {
  id        String    @id @default(cuid())
  token     String
  userId    String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
}

model AdminInvitation {
  id          String    @id @default(cuid())
  email       String
  name        String?
  token       String    @unique
  expiresAt   DateTime
  acceptedAt  DateTime?
  invitedById String
  createdAt   DateTime  @default(now())

  invitedBy User @relation("InvitationSender", fields: [invitedById], references: [id])

  @@index([email])
  @@index([token])
  @@index([expiresAt])
}

model Tournament {
  id          String      @id @default(cuid())
  name        String
  description String?
  matchFormat MatchFormat  @default(SINGLE_SET) // Formato de partidos del torneo
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  categories TournamentCategory[]
  matches    Match[]

  @@index([isActive])
}

model TournamentCategory {
  id           String   @id @default(cuid())
  tournamentId String
  name         String   // "A", "B", "C"
  description  String?
  order        Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  players    Player[]
  matches    Match[]

  @@unique([tournamentId, name])
  @@index([tournamentId])
}

model Player {
  id              String    @id @default(cuid())
  userId          String?   // null hasta que acepte invitación
  tournamentId    String
  categoryId      String
  name            String    // Nombre del CSV (antes de tener cuenta)
  whatsappNumber  String?
  email           String?   // Puede agregarse después del CSV
  invitationToken String?   @unique
  invitedAt       DateTime?
  acceptedAt      DateTime?
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user       User?              @relation(fields: [userId], references: [id], onDelete: SetNull)
  tournament Tournament         @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  category   TournamentCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, email])
  @@index([tournamentId])
  @@index([categoryId])
  @@index([userId])
  @@index([invitationToken])
}

model Match {
  id            String      @id @default(cuid())
  tournamentId  String
  categoryId    String
  player1Id     String
  player2Id     String
  courtNumber   Int?        // 1 o 2 (null si aún no asignado)
  scheduledAt   DateTime?   // Fecha+hora en UTC (null si PENDING). UI muestra en UY.
  status        MatchStatus @default(PENDING)
  confirmedAt   DateTime?
  playedAt      DateTime?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  tournament Tournament         @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  category   TournamentCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  player1    User               @relation("MatchPlayer1", fields: [player1Id], references: [id])
  player2    User               @relation("MatchPlayer2", fields: [player2Id], references: [id])
  result     MatchResult?

  @@index([tournamentId])
  @@index([categoryId])
  @@index([player1Id])
  @@index([player2Id])
  @@index([status])
  @@index([scheduledAt])
}

model MatchResult {
  id              String   @id @default(cuid())
  matchId         String   @unique
  reportedById    String
  set1Player1     Int      // Juegos ganados por player1 en set 1
  set1Player2     Int
  set2Player1     Int?     // Null en formato SINGLE_SET
  set2Player2     Int?
  superTbPlayer1  Int?     // Puntos super tiebreak (solo TWO_SETS_SUPERTB, si empate 1-1)
  superTbPlayer2  Int?
  set3Player1     Int?     // Solo formato BEST_OF_THREE (futuro)
  set3Player2     Int?
  winnerId        String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  match      Match @relation(fields: [matchId], references: [id], onDelete: Cascade)
  reportedBy User  @relation("MatchReporter", fields: [reportedById], references: [id])
  winner     User  @relation("MatchWinner", fields: [winnerId], references: [id])

  @@index([matchId])
  @@index([winnerId])
}

model ImportedPlayer {
  id             String               @id @default(cuid())
  name           String
  category       String               // "A", "B", "C"
  whatsappNumber String?
  email          String?
  data           Json                 // Datos originales del CSV
  status         ImportedPlayerStatus @default(PENDING)
  error          String?
  tournamentId   String
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@index([tournamentId])
  @@index([status])
  @@index([tournamentId, status])
}
```

### Diagrama de relaciones

```
User 1--N OtpToken
User 1--N Player (inscripciones a torneos)
User 1--N Match (como player1)
User 1--N Match (como player2)
User 1--N MatchResult (como reporter)
User 1--N MatchResult (como winner)
User 1--N AdminInvitation (como invitador)

Tournament 1--N TournamentCategory
Tournament 1--N Match

TournamentCategory 1--N Player
TournamentCategory 1--N Match

Match 1--1 MatchResult

Player N--1 User (nullable, hasta aceptar invitación)
Player N--1 Tournament
Player N--1 TournamentCategory
```

---

## 6. Funcionalidades

### 6.1 Autenticación (OTP por email)

**No hay registro público.** Los usuarios solo existen si fueron importados por CSV, invitados, o creados por un admin. El login solo funciona para usuarios que ya existen en la plataforma.

> **Futuro (siguiente torneo):** se prevé una funcionalidad de inscripción pública donde jugadores nuevos puedan registrarse y anotarse a un torneo. Por ahora no se implementa, pero el modelo (User separado de Player) ya está preparado para soportarlo.

**Flujo:**
1. Usuario ingresa email en `/login`
2. Server action valida email, busca User en BD
3. **Si NO existe o no está activo**: mostrar mensaje claro en la UI: _"Este email no está registrado en la plataforma. Si sos jugador del torneo, contactá al administrador."_ No se envía OTP.
4. Si existe y está activo: genera OTP 6 dígitos, guarda en `OtpToken` con expiración 10 min
5. Envía email con código OTP via Resend
6. Usuario ingresa código, se llama `signIn('credentials', { email, otp })`
7. NextAuth authorize callback verifica OTP en BD
8. Redirección según rol:
   - `SUPERADMIN` / `ADMIN` --> `/admin`
   - `PLAYER` --> `/jugador/[playerId]` (su propio panel)

**Archivos:**
- `src/lib/auth.ts` — config NextAuth
- `src/services/auth-service.ts` — generateOtp, createOtpToken, verifyOtpToken
- `src/app/login/actions.ts` — sendOtpAction, verifyOtpAction
- `src/app/login/page.tsx` + `login-form.tsx`

### 6.2 Gestión de jugadores e inscripción a torneos

**Concepto clave:** el **email identifica al jugador**. Un User puede participar en múltiples torneos (un registro `Player` por torneo). La inscripción de jugadores es siempre a nivel de torneo, no de plataforma.

#### 6.2.1 Importación CSV (a nivel de torneo)

**Columnas esperadas:** nombre, categoría (A/B/C), whatsapp, email

**Flujo:**
1. Admin abre un torneo en `/admin/torneos/[id]` y hace click en "Importar jugadores"
2. PapaParse parsea el archivo en el cliente
3. UI muestra preview con mapeo de columnas y estado de cada fila:
   - **Existente**: el email ya corresponde a un User en la plataforma (se muestra nombre actual)
   - **Nuevo**: el email no existe, se creará Player sin User vinculado
   - **Error**: fila con datos inválidos (email vacío, categoría incorrecta, etc.)
4. Server action crea registros en `ImportedPlayer` (staging, vinculados al torneo)
5. Admin revisa y confirma, se crean registros `Player`:
   - Si el email corresponde a un User existente: `Player.userId` se vincula al User existente
   - Si el email no existe: `Player` queda con `userId = null`, se crea User cuando acepte la invitación

**Archivos:**
- `src/services/imported-player-service.ts`
- `src/services/player-service.ts`
- `src/lib/validations/player.ts`
- `src/app/admin/torneos/[id]/importar/actions.ts`

#### 6.2.2 Agregar email manualmente

- Admin ve lista de jugadores del torneo, puede editar el campo `email` de cualquier `Player`
- Necesario antes de poder invitar a jugadores que vinieron del CSV sin email

#### 6.2.3 Invitación de jugador a torneo

**Flujo:**
1. Admin hace click en "Invitar" en un jugador del torneo (requiere que el Player tenga email)
2. Server action genera `invitationToken` (crypto.randomBytes), guarda en Player, setea `invitedAt`
3. Envía email con link: `/invite/player/{token}` — el email incluye nombre del torneo y categoría
4. Jugador hace click en el link, ve página de aceptación
5. Al aceptar:
   - Si ya existe User con ese email: se vincula `Player.userId` al User existente
   - Si no existe: se crea User con rol `PLAYER` y se vincula
   - Se setea `Player.acceptedAt`
6. Jugador puede ahora loguearse con OTP

**Archivos:**
- `src/services/player-invitation-service.ts`
- `src/services/email-service.ts`
- `src/app/invite/player/[token]/page.tsx`
- `src/app/invite/player/[token]/actions.ts`

#### 6.2.4 Inscripción para futuros torneos (NO implementar ahora)

> Para el segundo torneo en adelante, la mayoría de jugadores ya existirán en la plataforma. Se prevén estas funcionalidades:
>
> **Invitación masiva de jugadores existentes:**
> - Admin selecciona un torneo y una categoría
> - Ve lista de todos los Users con rol PLAYER de la plataforma
> - Selecciona varios jugadores y los invita de una vez al torneo+categoría
> - Se crean registros `Player` vinculados y se envía email de invitación al torneo
>
> **Invitación a email nuevo:**
> - Admin invita un email que no existe en la plataforma a un torneo+categoría
> - Se crea Player sin User, el User se crea al aceptar (mismo flujo que 6.2.3)
>
> **Auto-inscripción (registro público):**
> - Un jugador nuevo puede registrarse desde una página pública del torneo
> - Se le piden datos: nombre, email, whatsapp, categoría preferida
> - Se crea User + Player, queda pendiente de aprobación del admin
> - O se aprueba automáticamente (configurable por torneo)
>
> El modelo actual (User separado de Player, email como identificador) ya soporta todos estos flujos sin cambios de schema.

### 6.3 Invitación de admins

**Flujo:**
1. Superadmin crea invitación con email y nombre
2. Se genera token, se guarda en `AdminInvitation`, se envía email
3. Admin invitado accede a `/invite/admin/{token}`
4. Al aceptar: se crea User con rol `ADMIN`

**Archivos:**
- `src/services/admin-invitation-service.ts`
- `src/app/invite/admin/[token]/page.tsx`
- `src/app/invite/admin/[token]/actions.ts`

### 6.4 Gestión de torneos

- Admin crea torneo: nombre, descripción, fecha inicio, fecha fin
- Al crear, define categorías (por defecto A, B, C)
- Torneo tiene flag `isActive` para poder tener múltiples torneos (uno activo a la vez)

**Archivos:**
- `src/services/tournament-service.ts`
- `src/lib/validations/tournament.ts`
- `src/app/admin/torneos/actions.ts`
- `src/app/admin/torneos/page.tsx`
- `src/app/admin/torneos/nuevo/page.tsx`
- `src/app/admin/torneos/[id]/page.tsx`

### 6.5 Gestión de partidos

#### 6.5.1 Crear partido

- Admin selecciona torneo, categoría, jugador 1 y jugador 2
- Opcionalmente asigna cancha, fecha, hora
- Se crea Match con status `PENDING` (sin schedule) o `CONFIRMED` (con schedule)

#### 6.5.2 Confirmar partido

- Admin asigna/edita: fecha, hora, cancha (Cancha 1 o Cancha 2)
- Al confirmar (transición a `CONFIRMED`):
  - Se envía email a ambos jugadores con día, hora, cancha
  - Se setea `confirmedAt`

#### 6.5.3 Estados del partido

```
PENDING --> CONFIRMED --> PLAYED
                      \-> CANCELLED
PENDING --> CANCELLED
```

**Archivos:**
- `src/services/match-service.ts`
- `src/lib/validations/match.ts`
- `src/app/admin/partidos/actions.ts`
- `src/app/admin/partidos/page.tsx`
- `src/app/admin/partidos/nuevo/page.tsx`
- `src/app/admin/partidos/[id]/page.tsx`

### 6.6 Resultados

#### Carga de resultado

- **Jugador**: solo puede cargar resultado de partidos donde es player1 o player2, y el partido está `CONFIRMED`
- **Superadmin**: puede cargar y editar resultado de cualquier partido
- **Admin**: puede editar cualquier resultado
- El formato del resultado depende del `matchFormat` del torneo
- Se determina ganador automáticamente según el formato
- Al cargar resultado: Match pasa a `PLAYED`, se setea `playedAt`

**Formatos de resultado:**

| Formato | Campos obligatorios | Campos opcionales | Ejemplo |
|---|---|---|---|
| `SINGLE_SET` (default) | set1 | - | 6-4 |
| `TWO_SETS_SUPERTB` | set1, set2 | superTiebreak (si empate 1-1) | 6-4 3-6 [10-7] |
| `BEST_OF_THREE` (futuro) | set1, set2 | set3 (si empate 1-1) | 6-4 3-6 7-5 |

**Validaciones Zod (dinámicas según formato del torneo):**

**SINGLE_SET:**
- set1: valores 0-7 para cada jugador
- Tiebreak: 7 solo si el otro tiene al menos 5 (7-5, 7-6)
- Ganador: quien gana el set

**TWO_SETS_SUPERTB:**
- set1 y set2: mismas reglas que arriba
- Si empate 1-1 en sets: super tiebreak obligatorio (valores 0-99, ganador llega a mínimo 10 con diferencia de 2)
- Ganador: quien gana 2 sets, o quien gana el super tiebreak si empate 1-1

**BEST_OF_THREE (futuro):**
- set1, set2, set3 (si empate 1-1): mismas reglas de set
- Ganador: quien gana 2 de 3 sets

**Archivos:**
- `src/services/match-result-service.ts`
- `src/lib/validations/match-result.ts`
- `src/app/jugador/partidos/[id]/actions.ts`
- `src/app/admin/partidos/[id]/resultado/actions.ts`

### 6.7 Perfil de usuario

- Todos los roles pueden editar: nombre, imagen (avatar)
- Upload de imagen via Vercel Blob (máx 4MB)
- Jugadores también ven su teléfono (solo lectura, viene del CSV)
- SUPERADMIN/ADMIN pueden editar el perfil de cualquier usuario desde `/admin/jugadores/[id]`

#### Imagen de perfil: dos métodos

**1. Upload manual**: drag & drop o click para subir imagen (mismo patrón de OnMind).

**2. Desde Instagram**: ingresar handle de Instagram para buscar y cargar la foto de perfil automáticamente. Disponible para el propio usuario en `/perfil` y para SUPERADMIN/ADMIN al editar cualquier jugador. Esto permite que un admin cargue fotos de jugadores que no lo hicieron ellos mismos, dejando rankings y partidos más atractivos visualmente.

**Flujo Instagram:**
1. Usuario ingresa handle de Instagram (ej: "juanperez_tenis")
2. Server action llama a `getInstagramProfile(handle)` — usa HTTP/2 scraping al endpoint interno de Instagram (`/api/v1/users/web_profile_info/`)
3. Se obtiene `profile_pic_url_hd` del perfil
4. Se descarga la imagen con múltiples estrategias de User-Agent (Chrome, GoogleBot, Mobile Safari) como fallback
5. Se sube a Vercel Blob via `uploadImageFromBlob()`
6. Se actualiza `User.image` con la URL de Vercel Blob

**Librería copiada de OnMind:**
- `src/lib/instagram-api.ts` — HTTP/2 scraping con headers de browser, Zod validation de respuesta, rate limiting (delay 1.5s entre requests). Usa `http2` nativo de Node.js porque Instagram bloquea `fetch` por TLS fingerprinting.
- `src/services/instagram-service.ts` — validación de input, verificación de perfil no privado
- Funciones de descarga con 4 estrategias de retry en `upload-service.ts`

**Archivos:**
- `src/services/user-service.ts`
- `src/services/upload-service.ts` — uploadImage, uploadImageFromBlob, deleteImage
- `src/services/instagram-service.ts` — getInstagramProfile
- `src/lib/instagram-api.ts` — HTTP/2 scraping de Instagram
- `src/lib/validations/profile.ts`
- `src/app/perfil/actions.ts`
- `src/app/perfil/page.tsx`
- `src/app/admin/jugadores/[id]/actions.ts` — admin editando perfil de jugador

### 6.8 Ranking

**TODO**: Pendiente definición con Mati.

Conocido:
- Singles, categorías A/B/C
- Habrá un sistema de ranking/puntos
- Visible públicamente en `/ranking`

Placeholder:
- Tabla de posiciones por categoría
- Columnas probables: posición, jugador, PJ, PG, PP, sets a favor, sets en contra, puntos
- Cálculo de puntos: **por definir**

**Archivos (estructura preparada):**
- `src/services/ranking-service.ts`
- `src/app/(public)/ranking/page.tsx`

### 6.9 Vista pública

Sin requerir login:
- **Ranking**: tabla de posiciones por categoría del torneo activo. Click en jugador lleva a su perfil público.
- **Fixture/Resultados**: lista de partidos con resultados. Click en jugador lleva a su perfil público.
- **Perfil público de jugador** (`/jugador/[playerId]` sin login): nombre, avatar, categoría actual, posición en ranking, historial de partidos (resultados), partidos por jugar (confirmados con fecha/hora/cancha, o pendientes sin fecha). La idea es que cualquier socio del club pueda ver cuándo y dónde juega alguien para ir a ver el partido.
- Compartible via WhatsApp (meta tags OpenGraph para preview, incluyendo perfil de jugador)

---

## 7. Flujos de usuario

### 7.1 Admin: importar jugadores a un torneo y enviar invitaciones

```
Admin login --> /admin/torneos/[id] --> "Importar jugadores"
--> Sube CSV --> Preview: existentes (vinculados), nuevos (por invitar), errores
--> Confirma --> Players creados en el torneo
--> Admin edita email de jugadores sin email --> Click "Invitar"
--> Email enviado al jugador con link de invitación al torneo
```

### 7.2 Jugador: aceptar invitación y primer login

```
Recibe email --> Click en link /invite/player/{token}
--> Página de bienvenida --> "Aceptar invitación"
--> Cuenta creada --> Redirigido a /login
--> Ingresa email --> Recibe OTP --> Ingresa código
--> Redirigido a /jugador (dashboard)
```

### 7.3 Admin: crear y confirmar partido

```
/admin/partidos --> "Nuevo partido"
--> Selecciona torneo, categoría, jugador 1, jugador 2
--> Partido creado como PENDING
--> Luego: abre partido --> asigna fecha, hora, cancha --> "Confirmar"
--> Email enviado a ambos jugadores
--> Partido pasa a CONFIRMED
```

### 7.4 Jugador: cargar resultado

```
/jugador --> Ve "Próximos partidos" --> Partido está CONFIRMED
--> Después de jugar --> Click "Cargar resultado"
--> Ingresa score por set --> Envía
--> Partido pasa a PLAYED --> Resultado visible en fixture público
```

### 7.5 Visitante: ver ranking

```
Recibe link WhatsApp --> /ranking
--> Ve tabla de posiciones por categoría (A, B, C)
--> Puede ver fixture/resultados en /fixture
```

---

## 8. Páginas y rutas

### Rutas públicas (sin login)

| Ruta | Descripción |
|---|---|
| `/` | Landing page del torneo |
| `/login` | Login con OTP |
| `/invite/player/[token]` | Aceptar invitación de jugador |
| `/invite/admin/[token]` | Aceptar invitación de admin |
| `/ranking` | Ranking público del torneo activo (click en jugador va a su perfil) |
| `/fixture` | Fixture y resultados públicos (click en jugador va a su perfil) |
| `/jugador/[playerId]` | Perfil público: nombre, avatar, categoría, ranking, historial, próximos partidos |

### Rutas admin (SUPERADMIN + ADMIN)

| Ruta | Descripción |
|---|---|
| `/admin` | Dashboard admin |
| `/admin/torneos` | Lista de torneos |
| `/admin/torneos/nuevo` | Crear torneo |
| `/admin/torneos/[id]` | Ver/editar torneo + lista de jugadores inscritos |
| `/admin/torneos/[id]/importar` | Importar CSV de jugadores al torneo |
| `/admin/jugadores` | Lista global de jugadores de la plataforma |
| `/admin/jugadores/[id]` | Ver/editar jugador (email, avatar, datos) |
| `/admin/partidos` | Lista de partidos |
| `/admin/partidos/nuevo` | Crear partido |
| `/admin/partidos/[id]` | Ver/editar partido (confirmar, resultado) |
| `/admin/invitaciones` | Gestión de invitaciones de admin (solo SUPERADMIN) |

### Rutas jugador (SUPERADMIN + ADMIN + PLAYER)

Las rutas `/jugador/*` son accesibles por todos los roles autenticados. Un PLAYER solo ve su propio panel; un SUPERADMIN/ADMIN puede navegar al panel de cualquier jugador seleccionándolo (misma vista que ve el jugador).

| Ruta | Descripción |
|---|---|
| `/jugador/[playerId]` | Perfil público + dashboard privado (próximos partidos, historial). Parte pública visible sin login. Acciones (cargar resultado): el jugador dueño, SUPERADMIN o ADMIN. |
| `/jugador/[playerId]/partidos` | Partidos del jugador (lista completa) |
| `/jugador/[playerId]/partidos/[matchId]` | Detalle de partido + cargar resultado (el jugador dueño, SUPERADMIN o ADMIN) |
| `/jugador/[playerId]/ranking` | Ver ranking del torneo |

### Ruta compartida

| Ruta | Descripción |
|---|---|
| `/perfil` | Editar perfil (todos los roles) |

### Navegación admin-jugador

Si un SUPERADMIN/ADMIN tiene un `Player` vinculado en el torneo activo, el sidebar admin muestra un link "Mi panel de jugador" que lleva a `/jugador/[suPlayerId]`. Esto permite al admin ir y volver entre su rol de administrador y su panel de jugador sin fricciones.

### Layouts

| Archivo | Uso |
|---|---|
| `src/app/(public)/layout.tsx` | Layout público (navbar simple) |
| `src/app/admin/layout.tsx` | Layout admin con sidebar |
| `src/app/jugador/[playerId]/layout.tsx` | Layout jugador con navbar (incluye link a /admin si el usuario es SUPERADMIN/ADMIN) |
| `src/app/login/layout.tsx` | Layout mínimo (centrado) |

---

## 9. Emails

### Templates necesarios

| Template | Trigger | Contenido |
|---|---|---|
| `otp-email.tsx` | Login OTP | Código de 6 dígitos, expira en 10 min |
| `player-invitation-email.tsx` | Admin invita jugador | Nombre del torneo, categoría, link de aceptación, expira en 7 días |
| `admin-invitation-email.tsx` | Superadmin invita admin | Link de aceptación, expira en 7 días |
| `match-confirmation-email.tsx` | Admin confirma partido | Rival, fecha, hora, cancha (1 o 2), nombre del torneo |

### Ubicación

```
src/components/emails/
  otp-email.tsx
  player-invitation-email.tsx
  admin-invitation-email.tsx
  match-confirmation-email.tsx
  email-theme.ts
```

### Configuración Resend

```typescript
// src/services/email-service.ts
// En development: log a consola (no enviar email)
// En production: enviar via Resend
```

---

## 10. Variables de entorno

```env
# Base de datos
DATABASE_URL=              # Neon pooled connection string
DIRECT_DATABASE_URL=       # Neon direct connection (para migraciones)

# Auth
AUTH_SECRET=               # Secret para NextAuth JWT
NEXTAUTH_URL=              # URL base de la app (http://localhost:3000 en dev)

# Email
RESEND_API_KEY=            # API key de Resend
EMAIL_FROM=                # Email remitente (ej: "Sinergia Life Tenis <noreply@sinergialifetenis.com>")

# Storage
BLOB_READ_WRITE_TOKEN=     # Token de Vercel Blob para upload de imágenes

# App
NEXT_PUBLIC_APP_URL=       # URL pública de la app (para links en emails y meta tags)
```

---

## 11. Services a crear

| Archivo | Funciones principales |
|---|---|
| `auth-service.ts` | generateOtp, createOtpToken, verifyOtpToken, cleanupExpiredTokens |
| `user-service.ts` | getUserByEmail, getUserById, createUser, updateUser |
| `email-service.ts` | sendOtpEmail, sendPlayerInvitationEmail, sendAdminInvitationEmail, sendMatchConfirmationEmail |
| `tournament-service.ts` | createTournament, getTournaments, getTournamentById, updateTournament, getActiveTournament |
| `tournament-category-service.ts` | createCategory, getCategoriesByTournament |
| `player-service.ts` | createPlayer, getPlayersByTournament, getPlayerById, updatePlayer, getPlayersByCategory, linkPlayerToUser |
| `player-invitation-service.ts` | invitePlayer, acceptPlayerInvitation, getInvitationByToken, inviteExistingUsersToTournament (futuro) |
| `admin-invitation-service.ts` | createAdminInvitation, acceptAdminInvitation, getAdminInvitationByToken |
| `imported-player-service.ts` | createManyImportedPlayers, getImportedPlayers, processImportedPlayers, deleteImportedPlayers |
| `match-service.ts` | createMatch, getMatches, getMatchById, confirmMatch, cancelMatch, getMatchesByPlayer, getUpcomingMatches |
| `match-result-service.ts` | createMatchResult, updateMatchResult, getResultByMatch |
| `ranking-service.ts` | getRankingByCategory, calculateRanking **(TODO)** |
| `upload-service.ts` | uploadImage, uploadImageFromBlob, deleteImage |
| `instagram-service.ts` | getInstagramProfile, downloadProfileImage |

---

## 12. Validaciones Zod

| Archivo | Schemas |
|---|---|
| `src/lib/validations/auth.ts` | emailSchema, otpSchema |
| `src/lib/validations/tournament.ts` | createTournamentSchema, updateTournamentSchema |
| `src/lib/validations/player.ts` | createPlayerSchema, updatePlayerSchema, importPlayerSchema |
| `src/lib/validations/match.ts` | createMatchSchema, confirmMatchSchema |
| `src/lib/validations/match-result.ts` | createMatchResultSchema, updateMatchResultSchema |
| `src/lib/validations/profile.ts` | updateProfileSchema |

---

## 13. Canchas

Las canchas son fijas (no se gestionan como entidad dinámica):

| Número | Nombre |
|---|---|
| 1 | Cancha 1 |
| 2 | Cancha 2 |

Se almacena como `courtNumber: Int?` en el modelo `Match`. Si en el futuro se agregan más canchas, se puede migrar a una tabla `Court`.

---

## 14. TODO / Pendientes

### Pendiente: reunión con Mati

- [ ] **Modalidad de juego**: todos contra todos? eliminación directa? grupos + eliminación?
- [ ] **Sistema de ranking/puntos**: cómo se calculan los puntos? por victoria? por sets? diferencia de juegos?
- [ ] **Formato de fixture**: cómo se generan los partidos, automáticamente o todos manuales?
- [ ] **Desempate**: qué pasa si dos jugadores tienen los mismos puntos?
- [ ] **Ascenso/descenso entre categorías**: existe?
- [ ] **Supertiebreak**: se juega supertiebreak en lugar de tercer set? (afecta modelo de datos)

### Pendientes técnicos

- [ ] Definir dominio y configurar DNS para email (Resend)
- [ ] Crear proyecto en Vercel
- [ ] Crear base de datos en Neon
- [ ] Configurar Vercel Blob store
- [ ] Seed inicial: crear primer usuario SUPERADMIN
- [ ] OpenGraph meta tags para compartir por WhatsApp
- [ ] PWA / responsive design optimizado para móvil (jugadores usan celular)
- [ ] Rate limiting en OTP (prevenir brute force)

---

## 15. Fases de implementación

### Fase 1: Base (auth + estructura)
1. Setup Prisma con Neon
2. Modelo de datos (migraciones)
3. Auth con OTP (NextAuth + Resend)
4. proxy.ts con protección de rutas
5. Layout admin con sidebar
6. Layout jugador
7. Página de perfil

### Fase 2: Torneos + Jugadores
1. CRUD de torneos
2. CRUD de categorías
3. Importación CSV de jugadores
4. Lista de jugadores con edición de email
5. Sistema de invitación de jugadores
6. Aceptación de invitación

### Fase 3: Partidos + Resultados
1. Crear partidos (admin)
2. Confirmar partidos con email de notificación
3. Dashboard jugador (próximos partidos)
4. Carga de resultados (jugador)
5. Edición de resultados (admin)

### Fase 4: Ranking + Público
1. Vista pública de fixture/resultados
2. Sistema de ranking (después de reunión con Mati)
3. Vista pública de ranking
4. Meta tags OpenGraph para WhatsApp
5. Invitación de admins (SUPERADMIN)

---

## 16. Consideraciones técnicas

### Zona horaria: UTC en servidor/BD, America/Montevideo en UI

**Regla fundamental**: el servidor (Vercel) y la base de datos operan en UTC. Toda fecha/hora se almacena en UTC. La conversión a `America/Montevideo` (UY, UTC-3) se hace exclusivamente en la capa de UI.

**Implementación:**

```typescript
// src/lib/constants.ts
export const TIMEZONE = 'America/Montevideo'
```

```typescript
// src/lib/date-utils.ts
import { format, toZonedTime } from 'date-fns-tz'
import { TIMEZONE } from './constants'

// Para mostrar en UI: convertir UTC → UY
export function formatDateUY(date: Date, fmt: string = 'dd/MM/yyyy') {
  return format(toZonedTime(date, TIMEZONE), fmt, { timeZone: TIMEZONE })
}

export function formatTimeUY(date: Date) {
  return format(toZonedTime(date, TIMEZONE), 'HH:mm', { timeZone: TIMEZONE })
}

// Para guardar en BD: convertir input UY → UTC
export function parseFromUY(dateStr: string, timeStr: string): Date {
  // Interpretar la fecha/hora como UY y devolver Date en UTC
}
```

**Reglas:**
- `date-fns-tz` para todas las conversiones (ya en el stack)
- Server actions reciben fecha/hora como strings ("2026-04-15", "18:30"), los interpretan como UY y los convierten a UTC antes de guardar
- Queries a BD siempre en UTC
- Componentes de UI siempre muestran hora UY
- Emails de confirmación de partido muestran hora UY
- Campos `DateTime` de Prisma (`scheduledDate`, `confirmedAt`, `playedAt`, etc.) siempre UTC
- El campo `scheduledTime` (String "HH:mm") se elimina del modelo: usar un solo campo `scheduledAt: DateTime?` en UTC que incluya fecha+hora

**Cambio al modelo Match:**
- Reemplazar `scheduledDate: DateTime?` + `scheduledTime: String?` por `scheduledAt: DateTime?` (fecha+hora en UTC)
- Más simple, sin ambiguedad, y compatible con queries de rango

---

### Prisma + Neon

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### NextAuth v5 — tipos extendidos

```typescript
// src/types/next-auth.d.ts
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession['user']
  }
  interface User {
    role?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string | null
  }
}
```

### shadcn/ui — componentes a instalar

Prioridad para fase 1-2:
- Button (ya instalado), Input, Label, Card, Dialog, Table, Select, Tabs
- Form (react-hook-form integration), Separator, Badge, Avatar
- DropdownMenu, Sidebar, Skeleton, Sonner (toast)
- InputOTP (para login)

### CSV Import — formato esperado

```typescript
interface PlayerCSVRow {
  nombre: string
  categoria: 'A' | 'B' | 'C'
  whatsapp?: string
  email?: string
}
```
