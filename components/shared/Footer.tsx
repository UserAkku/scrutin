import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-black/10 py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-sm text-foreground/70 md:flex-row md:items-center md:justify-between md:px-8">
        <p>Scrutin. Industrial-grade website audits for teams that want exact fixes.</p>
        <div className="flex gap-4 uppercase tracking-[0.14em]">
          <Link href="/sample">Sample Report</Link>
          <Link href="/login">Sign In</Link>
          <Link href="/signup">Create Account</Link>
        </div>
      </div>
    </footer>
  );
}
