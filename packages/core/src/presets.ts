import type { AgentAction, AgentConfigInput } from "./schema";

/**
 * Templates pre-fill the builder form. They contain structure and *action definitions* only —
 * no business data. The user fills company, knowledge, prices etc.
 */
export interface Preset {
  id: string;
  label: string;
  summary: string;
  config: AgentConfigInput;
}

const p = (
  name: string,
  type: AgentAction["params"][number]["type"],
  description: string,
  required = true,
  enumValues?: string[],
): AgentAction["params"][number] => ({ name, type, description, required, ...(enumValues ? { enum: enumValues } : {}) });

export const PRESETS: Preset[] = [
  {
    id: "receptionist",
    label: "Resepsiyonist",
    summary: "Gelen müşteriyi karşılar, uygunluk sorar, randevu açar ve iptal eder.",
    config: {
      name: "Resepsiyonist",
      role:
        "Müşterileri karşıla, sorularını bilgi tabanına göre yanıtla, uygun saatleri kontrol et ve randevu oluştur veya iptal et. Fiyat ve hizmet bilgisi dışında söz verme.",
      persona: { tone: "samimi", language: "tr", style_notes: "Kısa ve sıcak cümleler kur. Müşteriye adıyla hitap et." },
      greeting: "Merhaba, hoş geldiniz! Size nasıl yardımcı olabilirim?",
      actions: [
        {
          name: "check_availability",
          description: "Belirli bir hizmet ve tarih için uygun saatleri kontrol eder",
          params: [p("service", "string", "İstenen hizmet"), p("date", "date", "İstenen gün (YYYY-AA-GG)")],
          requires_confirmation: false,
          response_mode: "simulate",
        },
        {
          name: "create_booking",
          description: "Müşteri onay verdiğinde randevu oluşturur",
          params: [
            p("customer_name", "string", "Müşterinin adı soyadı"),
            p("phone", "string", "İletişim telefonu"),
            p("service", "string", "Hizmet"),
            p("datetime", "datetime", "Randevu tarihi ve saati (ISO 8601)"),
          ],
          requires_confirmation: true,
          response_mode: "simulate",
        },
        {
          name: "cancel_booking",
          description: "Var olan bir randevuyu iptal eder",
          params: [p("booking_id", "string", "Randevu numarası")],
          requires_confirmation: true,
          response_mode: "simulate",
        },
      ],
    },
  },
  {
    id: "support",
    label: "Müşteri hizmetleri",
    summary: "Sipariş durumunu sorgular, destek talebi açar, gerekirse insana aktarır.",
    config: {
      name: "Müşteri Hizmetleri Asistanı",
      role:
        "Müşterinin sorununu anla, sipariş durumunu sorgula, çözemediğin konularda destek talebi aç. Müşteri ısrarla insan isterse temsilciye aktar.",
      persona: { tone: "resmi ama sıcak", language: "tr", style_notes: "Sakin kal, özür dilemeyi abartma, çözüm odaklı ol." },
      greeting: "Merhaba, müşteri hizmetlerine hoş geldiniz. Size nasıl yardımcı olabilirim?",
      actions: [
        {
          name: "get_order_status",
          description: "Sipariş numarasıyla siparişin kargo ve teslimat durumunu getirir",
          params: [p("order_id", "string", "Sipariş numarası")],
          requires_confirmation: false,
          response_mode: "simulate",
        },
        {
          name: "open_support_ticket",
          description: "Çözülemeyen sorunlar için destek talebi açar",
          params: [
            p("customer_name", "string", "Müşteri adı"),
            p("topic", "enum", "Konu", true, ["iade", "hasarlı ürün", "gecikme", "fatura", "diğer"]),
            p("summary", "string", "Sorunun kısa özeti"),
          ],
          requires_confirmation: true,
          response_mode: "simulate",
        },
        {
          name: "transfer_to_human",
          description: "Görüşmeyi canlı temsilciye aktarır",
          params: [p("reason", "string", "Aktarma nedeni")],
          requires_confirmation: false,
          response_mode: "static",
          static_response: { status: "queued", estimated_wait_minutes: 3 },
        },
      ],
    },
  },
  {
    id: "appointment",
    label: "Randevu asistanı",
    summary: "Klinik, danışmanlık gibi işler için randevu planlar ve hatırlatma kurar.",
    config: {
      name: "Randevu Asistanı",
      role: "Kullanıcının uygun olduğu zamanı öğren, uzmanın takvimine göre randevu planla, gerekirse randevuyu değiştir.",
      persona: { tone: "düzenli ve net", language: "tr", style_notes: "Tarih ve saatleri her zaman tekrar ederek teyit et." },
      greeting: "Merhaba, randevu planlamak için buradayım. Hangi gün size uygun?",
      actions: [
        {
          name: "find_slots",
          description: "Tarih aralığında boş randevu saatlerini listeler",
          params: [p("from_date", "date", "Başlangıç günü"), p("to_date", "date", "Bitiş günü", false)],
          requires_confirmation: false,
          response_mode: "simulate",
        },
        {
          name: "book_appointment",
          description: "Seçilen saate randevu oluşturur",
          params: [
            p("full_name", "string", "Ad soyad"),
            p("phone", "string", "Telefon"),
            p("datetime", "datetime", "Randevu zamanı"),
            p("note", "string", "Not", false),
          ],
          requires_confirmation: true,
          response_mode: "simulate",
        },
        {
          name: "reschedule_appointment",
          description: "Var olan randevunun saatini değiştirir",
          params: [p("appointment_id", "string", "Randevu numarası"), p("new_datetime", "datetime", "Yeni zaman")],
          requires_confirmation: true,
          response_mode: "simulate",
        },
      ],
    },
  },
  {
    id: "sales",
    label: "Satış ön görüşme",
    summary: "İhtiyacı anlar, uygunluğu değerlendirir, potansiyel müşteriyi kaydeder.",
    config: {
      name: "Satış Ön Görüşme Asistanı",
      role:
        "Potansiyel müşterinin ihtiyacını, bütçesini ve zaman planını öğren. Uygunsa bilgilerini kaydet ve satış ekibiyle görüşme ayarla. Zorla satış yapma.",
      persona: { tone: "enerjik ve meraklı", language: "tr", style_notes: "Her seferinde tek soru sor." },
      greeting: "Merhaba! Neye ihtiyacınız olduğunu birkaç soruyla anlayıp sizi doğru kişiye yönlendireyim.",
      actions: [
        {
          name: "save_lead",
          description: "Potansiyel müşteriyi kaydeder",
          params: [
            p("full_name", "string", "Ad soyad"),
            p("company", "string", "Şirket", false),
            p("email", "string", "E-posta"),
            p("need", "string", "İhtiyaç özeti"),
            p("budget_range", "string", "Bütçe aralığı", false),
          ],
          requires_confirmation: true,
          response_mode: "simulate",
        },
        {
          name: "schedule_call",
          description: "Satış ekibiyle görüşme ayarlar",
          params: [p("lead_email", "string", "Müşterinin e-postası"), p("datetime", "datetime", "Görüşme zamanı")],
          requires_confirmation: true,
          response_mode: "simulate",
        },
      ],
    },
  },
  {
    id: "blank",
    label: "Serbest",
    summary: "Boş form. Görevi ve kişiliği sıfırdan tanımlayın.",
    config: {
      name: "Yeni agent",
      role: "",
      persona: { tone: "samimi", language: "tr", style_notes: "" },
      greeting: "",
      actions: [],
    },
  },
];

export function getPreset(id: string) {
  return PRESETS.find((x) => x.id === id);
}
