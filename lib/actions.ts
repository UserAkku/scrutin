"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function loginAction(formData: FormData) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid credentials." };
        default:
          return { error: "Something went wrong." };
      }
    }
    // Rethrow all other errors so Next.js redirects work
    throw error;
  }
}

export async function googleLoginAction() {
  await signIn("google", { redirectTo: "/dashboard" });
}

import { prisma } from "@/lib/prisma";
import { auth as getAuth } from "@/lib/auth"; // Avoid collision with existing signIn
import { revalidatePath } from "next/cache";

export async function deleteAuditAction(auditId: string) {
  const session = await getAuth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { userId: true },
  });

  if (!audit) {
    throw new Error("Audit not found");
  }

  if (audit.userId !== userId) {
    throw new Error("Forbidden");
  }

  await prisma.audit.delete({
    where: { id: auditId },
  });

  revalidatePath("/dashboard");
}
