import type { DefaultSession } from "next-auth";
import type { RoleKey } from "@/server/rbac";

declare module "next-auth" {
  interface User {
    roles?: RoleKey[];
    image?: string | null;
  }

  interface Session extends DefaultSession {
    uid?: string;
    roles?: RoleKey[];
    user?: DefaultSession["user"] & {
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    roles?: RoleKey[];
    picture?: string | null;
  }
}
