import Link from "next/link";

/** Small brand mark: a single dot in the primary colour (Agent Starter style). */
export function AppMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full bg-primary/10" style={{ width: size, height: size }} aria-hidden>
      <span className="rounded-full bg-primary" style={{ width: size * 0.36, height: size * 0.36 }} />
    </span>
  );
}

export function SiteHeader({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
      <Link href="/" lang="en" className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-wider uppercase">
        <span className="size-2.5 rounded-full bg-primary" aria-hidden />
        Voice Agent Playground
      </Link>
      {title && <span className="truncate font-mono text-[11px] tracking-wider text-muted-foreground uppercase">/ {title}</span>}
      <span className="flex-1" />
      {children}
    </header>
  );
}
