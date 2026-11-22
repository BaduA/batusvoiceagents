import Link from "next/link";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-4 border-b border-rule bg-sheet px-4 py-2.5">
      <Link href="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
        <Mark />
        Voice Agent Playground
      </Link>
      <div className="ml-auto flex items-center gap-3">{children}</div>
    </header>
  );
}

/** A VU needle at rest: the product's one accent. */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M3 17a9 9 0 0 1 18 0" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 17 16.5 8.5" stroke="var(--needle)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="2" fill="var(--ink)" />
    </svg>
  );
}
