import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      plan: string;
      auditsToday: number;
    };
  }

  interface User {
    plan?: string;
    auditsToday?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    plan?: string;
    auditsToday?: number;
  }
}
