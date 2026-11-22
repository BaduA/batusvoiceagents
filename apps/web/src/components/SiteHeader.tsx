import Link from "next/link";

/** Brand mark: a speaker grille with the signal dot, as if milled into the chassis. */
export function AppMark({ size = 22 }: { size?: number }) {
  const dots = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!(x === 3 && y === 0)) dots.push(<circle key={`${x}${y}`} cx={4 + x * 5.3} cy={4 + y * 5.3} r={1.5} fill="currentColor" />);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0 text-engrave">
      {dots}
      <circle cx={19.9} cy={4} r={2.4} fill="var(--signal)" />
    </svg>
  );
}

/** Chassis header strip for simple pages (admin, closed links). */
export function SiteHeader({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex h-14 items-center gap-3 px-4 sm:px-6">
      <Link href="/" className="flex items-center gap-2.5">
        <AppMark />
        <span className="stamp hidden text-[14px] lowercase sm:inline">voice agent playground</span>
      </Link>
      {title && <span className="truncate text-[14px] lowercase text-faint">{title}</span>}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </header>
  );
}
