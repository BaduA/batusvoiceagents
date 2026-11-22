/** Lowercases with Turkish rules and strips diacritics: "Şifre İSTE" -> "sifre iste". */
export function normalizeTr(input: string): string {
  return input
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/** Splits an identifier like "kartNo", "card_number", "TC-Kimlik" into normalized tokens. */
export function identifierTokens(name: string): string[] {
  return normalizeTr(name.replace(/([a-z0-9])([A-Z])/g, "$1 $2"))
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
