import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuditForViewer, serializeAudit } from "@/lib/audit-access";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const audit = await getAuditForViewer(params.id, session?.user?.id);
  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  return NextResponse.json(serializeAudit(audit));
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { isPublic?: boolean };
  const audit = await prisma.audit.findUnique({ where: { id: params.id } });
  if (!audit || audit.userId !== session.user.id) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const updated = await prisma.audit.update({
    where: { id: params.id },
    data: { isPublic: Boolean(body.isPublic) }
  });

  return NextResponse.json({ isPublic: updated.isPublic });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const audit = await prisma.audit.findUnique({ where: { id: params.id } });
  if (!audit || audit.userId !== session.user.id) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  await prisma.audit.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
