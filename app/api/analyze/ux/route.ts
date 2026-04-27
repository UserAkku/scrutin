import { NextResponse } from "next/server";
import { analyzeUx } from "@/lib/analyzers/ux";

export async function POST(request: Request) {
  const { url } = (await request.json()) as { url: string };
  return NextResponse.json(await analyzeUx(url));
}
