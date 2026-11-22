# Design plan v3: "the field recorder" (frontend-design skill)

History: v1 (flat panels) was "too flat, too panel-like"; v2 (macOS clone: blurred sidebar, coloured icon squares, grey grouped lists, green round call button) was "still AI slop". The lesson: v2 borrowed someone else's identity wholesale. v3 takes its identity from the subject.

**Subject:** you pick up a device, talk to an agent, and read the numbers. That is what a field recorder / handheld radio does. The product is an **instrument**, not a dashboard.
**Audience:** the freelancer tuning an agent, and the client who receives a link and just presses "talk".
**Primary job:** press and talk; then read latency and cost off the display.

## Tokens

| Name | Light | Dark | Role |
|---|---|---|---|
| Body | `#D7D9D5` | `#2B2D2A` | Anodised aluminium; the page itself is the device chassis |
| Plate | `#E6E8E4` | `#353733` | Raised module plates |
| Well | `#C9CCC7` | `#20221F` | Recessed areas: inputs, key wells |
| Engrave | `#2E322D` | `#E2E5DF` | Text, "engraved" labels |
| Faint | `#6C716A` | `#9AA096` | Secondary labels |
| LCD | `#B9C29A` → `#A9B387` | `#8F9B6C` → `#7F8B5C` | Reflective LCD glass (olive-yellow, not a black screen) |
| LCD ink | `#28301F` | same | Segments and transcript text on the LCD |
| Signal | `#FF4F1A` | `#FF5D2B` | The one colour: the talk key, the record dot, the LLM latency segment |

Explicitly not: cream + serif, black + neon, cards with one soft shadow.

**Type:**
- **Archivo** (variable width): UI text at 100 width; agent names and headings at 112–125 width, so they read like stamped product names.
- **Doto** (dot matrix): only for numbers and status on the LCD (timer, milliseconds, cost), where a segment display is the real vernacular.
- Labels are **lowercase** like engraved hardware legends ("stt", "llm", "ses", "kaydet"), never all caps. Sentence case everywhere else.

## Layout

The whole viewport is the chassis. Modules sit on it with screws-free plates, separated by milled grooves (a 1px shade line + 1px highlight line), not by shadows.

```
┌ chassis ───────────────────────────────────────────────────────────────┐
│ ◖vap  resepsiyonist ─ makas saç            [kaydet] [paylaş]            │
│ ┌ keys ┐ ┌──────── LCD ─────────────────────────┐ ┌ rack ───────────┐ │
│ │görüşme│ │ RESEPSIYONIST            ● 02:41    │ │ stt  deepgram ▾ │ │
│ │görev  │ │ ▮▮▮▮▮▮▯▯▯▯ level                     │ │ llm  gpt mini ▾ │ │
│ │kişilik│ │ > agent: Merhaba, hoş geldiniz…     │ │ tts  cartesia ▾ │ │
│ │bilgi  │ │ < siz:   yarın 3'e yer var mı?      │ │ ses  marin    › │ │
│ │işlem  │ │   ▏820ms▕ eou 310 llm 280 tts 230   │ │ ─────────────── │ │
│ │modeller│└──────────────────────────────────────┘ │ ilk ses  820 ms │ │
│ │gelişmiş│     (( TALK ))   [sessiz]  [bitir]     │ maliyet  $0.012 │ │
│ └───────┘                                        └─────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

- Left: a column of **physical keys** (raised; pressed = sunk into the well).
- Centre: the **LCD** is the call screen. The transcript is printed on it in LCD ink; numbers are in dot matrix; a segmented level meter replaces the needle dial.
- Below the LCD: one large round **Signal-orange talk key** with a raised rim. It's the only saturated thing on the screen.
- Right: the **rack**: model selection as rows of recessed selectors, and the readouts.
- Definition sections replace the LCD area with a "paper insert": a plate with recessed fields.
- Welcome page: the device, powered off, with the template list as its preset buttons.
- Phone: the keys become a horizontal key strip; the rack drops below the talk key.

## The one bold thing

**The reflective LCD.** An olive glass panel with a faint pixel grid, dark ink, dot-matrix numerals and a segmented level meter driven by the agent's voice. It is immediately "a device" and nothing like a chat app or a dashboard. Everything around it is quiet aluminium.

## Review against generic defaults

- v2's coloured icon squares, blurred sidebar and macOS grouped lists → removed; navigation is engraved keys.
- Green/red round phone buttons → one orange talk key; "end" is a plain engraved key.
- Mono for small labels → mono-like type only on the LCD where it is the real display vernacular.
- Shadows → bevels only on keys (1px highlight top, 1px shade bottom); plates are separated by grooves.
- Gradients → only inside the LCD glass, because real LCD glass has one.
