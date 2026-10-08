import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login"
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" }
      },
      async authorize(rawCredentials) {
        if (!rawCredentials?.email || !rawCredentials?.code) {
          return null;
        }

        const email = rawCredentials.email as string;
        const code = rawCredentials.code as string;

        // Verify OTP code
        const otpRecord = await prisma.otpCode.findFirst({
          where: {
            email,
            code,
            used: false,
            expiresAt: { gt: new Date() }
          },
          orderBy: { createdAt: 'desc' }
        });

        if (!otpRecord) {
          return null; // Invalid or expired OTP
        }

        // Mark OTP as used
        await prisma.otpCode.update({
          where: { id: otpRecord.id },
          data: { used: true }
        });

        // Find or create user
        let user = await prisma.user.findUnique({
          where: { email }
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name: email.split('@')[0], // Default name
              plan: "free"
            }
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          plan: user.plan,
          auditsToday: user.auditsToday
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.plan = user.plan;
        token.auditsToday = user.auditsToday;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.plan = typeof token.plan === "string" ? token.plan : "free";
        session.user.auditsToday =
          typeof token.auditsToday === "number" ? token.auditsToday : 0;
      }
      return session;
    }
  }
});

