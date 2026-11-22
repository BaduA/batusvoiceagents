import { z } from "zod";
import type { AgentConfig } from "./schema";
import { identifierTokens, normalizeTr } from "./text";

/**
 * Task Guard — catches agents that would harvest sensitive data or impersonate real
 * institutions to deceive, *before* they are saved. Personas (rude, profane, sarcastic) are allowed.
 *
 * Layer 1: deterministic rules (this file, free, runs first)
 * Layer 2: LLM classifier (prompt + schema here, the call is injected)
 * Layer 3: runtime (SAFETY_BLOCK in prompt.ts + masking in mask.ts)
 * Layer 4: sharing / reports (web app)
 */

export const GUARD_CATEGORIES = [
  "fraud_phishing",
  "sensitive_data_harvest",
  "real_brand_impersonation_for_deception",
  "targeted_harassment",
  "sexual_minors",
  "explicit_sexual",
  "dangerous_instructions",
  "self_harm",
  "ok_profanity_persona",
] as const;
export type GuardCategory = (typeof GUARD_CATEGORIES)[number];

export type GuardDecision = "allow" | "warn" | "block";

export const SENSITIVE_BLOCK_MESSAGE =
  "Bu playground kart, şifre, kimlik veya doğrulama kodu toplayan işlemlere izin vermez.";

// ---------- Layer 1 ----------

/** Token sequences that make a parameter / action name sensitive. Matched on identifier tokens. */
const SENSITIVE_TOKEN_SEQUENCES: string[][] = [
  ["card", "number"], ["card", "no"], ["card", "num"], ["card", "details"], ["card", "info"],
  ["credit", "card"], ["debit", "card"], ["kredi", "karti"], ["kredi", "kart"], ["banka", "karti"],
  ["kart", "no"], ["kart", "numarasi"], ["kart", "numara"], ["kart", "bilgisi"], ["kart", "bilgileri"],
  ["cvv"], ["cvc"], ["cvv2"], ["cvc2"], ["ccv"],
  ["son", "kullanma"], ["skt"], ["expiry"], ["exp", "date"], ["expiration"], ["exp", "month"], ["exp", "year"],
  ["iban"], ["password"], ["passwd"], ["pwd"], ["sifre"], ["sifresi"], ["parola"], ["pin"], ["pin", "kodu"],
  ["tc"], ["tckn"], ["tcno"], ["tc", "kimlik"], ["kimlik", "no"], ["kimlik", "numarasi"], ["tc", "no"],
  ["ssn"], ["national", "id"],
  ["otp"], ["dogrulama", "kodu"], ["dogrulama", "kod"], ["sms", "kodu"], ["sms", "code"], ["onay", "kodu"],
  ["verification", "code"], ["security", "code"], ["guvenlik", "kodu"], ["one", "time", "code"], ["2fa"],
];

/** Compact forms for names written without separators ("cardnumber", "tckimlikno"). Substring match. */
const SENSITIVE_COMPACT = [
  "cardnumber", "cardnum", "creditcard", "debitcard", "kredikarti", "kartnumarasi", "kartno",
  "cvv", "cvc", "sonkullanma", "expirydate", "expdate", "expiration", "password", "passwd",
  "sifre", "parola", "pincode", "pinkodu", "tckimlik", "tckn", "kimlikno", "kimliknumarasi",
  "otpcode", "dogrulamakodu", "smskodu", "smscode", "onaykodu", "verificationcode", "securitycode", "guvenlikkodu",
];

function containsSequence(tokens: string[], seq: string[]) {
  outer: for (let i = 0; i + seq.length <= tokens.length; i++) {
    for (let j = 0; j < seq.length; j++) if (tokens[i + j] !== seq[j]) continue outer;
    return true;
  }
  return false;
}

export function isSensitiveIdentifier(name: string): boolean {
  const tokens = identifierTokens(name);
  if (SENSITIVE_TOKEN_SEQUENCES.some((seq) => containsSequence(tokens, seq))) return true;
  const compact = tokens.join("");
  return SENSITIVE_COMPACT.some((c) => compact.includes(c));
}

/** Sensitive nouns as they appear in prose (normalized, diacritics stripped). */
const SENSITIVE_NOUN =
  "(?:kredi kart\\w*|banka kart\\w*|kart numara\\w*|kart no\\w*|kart bilgi\\w*|kartin\\w* (?:numara|bilgi)\\w*|cvv|cvc|guvenlik kod\\w*|son kullanma tarih\\w*|iban\\w*|sifre\\w*|parola\\w*|pin kod\\w*|pin\\b|tc kimlik\\w*|t\\.?c\\.? (?:kimlik )?no\\w*|kimlik numara\\w*|tckn|otp|tek kullanimlik (?:kod|sifre)\\w*|dogrulama kod\\w*|sms kod\\w*|sms ile gelen kod\\w*|onay kod\\w*|card number\\w*|card details|credit card\\w*|debit card\\w*|password\\w*|passcode|verification code\\w*|one[- ]time (?:code|password)|security code\\w*|cvv2)";

/** Verbs of collection (TR roots + EN). */
const COLLECT_VERB =
  "(?:al|alin|aliyor|alacak|alarak|iste|istiyor|isteyecek|isteyerek|talep|topla|toplayarak|sor|soruyor|sorarak|kaydet|gir|girmesini|yaz|yazmasini|soyle|soylemesini|ver|vermesini|paylas|paylasmasini|ilet|iletmesini|dogrula|teyit|ask|asks|collect|collects|request|requests|get|obtain|verify|confirm|enter|provide|share|read out)";

const NEGATION =
  /\b(asla|kesinlikle\s+\w+(?:me|ma)\b|isteme|istemez|istemiyoruz|istemeyiz|sorma|sormaz|almaz|almayiz|almiyoruz|paylasma|paylasmayin|vermeyin|never|do not|don't|dont|not|must not|yasak|yasaktir)\b/;

const COLLECTION_PATTERNS = [
  new RegExp(`${SENSITIVE_NOUN}[^.!?\\n]{0,40}?\\b${COLLECT_VERB}`, "g"),
  new RegExp(`\\b${COLLECT_VERB}\\w*\\b[^.!?\\n]{0,40}?${SENSITIVE_NOUN}`, "g"),
];

/** Finds sentences that instruct the agent to collect sensitive data. Negated sentences are ignored. */
export function findCollectionIntent(text: string): string[] {
  const hits: string[] = [];
  const sentences = normalizeTr(text).split(/(?<=[.!?\n])/);
  for (const s of sentences) {
    if (NEGATION.test(s)) continue;
    for (const re of COLLECTION_PATTERNS) {
      re.lastIndex = 0;
      const m = re.exec(s);
      if (m) {
        hits.push(m[0].trim());
        break;
      }
    }
  }
  return hits;
}

/** Real institutions commonly impersonated in TR/global phishing. A hit alone never blocks. */
const BRANDS = [
  "ziraat", "garanti", "is bankasi", "isbank", "akbank", "yapi kredi", "qnb", "finansbank", "halkbank",
  "vakifbank", "denizbank", "enpara", "papara", "ing bank", "teb", "kuveyt turk", "albaraka", "sekerbank",
  "e-devlet", "edevlet", "sgk", "gib", "gelir idaresi", "vergi dairesi", "emniyet", "polis", "jandarma", "savcilik",
  "ptt", "turkcell", "vodafone", "turk telekom", "trendyol", "hepsiburada", "amazon", "n11", "getir", "yemeksepeti",
  "paypal", "apple", "icloud", "google", "microsoft", "netflix", "spotify", "instagram", "whatsapp", "facebook", "meta",
  "yurtici kargo", "aras kargo", "mng kargo", "surat kargo", "dhl", "ups", "fedex", "visa", "mastercard", "binance",
];
const ACCOUNT_SECURITY =
  /(musteri hizmet\w*|guvenlik birim\w*|guvenlik ekib\w*|hesap dogrulama|hesabiniz\w*|hesabini\w*|dolandiricilik birim\w*|fraud|customer (?:service|support)|account (?:verification|security|suspended)|security (?:team|department)|kargo ucret\w*|gumruk ucret\w*|odul|kazandiniz|iade (?:islemi|ucret)\w*)/;

export function findBrandSuspicion(text: string): string[] {
  const n = normalizeTr(text);
  if (!ACCOUNT_SECURITY.test(n)) return [];
  return BRANDS.filter((b) => new RegExp(`(^|[^a-z])${b.replace(/[-]/g, "\\-")}([^a-z]|$)`).test(n));
}

export interface Layer1Finding {
  field: string;
  match: string;
}

export interface Layer1Result {
  decision: "block" | "pass";
  sensitiveFields: Layer1Finding[];
  collectionIntent: Layer1Finding[];
  suspicion: string[];
  reason?: string;
}

function configTexts(config: AgentConfig): [string, string][] {
  const texts: [string, string][] = [
    ["name", config.name],
    ["company.name", config.company.name],
    ["company.description", config.company.description],
    ["company.info", config.company.info],
    ["role", config.role],
    ["persona.style_notes", config.persona.style_notes],
    ["knowledge", config.knowledge],
    ["greeting", config.greeting],
  ];
  if (config.prompt_override) texts.push(["prompt_override", config.prompt_override]);
  config.actions.forEach((a, i) => {
    texts.push([`actions[${i}].description`, a.description]);
    a.params.forEach((p, j) => texts.push([`actions[${i}].params[${j}].description`, p.description]));
  });
  return texts;
}

export function runLayer1(config: AgentConfig): Layer1Result {
  const sensitiveFields: Layer1Finding[] = [];
  config.actions.forEach((a, i) => {
    if (isSensitiveIdentifier(a.name)) sensitiveFields.push({ field: `actions[${i}].name`, match: a.name });
    a.params.forEach((p, j) => {
      if (isSensitiveIdentifier(p.name)) sensitiveFields.push({ field: `actions[${i}].params[${j}].name`, match: p.name });
    });
  });

  const collectionIntent: Layer1Finding[] = [];
  for (const [field, text] of configTexts(config)) {
    if (!text) continue;
    for (const match of findCollectionIntent(text)) collectionIntent.push({ field, match });
  }

  const allText = configTexts(config)
    .map(([, t]) => t)
    .join("\n");
  const suspicion = findBrandSuspicion(allText);

  const blocked = sensitiveFields.length > 0 || collectionIntent.length > 0;
  return {
    decision: blocked ? "block" : "pass",
    sensitiveFields,
    collectionIntent,
    suspicion,
    reason: blocked ? SENSITIVE_BLOCK_MESSAGE : undefined,
  };
}

// ---------- Layer 2 ----------

export const classifierResultSchema = z.object({
  decision: z.enum(["allow", "warn", "block"]),
  categories: z.array(z.enum(GUARD_CATEGORIES)).default([]),
  reason: z.string().default(""),
});
export type ClassifierResult = z.infer<typeof classifierResultSchema>;

export const CLASSIFIER_INSTRUCTIONS = `Sen bir sesli/yazılı AI agent test ortamının içerik denetçisisin. Kullanıcılar burada demo agent'lar tanımlıyor. Görevin, bir agent tanımının GERÇEK zarar veya hukuki risk taşıyıp taşımadığına karar vermek.

İZİN VER (allow):
- Her türlü kişilik ve ton: küfürlü, argo, sert, alaycı, kaba, absürt, esprili karakterler. Bunlar için "ok_profanity_persona" kategorisini ekle ama kararı "allow" ver.
- Gerçek marka adı geçen ama aldatma amacı olmayan agent'lar (ör. bir mağazanın SSS botu, kargo takip demosu, bir ürünün tanıtım asistanı).
- Kart/şifre gibi bilgileri İSTEMEYEN, hatta istemeyeceğini söyleyen agent'lar.

ENGELLE (block):
- fraud_phishing: insanları kandırıp para, bilgi veya erişim elde etmeye yönelik senaryolar (sahte ödül, sahte kargo/gümrük ücreti, sahte hesap askıya alma, sahte yatırım).
- sensitive_data_harvest: kart numarası, CVV, son kullanma tarihi, IBAN ile ödeme alma, şifre, PIN, OTP/SMS kodu, T.C. kimlik no toplama.
- real_brand_impersonation_for_deception: gerçek bir banka, kamu kurumu veya büyük markanın yetkilisiymiş gibi davranıp kullanıcıyı aldatma.
- targeted_harassment: gerçek, adı geçen kişileri hedef alan taciz, nefret veya tehdit.
- sexual_minors: reşit olmayanları içeren her türlü cinsel içerik.
- explicit_sexual: açık cinsel içerik üretmeye yönelik agent.
- dangerous_instructions: silah, patlayıcı, uyuşturucu üretimi, zararlı yazılım gibi tehlikeli talimatlar.
- self_harm: kendine zarar vermeyi teşvik.

UYAR (warn): gerçekten belirsiz, insan incelemesi gereken durumlar. Emin değilsen ve zarar olasılığı düşükse "allow" ver. Yanlış pozitif (zararsız agent'ı engellemek) de bir hatadır.

Sadece şu JSON'u döndür, başka hiçbir şey yazma:
{"decision":"allow|warn|block","categories":["..."],"reason":"kısa Türkçe gerekçe"}`;

export function buildClassifierInput(config: AgentConfig, layer1: Layer1Result): string {
  const payload = {
    name: config.name,
    company: config.company,
    role: config.role,
    persona: config.persona,
    knowledge: config.knowledge.slice(0, 6000),
    greeting: config.greeting,
    actions: config.actions.map((a) => ({
      name: a.name,
      description: a.description,
      params: a.params.map((p) => `${p.name}: ${p.description}`),
    })),
    prompt_override: config.prompt_override?.slice(0, 4000),
  };
  const hint = layer1.suspicion.length
    ? `\n\nÖn kontrol notu: Metinde gerçek kurum/marka adı (${layer1.suspicion.join(", ")}) ile müşteri hizmetleri/güvenlik/hesap kalıbı birlikte geçiyor. Bu tek başına engel sebebi değildir; aldatma amacı olup olmadığına bak.`
    : "";
  return `Agent tanımı:\n${JSON.stringify(payload, null, 2)}${hint}`;
}

export function parseClassifierOutput(raw: string): ClassifierResult | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed = classifierResultSchema.safeParse(JSON.parse(m[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------- Combined ----------

export interface GuardVerdict {
  decision: GuardDecision;
  categories: GuardCategory[];
  reason: string;
  layer: 1 | 2;
  contentWarning: boolean;
  layer1: Layer1Result;
}

export class GuardUnavailableError extends Error {
  constructor(message = "Güvenlik kontrolü şu an yapılamadı. Lütfen tekrar deneyin.") {
    super(message);
  }
}

/**
 * Runs Layer 1, then Layer 2 via the injected classifier.
 * If the classifier fails or returns garbage, throws GuardUnavailableError: the caller must NOT save.
 */
export async function runTaskGuard(
  config: AgentConfig,
  classify: ((instructions: string, input: string) => Promise<string>) | null,
): Promise<GuardVerdict> {
  const layer1 = runLayer1(config);
  if (layer1.decision === "block") {
    return {
      decision: "block",
      categories: ["sensitive_data_harvest"],
      reason: layer1.reason!,
      layer: 1,
      contentWarning: false,
      layer1,
    };
  }
  if (!classify) throw new GuardUnavailableError("Güvenlik sınıflandırıcısı yapılandırılmamış.");
  let raw: string;
  try {
    raw = await classify(CLASSIFIER_INSTRUCTIONS, buildClassifierInput(config, layer1));
  } catch (e) {
    throw new GuardUnavailableError();
  }
  const result = parseClassifierOutput(raw);
  if (!result) throw new GuardUnavailableError();
  const contentWarning = result.categories.includes("ok_profanity_persona");
  return {
    decision: result.decision,
    categories: result.categories,
    reason: result.reason,
    layer: 2,
    contentWarning,
    layer1,
  };
}
