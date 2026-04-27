import type { ProgressEvent } from "@/types/audit";

type Subscriber = (event: ProgressEvent) => void;

const subscribers = new Map<string, Set<Subscriber>>();
const history = new Map<string, ProgressEvent[]>();

export function publishAuditEvent(auditId: string, event: ProgressEvent) {
  const events = history.get(auditId) ?? [];
  events.push(event);
  history.set(auditId, events);

  subscribers.get(auditId)?.forEach((subscriber) => subscriber(event));
}

export function getAuditHistory(auditId: string) {
  return history.get(auditId) ?? [];
}

export function subscribeToAudit(
  auditId: string,
  subscriber: Subscriber
) {
  const set = subscribers.get(auditId) ?? new Set<Subscriber>();
  set.add(subscriber);
  subscribers.set(auditId, set);

  return () => {
    const current = subscribers.get(auditId);
    current?.delete(subscriber);
    if (current && current.size === 0) {
      subscribers.delete(auditId);
    }
  };
}
