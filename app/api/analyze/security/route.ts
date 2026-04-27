import { NextResponse } from "next/server";
import { analyzeSecurity } from "@/lib/analyzers/security";

export async function POST(request: Request) {
  const { url } = (await request.json()) as { url: string };
  return NextResponse.json(await analyzeSecurity(url));
}
