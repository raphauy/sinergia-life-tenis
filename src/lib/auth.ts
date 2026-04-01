import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { getUserByEmail } from '@/services/user-service'
import { verifyOtpToken } from '@/services/auth-service'
import { blobUrl } from '@/lib/blob-url'

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  useSecureCookies: process.env.NODE_ENV === 'production',
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
  },

  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        otp: { label: 'OTP', type: 'text' },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined
        const otp = credentials?.otp as string | undefined

        if (!email || !otp) return null

        const user = await getUserByEmail(email)
        if (!user || !user.isActive) return null

        const isValid = await verifyOtpToken({
          userId: user.id,
          token: otp,
        })

        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
          firstName: user.firstName,
          lastName: user.lastName,
          image: user.image,
          role: user.role,
        }
      },
    }),
  ],

  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.firstName = user.firstName
        token.lastName = user.lastName
        token.image = user.image
        token.role = user.role
      }

      if (trigger === 'update' && session) {
        if (session.firstName !== undefined) token.firstName = session.firstName
        if (session.lastName !== undefined) token.lastName = session.lastName
        if (session.image !== undefined) token.image = session.image
      }

      return token
    },

    session: async ({ session, token }) => {
      if (token) {
        session.user.id = token.id as string
        session.user.firstName = token.firstName as string | null
        session.user.lastName = token.lastName as string | null
        session.user.image = blobUrl(token.image as string | null) || null
        session.user.role = token.role as string
      }
      return session
    },
  },
})
