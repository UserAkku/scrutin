import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { requiresLogin: true, error: "Please login first to join the waitlist." },
        { status: 401 }
      );
    }

    const existing = await prisma.proNotification.findUnique({
      where: { email: session.user.email }
    });

    if (existing) {
      return NextResponse.json({ success: true, message: "You're already on the list! 🎉" });
    }

    await prisma.proNotification.create({
      data: {
        email: session.user.email,
        userId: session.user.id,
      }
    });

    return NextResponse.json({ success: true, message: "You've been added to the waitlist! 🎉" });
  } catch (error) {
    console.error("Pro notify error:", error);
    return NextResponse.json(
      { error: "Failed to join waitlist" },
      { status: 500 }
    );
  }
}
