import type { DefaultSession } from "next-auth";
import type { RoleKey } from "@/server/rbac";

declare module "next-auth" {
  interface User {
    roles?: RoleKey[];
  }

  interface Session extends DefaultSession {
    uid?: string;
    roles?: RoleKey[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    roles?: RoleKey[];
  }
}
