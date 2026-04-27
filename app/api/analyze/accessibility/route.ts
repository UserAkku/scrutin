import { NextResponse } from "next/server";
import { analyzeAccessibility } from "@/lib/analyzers/accessibility";

export async function POST(request: Request) {
  const { url } = (await request.json()) as { url: string };
  return NextResponse.json(await analyzeAccessibility(url));
}
