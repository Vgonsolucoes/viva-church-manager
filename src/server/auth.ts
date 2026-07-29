import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import type { RoleKey } from "@/server/rbac";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            roles: true,
            member: { select: { photoUrl: true } },
          },
        });
        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        const resolvedImage =
          user.imageUrl ?? user.member?.photoUrl ?? undefined;

        return {
          id: user.id,
          name: user.name ?? user.email,
          email: user.email,
          image: resolvedImage,
          roles: user.roles.map((r) => r.role) as RoleKey[],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.roles = user.roles ?? [];
        if (user.image) {
          token.picture = user.image;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.uid = token.uid;
      session.roles = (token.roles ?? []) as RoleKey[];
      if (session.user) {
        session.user.image = (token.picture ?? session.user.image) ?? null;
      }
      return session;
    },
  },
};
