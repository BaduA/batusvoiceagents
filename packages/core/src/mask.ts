/**
 * Masks sensitive values before anything is written to messages / action_logs.
 * Card numbers (Luhn-checked), IBAN, T.C. kimlik no (checksum), phone numbers.
 */

function luhnValid(digits: string) {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function tcknValid(s: string) {
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const d = s.split("").map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return d[9] === d10 && d[10] === d11;
}

const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/gi;
const TCKN_RE = /\b[1-9]\d{10}\b/g;
const PHONE_RE = /(?:\+90[ -]?|\b0)?\(?5\d{2}\)?[ -]?\d{3}[ -]?\d{2}[ -]?\d{2}\b/g;

export function maskText(input: string): string {
  let out = input;
  out = out.replace(IBAN_RE, (m) => {
    const compact = m.replace(/ /g, "");
    if (compact.length < 15) return m;
    return `${compact.slice(0, 2)}** **** **** ${compact.slice(-4)}`;
  });
  out = out.replace(CARD_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19 || !luhnValid(digits)) return m;
    return `**** **** **** ${digits.slice(-4)}`;
  });
  out = out.replace(TCKN_RE, (m) => (tcknValid(m) ? `*********${m.slice(-2)}` : m));
  out = out.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    return `${m.startsWith("+") ? "+90 " : "0"}5** *** ** ${digits.slice(-2)}`;
  });
  return out;
}

/** Deep-masks every string inside a JSON value. */
export function maskDeep<T>(value: T): T {
  if (typeof value === "string") return maskText(value) as T;
  if (typeof value === "number" && Number.isInteger(value)) {
    const s = String(value);
    const masked = maskText(s);
    return (masked === s ? value : masked) as T;
  }
  if (Array.isArray(value)) return value.map(maskDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskDeep(v)])) as T;
  }
  return value;
}
