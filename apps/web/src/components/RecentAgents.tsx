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
      <h2 id="recent" className="mb-1 px-3 text-[12px] font-semibold text-tertiary">
        Son açılanlar
      </h2>
      {items && items.length === 0 && <p className="px-3 text-[13px] leading-[18px] text-secondary">Bu tarayıcıda kaydettiğin agent'lar burada görünür.</p>}
      <ul>
        {items?.map((a) => (
          <li key={a.id}>
            <Link href={`/agents/${a.id}`} className="block rounded-[8px] px-3 py-2 hover:bg-fill">
              <span className="block truncate text-[14px] font-medium">{a.name}</span>
              <span className="block text-[12px] text-secondary">{new Date(a.at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
