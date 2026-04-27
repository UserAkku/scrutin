import { parse } from "node-html-parser";
import { normalizeUrl, percentage, retry } from "@/lib/utils";

export interface HtmlSnapshot {
  url: string;
  html: string;
  root: ReturnType<typeof parse>;
  headers: Headers;
  responseTimeMs: number;
}

export async function fetchHtmlSnapshot(targetUrl: string): Promise<HtmlSnapshot> {
  const normalized = normalizeUrl(targetUrl).toString();
  const startedAt = Date.now();

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
  };

  let response: Response | null = null;
  try {
    response = await retry(
      () =>
        fetch(normalized, {
          cache: "no-store",
          redirect: "follow",
          headers
        }),
      2
    );
  } catch {
    response = null;
  }

  if (!response?.ok) {
    const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(normalized)}`;
    response = await retry(
      () =>
        fetch(proxiedUrl, {
          cache: "no-store",
          headers
        }),
      2
    );
  }

  if (!response.ok) {
    throw new Error(`HTML fetch failed (${response.status})`);
  }

  const html = await response.text();
  return {
    url: normalized,
    html,
    root: parse(html),
    headers: response.headers,
    responseTimeMs: Date.now() - startedAt
  };
}

export function textContent(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTopKeywords(content: string) {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "that",
    "with",
    "this",
    "from",
    "your",
    "have",
    "you",
    "are",
    "our",
    "but",
    "not",
    "all",
    "was",
    "can",
    "has",
    "will",
    "its"
  ]);

  const words = content
    .toLowerCase()
    .match(/[a-z]{3,}/g)
    ?.filter((word) => !stopWords.has(word)) ?? [];

  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const total = words.length;
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([term, count]) => ({
      term,
      count,
      density: percentage(count, total)
    }));
}

export function scoreListCompletion(results: boolean[]) {
  if (results.length === 0) {
    return 0;
  }
  return Math.round((results.filter(Boolean).length / results.length) * 100);
}

export async function fetchJson<T>(url: string) {
  const response = await retry(() => fetch(url, { cache: "no-store" }));
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
