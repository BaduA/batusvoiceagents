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
      <h2 id="recent" className="text-[20px] font-bold">
        Sizin agent'larınız
      </h2>
      {items && items.length === 0 && <p className="mt-3 text-[15px] leading-6 text-graphite">Bu tarayıcıda kaydettiğiniz agent'lar burada listelenir.</p>}
      <ul className="mt-4 space-y-3">
        {items?.map((a) => (
          <li key={a.id}>
            <Link href={`/agents/${a.id}`} className="text-[16px] font-medium hover:underline">
              {a.name}
            </Link>
            <span className="block text-[13px] text-graphite">{new Date(a.at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
