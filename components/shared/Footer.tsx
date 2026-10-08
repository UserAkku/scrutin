import Link from "next/link";
import { auth } from "@/lib/auth";

export async function Footer() {
  const session = await auth();

  return (
    <footer className="border-t-[3px] border-brutal-black py-16 bg-[var(--bg)]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-3 gap-10 px-4 md:px-8">
        
        {/* Column 1: Brand */}
        <div className="flex flex-col gap-4">
          <Link href="/" className="group flex items-center gap-[3px]">
            {["K","R","I","L","L","O"].map((letter, i) => {
              const colors = [
                "var(--pastel-pink)",
                "var(--pastel-blue)",
                "#E7F664",
                "var(--pastel-green)",
                "var(--pastel-yellow)",
                "white",
              ];
              const rotations = ["-rotate-3","rotate-2","-rotate-1","rotate-3","-rotate-2","rotate-1"];
              return (
                <span
                  key={i}
                  className={`inline-flex items-center justify-center w-8 h-8 border-[2.5px] border-brutal-black font-display text-sm font-black text-brutal-black select-none ${rotations[i]}`}
                  style={{ backgroundColor: colors[i] }}
                >
                  {letter}
                </span>
              );
            })}
          </Link>
          <p className="text-brutal-black font-body font-bold max-w-xs">
            Industrial-grade website audits. Find issues before your users do.
          </p>
          <p className="text-sm font-bold text-brutal-black/50 mt-auto pt-4">
            © {new Date().getFullYear()} Krillo. All rights reserved.
          </p>
        </div>

        {/* Column 2: Navigation */}
        <div className="flex flex-col gap-4">
          <h3 className="font-display text-xl uppercase tracking-widest text-brutal-black mb-2">Product</h3>
          <Link href="/sample" className="font-body font-bold uppercase hover:underline decoration-2 underline-offset-4 w-fit">Sample Report</Link>
          <Link href="/#pricing" className="font-body font-bold uppercase hover:underline decoration-2 underline-offset-4 w-fit">Pricing</Link>
          <Link href="/support" className="font-body font-bold uppercase hover:underline decoration-2 underline-offset-4 w-fit">Support</Link>
          {!session?.user && (
            <Link href="/login" className="font-body font-bold uppercase hover:underline decoration-2 underline-offset-4 w-fit mt-2">Sign In / Sign Up</Link>
          )}
        </div>

        {/* Column 3: Legal */}
        <div className="flex flex-col gap-4">
          <h3 className="font-display text-xl uppercase tracking-widest text-brutal-black mb-2">Legal</h3>
          <Link href="/legal/privacy" className="font-body font-bold uppercase hover:underline decoration-2 underline-offset-4 w-fit">Privacy Policy</Link>
          <Link href="/legal/terms" className="font-body font-bold uppercase hover:underline decoration-2 underline-offset-4 w-fit">Terms of Service</Link>
          <Link href="/legal/refund" className="font-body font-bold uppercase hover:underline decoration-2 underline-offset-4 w-fit">Refund Policy</Link>
        </div>

      </div>
    </footer>
  );
}
