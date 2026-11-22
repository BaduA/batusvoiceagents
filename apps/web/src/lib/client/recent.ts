"use client";

const KEY = "vap.recentAgents";
export interface RecentAgent {
  id: string;
  name: string;
  at: number;
}

export function readRecentRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parseRecent(raw: string): RecentAgent[] {
  try {
    return JSON.parse(raw) as RecentAgent[];
  } catch {
    return [];
  }
}

export function readRecent(): RecentAgent[] {
  return parseRecent(readRecentRaw());
}

export function rememberAgent(a: { id: string; name: string }) {
  try {
    const list = readRecent().filter((x) => x.id !== a.id);
    list.unshift({ id: a.id, name: a.name, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    /* storage unavailable: recent list is a convenience only */
  }
}
