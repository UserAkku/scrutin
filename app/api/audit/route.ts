import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUrl } from "@/lib/utils";

const schema = z.object({
  url: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    const { url } = schema.parse(await request.json());
    const normalized = normalizeUrl(url);
    const userId = session?.user?.id ?? null;

    if (session?.user) {
      const user = await prisma.user.findUnique({ where: { id: userId! } });
      const today = new Date().toDateString();
      const lastDate = user?.lastAuditDate?.toDateString();
      const count = lastDate === today ? user?.auditsToday ?? 0 : 0;
      if ((user?.plan ?? "free") === "free" && count >= 10) {
        return NextResponse.json(
          { error: "Daily audit limit reached. Try again tomorrow." },
          { status: 429 }
        );
      }
    }

    const audit = await prisma.audit.create({
      data: {
        userId,
        url: normalized.toString(),
        hostname: normalized.hostname,
        faviconUrl: `${normalized.origin}/favicon.ico`,
        isGuest: !session?.user
      }
    });

    if (session?.user) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          auditsToday: {
            increment: 1
          },
          lastAuditDate: new Date()
        }
      });
    }

    return NextResponse.json({ auditId: audit.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start audit" },
      { status: 400 }
    );
  }
}
