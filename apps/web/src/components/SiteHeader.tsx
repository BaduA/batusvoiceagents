import Link from "next/link";

/** App icon: the VU needle at rest on a rounded-square "squircle". */
export function AppMark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-[28%] bg-gradient-to-b from-[#2c2c2e] to-[#121214] shadow-[inset_0_0.5px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.3)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 24 24">
        <path d="M4 16.5a8 8 0 0 1 16 0" fill="none" stroke="#f5f5f7" strokeOpacity="0.85" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 16.5 15.8 9" stroke="#ffb340" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="1.8" fill="#f5f5f7" />
      </svg>
    </span>
  );
}

/** Unified toolbar for simple pages (welcome, shared link, admin). */
export function SiteHeader({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex h-[52px] items-center gap-3 border-b border-separator bg-sidebar px-4 backdrop-blur-xl backdrop-saturate-150">
      <Link href="/" className="flex items-center gap-2 text-[14px] font-semibold">
        <AppMark />
        <span className="hidden sm:inline">Voice Agent Playground</span>
      </Link>
      {title && <div className="min-w-0 truncate text-[14px] text-secondary">{title}</div>}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </header>
  );
}
