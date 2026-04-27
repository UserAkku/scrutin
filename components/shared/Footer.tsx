import Link from "next/link";
import { auth } from "@/lib/auth";

export async function Footer() {
  const session = await auth();

  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 text-sm text-foreground/70 md:flex-row md:items-center md:justify-between md:px-8">
        <p className="text-center md:text-left">Scrutin. Industrial-grade website audits for teams that want exact fixes.</p>
        <div className="flex flex-wrap justify-center gap-4 uppercase tracking-[0.14em]">
          <Link href="/sample">Sample Report</Link>
          {!session?.user ? (
            <>
              <Link href="/login">Sign In</Link>
              <Link href="/signup">Create Account</Link>
            </>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
