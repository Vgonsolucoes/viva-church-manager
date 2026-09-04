import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { RoleKey } from "@/server/rbac";
import { verifyUserCredentials } from "@/server/auth-jwt";

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
        const user = await verifyUserCredentials(
          credentials?.email ?? "",
          credentials?.password ?? "",
        );
        if (!user) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image ?? undefined,
          roles: user.roles as RoleKey[],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.roles = (user as unknown as { roles?: RoleKey[] }).roles ?? [];
        if (user.image) {
          token.picture = user.image;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.uid = token.uid;
      session.roles = (token.roles ?? []) as RoleKey[];
      if (session.user && token.picture) {
        session.user.image = token.picture;
      }
      return session;
    },
  },
};
