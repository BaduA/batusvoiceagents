import { findCollectionIntent } from "./guard";
import { normalizeTr } from "./text";

/**
 * Layer 3 — runtime checks during a conversation.
 * The SAFETY_BLOCK in the system prompt does the real work; these only detect and log.
 */

const INJECTION_PATTERNS = [
  /(onceki|yukaridaki|tum|butun) (talimat|kural)\w* (unut|yok say|gormezden gel|iptal)/,
  /kurallari\w* (unut|yok say|gormezden gel|boz)/,
  /artik (sen )?(bir )?(banka\w*|bankaci\w*|polis\w*|savci\w*|e-?devlet\w*|gorevli\w*|yetkili\w*)/,
  /(system prompt|sistem prompt|sistem talimat)\w*/,
  /ignore (all |the )?(previous|above|prior) (instructions|rules)/,
  /you are now (a |an )?\w+/,
  /(jailbreak|dan mode|developer mode)/,
  /(kart|sifre|otp|sms kod|kimlik)\w* (bilgi\w* )?(iste|al|topla)(meye|mak|sana|man)\b/,
];

export function detectInjection(userText: string): boolean {
  const n = normalizeTr(userText);
  return INJECTION_PATTERNS.some((re) => re.test(n));
}

/** Light output check: did the assistant ask for sensitive data anyway? */
export function replyViolates(replyText: string): boolean {
  return findCollectionIntent(replyText).length > 0;
}

export const SAFE_FALLBACK_REPLY =
  "Bu demo ortamında kart, şifre, kimlik veya doğrulama kodu gibi bilgileri alamıyorum. Başka nasıl yardımcı olabilirim?";
