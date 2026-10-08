export async function sendEmail({
  to,
  subject,
  htmlContent,
}: {
  to: string;
  subject: string;
  htmlContent: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_FROM_EMAIL || process.env.BREVO_SENDER_EMAIL || "noreply@krillo.tech";
  const senderName = process.env.BREVO_FROM_NAME || process.env.BREVO_SENDER_NAME || "Krillo";

  if (!apiKey) {
    console.error("Missing BREVO_API_KEY environment variable");
    return { success: false, error: "Missing email configuration" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject: subject,
        htmlContent: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo API error:", errorData);
      return { success: false, error: "Failed to send email" };
    }

    const data = await response.json();
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
