import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/shared/button";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <Link href="/" className="font-display text-sm uppercase tracking-[0.22em]">
          Scrutin
        </Link>
        <div className="flex items-center gap-3">
          <Link href={session?.user ? "/dashboard" : "/login"}>
            <Button variant="ghost" size="sm">
              {session?.user ? "Dashboard" : "Sign In"}
            </Button>
          </Link>
          <Link href={session?.user ? "/dashboard" : "/signup"}>
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
