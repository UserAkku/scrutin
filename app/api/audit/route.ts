import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUrl } from "@/lib/utils";
import { runAuditPipeline } from "@/lib/audit-runner";

const schema = z.object({
  url: z.string().min(1).max(2048),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    const body = await request.json();
    const { url } = schema.parse(body);
    const normalized = normalizeUrl(url);
    const userId = session?.user?.id ?? null;

    // Rate limiting for authenticated users
    if (session?.user && userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const today = new Date().toDateString();
      const lastDate = user?.lastAuditDate?.toDateString();
      const count = lastDate === today ? (user?.auditsToday ?? 0) : 0;

      if ((user?.plan ?? "free") === "free" && count >= 10) {
        return NextResponse.json(
          { error: "Daily audit limit reached (10/day on free plan). Try again tomorrow." },
          { status: 429 }
        );
      }
    }

    // Create the audit record immediately
    const audit = await prisma.audit.create({
      data: {
        userId,
        url: normalized.toString(),
        hostname: normalized.hostname,
        faviconUrl: `${normalized.origin}/favicon.ico`,
        isGuest: !session?.user,
        status: "pending",
        progress: 0,
      },
    });

    // Update user audit count
    if (session?.user && userId) {
      const today = new Date().toDateString();
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const isNewDay = user?.lastAuditDate?.toDateString() !== today;
      await prisma.user.update({
        where: { id: userId },
        data: {
          auditsToday: isNewDay ? 1 : { increment: 1 },
          lastAuditDate: new Date(),
        },
      });
    }

    // Fire-and-forget background pipeline - user can close the tab
    // Using void + setImmediate to ensure response is sent first
    setImmediate(() => {
      runAuditPipeline(audit).catch((err) => {
        console.error(`[AuditPipeline] Failed for audit ${audit.id}:`, err);
        // Mark audit as errored
        prisma.audit.update({
          where: { id: audit.id },
          data: { status: "error", progress: 0 },
        }).catch(() => {});
      });
    });

    return NextResponse.json({
      auditId: audit.id,
      status: "pending",
      message: "Audit started. You can safely close this tab — we'll keep running it in the background.",
    });
  } catch (error) {
    console.error("[POST /api/audit]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start audit" },
      { status: 400 }
    );
  }
}