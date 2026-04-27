import { prisma } from "@/lib/prisma";
import { runAuditPipeline } from "@/lib/audit-runner";
import { getAuditHistory, subscribeToAudit } from "@/lib/stream";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const audit = await prisma.audit.findUnique({
    where: { id: params.id }
  });

  if (!audit) {
    return new Response("Audit not found", { status: 404 });
  }

  if (audit.status === "pending") {
    void runAuditPipeline(audit);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const existingEvents = getAuditHistory(params.id);
      for (const event of existingEvents) {
        send(event);
      }
      if (existingEvents.some((event) => event.status === "complete" && !event.category)) {
        controller.close();
        return;
      }

      const unsubscribe = subscribeToAudit(params.id, (event) => {
        send(event);
        if (event.status === "complete") {
          unsubscribe();
          controller.close();
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
