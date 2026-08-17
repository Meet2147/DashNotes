import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { DB_ERROR_PREFIX, describeDbError } from './dbHealth';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // next-auth turns anything thrown here into a plain 401, which the login
        // page would otherwise render as "Invalid email or password". Tag real
        // infrastructure failures so the UI can tell the truth about them
        // instead of blaming the user's password.
        let user;
        try {
          user = await prisma.user.findUnique({ where: { email: credentials.email } });
        } catch (err) {
          const described = describeDbError(err);
          console.error('[auth] database error during sign-in:', described.code, described.message);
          throw new Error(`${DB_ERROR_PREFIX}: ${described.message}`);
        }

        if (!user?.password) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
};
