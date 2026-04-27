export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-foreground/55">404</p>
      <h1 className="mt-4 font-display text-4xl uppercase">Record Not Found</h1>
      <p className="mt-4 text-foreground/70">The requested audit record is missing or not available to your account.</p>
    </div>
  );
}
