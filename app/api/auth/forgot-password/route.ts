import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/utils";

const schema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const rawToken = randomUUID();
      const token = hashToken(rawToken);
      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires: new Date(Date.now() + 1000 * 60 * 30)
        }
      });

      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

      return NextResponse.json({
        success: true,
        resetUrl: process.env.NODE_ENV === "development" ? resetUrl : undefined
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process request" },
      { status: 400 }
    );
  }
}
