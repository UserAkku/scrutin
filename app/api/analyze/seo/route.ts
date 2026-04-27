import { NextResponse } from "next/server";
import { analyzeSeo } from "@/lib/analyzers/seo";

export async function POST(request: Request) {
  const { url } = (await request.json()) as { url: string };
  return NextResponse.json(await analyzeSeo(url));
}
