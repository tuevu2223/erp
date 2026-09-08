import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/rbac";

/** Bổ sung role và tuỳ chọn cá nhân vào session/JWT của NextAuth. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      theme: "LIGHT" | "DARK" | "SYSTEM";
      language: "EN" | "VI";
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    theme?: "LIGHT" | "DARK" | "SYSTEM";
    language?: "EN" | "VI";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    theme?: "LIGHT" | "DARK" | "SYSTEM";
    language?: "EN" | "VI";
  }
}
