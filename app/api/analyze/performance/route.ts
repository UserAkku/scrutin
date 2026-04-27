import { NextResponse } from "next/server";
import { analyzePerformance } from "@/lib/analyzers/performance";

export async function POST(request: Request) {
  const { url } = (await request.json()) as { url: string };
  return NextResponse.json(await analyzePerformance(url));
}
