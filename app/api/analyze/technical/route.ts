import { NextResponse } from "next/server";
import { analyzeTechnical } from "@/lib/analyzers/technical";

export async function POST(request: Request) {
  const { url } = (await request.json()) as { url: string };
  return NextResponse.json(await analyzeTechnical(url));
}
