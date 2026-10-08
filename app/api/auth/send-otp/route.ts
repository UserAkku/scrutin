import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/brevo";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Rate limiting: prevent spamming
    const recentOtps = await prisma.otpCode.count({
      where: {
        email,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // last 5 mins
        },
      },
    });

    if (recentOtps >= 3) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes." },
        { status: 429 }
      );
    }

    // Generate 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Save to DB
    await prisma.otpCode.create({
      data: {
        email,
        code,
        expiresAt,
      },
    });

    // Send Email
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2D2323;">Your Login Code for Krillo</h2>
        <p>Use the following 6-digit code to log in to your account. This code is valid for 10 minutes.</p>
        <div style="background-color: #E7F664; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${code}
        </div>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    const emailResponse = await sendEmail({
      to: email,
      subject: "Your Krillo Login Code",
      htmlContent,
    });

    if (!emailResponse.success) {
      console.error("Email response failed:", emailResponse);
      return NextResponse.json(
        { error: emailResponse.error || "Failed to send OTP email via Brevo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("OTP send error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send OTP" },
      { status: 500 }
    );
  }
}
