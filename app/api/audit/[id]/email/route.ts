import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/brevo";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const audit = await prisma.audit.findUnique({
      where: { id: params.id },
      include: { issues: true },
    });

    if (!audit) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 });
    }

    if (audit.userId !== session.user.id && !audit.isPublic) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Since we don't have a reliable way to generate the exact PDF on the server 
    // without Puppeteer which is heavy, we'll send a beautiful HTML summary email.
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2D2323;">
        <div style="background-color: #E7F664; padding: 30px; text-align: center; border-bottom: 4px solid #2D2323;">
          <h1 style="text-transform: uppercase; letter-spacing: 2px; margin: 0;">Krillo Audit Report</h1>
        </div>
        
        <div style="padding: 30px; background-color: #FAFAFA; border: 4px solid #2D2323; margin-top: 20px;">
          <h2 style="margin-top: 0;">${audit.url}</h2>
          <div style="background-color: #C4F0FF; padding: 20px; border: 3px solid #2D2323; text-align: center; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; font-weight: bold; text-transform: uppercase;">Overall Score</p>
            <p style="margin: 10px 0 0 0; font-size: 64px; font-weight: bold;">${audit.overallScore}%</p>
          </div>
          
          <h3>Summary of Findings:</h3>
          <ul>
            <li><strong>Performance:</strong> ${audit.performanceScore} / 100</li>
            <li><strong>SEO:</strong> ${audit.seoScore} / 100</li>
            <li><strong>Security:</strong> ${audit.securityScore} / 100</li>
            <li><strong>Accessibility:</strong> ${audit.accessibilityScore} / 100</li>
            <li><strong>UX / UI:</strong> ${audit.uxScore} / 100</li>
            <li><strong>Technical:</strong> ${audit.technicalScore} / 100</li>
          </ul>
          
          <p style="margin-top: 30px; font-weight: bold;">
            We found ${audit.issues.length} areas for improvement. 
          </p>
          <a href="${process.env.NEXTAUTH_URL}/audit/${audit.id}" style="display: inline-block; background-color: #2D2323; color: white; padding: 15px 25px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-radius: 5px;">
            View Full Report & Download PDF
          </a>
        </div>
        
        <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${new Date().getFullYear()} Krillo. All rights reserved.</p>
        </div>
      </div>
    `;

    const emailResponse = await sendEmail({
      to: session.user.email,
      subject: `Audit Report for ${audit.hostname} - Score: ${audit.overallScore}%`,
      htmlContent,
    });

    if (!emailResponse.success) {
      throw new Error(emailResponse.error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email report error:", error);
    return NextResponse.json(
      { error: "Failed to email report" },
      { status: 500 }
    );
  }
}
