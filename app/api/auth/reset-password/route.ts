import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { hashToken } from "@/lib/utils";

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  try {
    const { email, token, password } = schema.parse(await request.json());
    const hashed = hashToken(token);
    const record = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: email,
          token: hashed
        }
      }
    });

    if (!record || record.expires < new Date()) {
      return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
    }

    await prisma.user.update({
      where: { email },
      data: { password: await hashPassword(password) }
    });

    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: email,
          token: hashed
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reset password" },
      { status: 400 }
    );
  }
}
