import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeUrl(input: string) {
  const value = input.trim();
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol);
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  operation: () => Promise<T>,
  attempts = 3,
  baseDelay = 500
): Promise<T> {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (index < attempts - 1) {
        await wait(baseDelay * 2 ** index);
      }
    }
  }
  throw lastError;
}

export function percentage(value: number, total: number) {
  if (total === 0) {
    return 0;
  }
  return Number(((value / total) * 100).toFixed(1));
}

export function truncate(text: string, length: number) {
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, length - 1)}…`;
}

export function getGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function getScoreTone(score: number) {
  if (score >= 90) return "text-success";
  if (score >= 75) return "text-lime-500";
  if (score >= 60) return "text-warning";
  if (score >= 40) return "text-orange-500";
  return "text-danger";
}

export function hashToken(token: string) {
  return Buffer.from(token).toString("base64url");
}
