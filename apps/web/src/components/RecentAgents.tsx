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
      <h2 id="recent" className="group-title">
        son açılanlar
      </h2>
      {items && items.length === 0 && <p className="px-1 text-[13px] leading-[18px] text-faint">Bu tarayıcıda kaydettiğin agent'lar burada görünür.</p>}
      <ul>
        {items?.map((a) => (
          <li key={a.id}>
            <Link href={`/agents/${a.id}`} className="block rounded-[6px] px-2 py-2 hover:bg-well">
              <span className="block truncate text-[14px] font-semibold">{a.name}</span>
              <span className="block text-[12px] text-secondary">{new Date(a.at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
