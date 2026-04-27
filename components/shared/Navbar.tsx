import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/shared/button";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <Link href="/" className="font-display text-sm uppercase tracking-[0.22em]">
          Scrutin
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {session?.user ? (
            <>
              <Link href="/dashboard" className="hidden sm:inline-block">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <form action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}>
                <Button size="sm" variant="secondary">Logout</Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden sm:inline-block">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Get Started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
