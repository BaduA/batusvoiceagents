"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { readRecentRaw, parseRecent } from "@/lib/client/recent";

const noopSubscribe = () => () => {};

export function RecentAgents() {
  const raw = useSyncExternalStore(noopSubscribe, readRecentRaw, () => null);
  const items = useMemo(() => (raw === null ? null : parseRecent(raw)), [raw]);
  return (
    <section aria-labelledby="recent">
      <h2 id="recent" className="mb-2 text-sm font-semibold">
        Son açılanlar
      </h2>
      {items && items.length === 0 && <p className="text-[14px] leading-[21px] text-ink-3">Bu tarayıcıda kaydettiğin agent'lar burada görünür.</p>}
      {items && items.length > 0 && (
      <ul className="overflow-hidden rounded-xl border border-border">
        {items.map((a) => (
          <li key={a.id} className="border-t border-line first:border-t-0">
            <Link href={`/agents/${a.id}`} className="block px-4 py-3 transition-colors duration-150 hover:bg-muted">
              <span className="block truncate text-sm font-medium">{a.name}</span>
              <span className="block text-[13px] text-ink-3">{new Date(a.at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</span>
            </Link>
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}
