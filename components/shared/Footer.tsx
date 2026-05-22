import Link from "next/link";
import { auth } from "@/lib/auth";

export async function Footer() {
  const session = await auth();

  return (
    <footer className="border-t-[3px] border-brutal-black py-10 bg-[var(--bg)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-8">
        <p className="text-center md:text-left text-brutal-black font-body font-bold">
          Scrutin. Industrial-grade website audits.
        </p>
        <div className="flex flex-wrap justify-center gap-4 uppercase tracking-widest font-display text-brutal-black">
          <Link href="/sample" className="hover:underline decoration-4 underline-offset-4">Sample Report</Link>
          {!session?.user ? (
            <>
              <Link href="/login" className="hover:underline decoration-4 underline-offset-4">Sign In</Link>
              <Link href="/signup" className="hover:underline decoration-4 underline-offset-4">Create Account</Link>
            </>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
