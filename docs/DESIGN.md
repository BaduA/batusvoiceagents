# Design plan v2: "native app" (frontend-design skill)

v1 (light desk + flat panels) was rejected by the client as "too flat, too panel-like". The brief for v2: **feel like a native app**, same features.

**Subject:** a voice test bench. A freelancer defines an agent for a prospective client, calls it, reads what happened, sends a link.
**Audience:** the builder (wants control and numbers) and the client opening a shared link (wants to talk to "their" agent).
**Primary job:** call the agent. Everything else (definition, metrics) supports the call.

## Direction

Borrow the vernacular of macOS/iOS apps people already trust, instead of web-dashboard chrome:
- A **window** with a translucent sidebar (vibrancy), a unified toolbar and a content area. Not three equal boxes.
- Definition as **inset grouped lists** (System Settings): rounded groups, rows with the label on the left and the control on the right, hairline separators *inside* groups, footnotes under groups.
- The call screen borrows from **FaceTime/Phone**: large centred subject, round green "call" and red "end" buttons, live captions as message bubbles.
- An **inspector** (right sidebar, like Xcode/Keynote) for metrics, model choice and the request log.
- A **welcome window** (Xcode / Final Cut "Welcome") instead of a landing page.
- Light and dark appearance follow the system.

## Tokens

| Name | Light | Dark | Role |
|---|---|---|---|
| Window | `#ECECEF` | `#1C1C1E` | Behind everything |
| Sidebar | `rgba(232,232,237,.72)` + blur | `rgba(44,44,46,.72)` + blur | Vibrancy material |
| Surface | `#FFFFFF` | `#2C2C2E` | Grouped rows, content |
| Label | `#1D1D1F` | `#F5F5F7` | Primary text |
| Secondary | `#6E6E73` | `#98989D` | Secondary text |
| Separator | `rgba(60,60,67,.14)` | `rgba(84,84,88,.6)` | Hairlines inside groups |
| Needle | `#F0A020` | `#FFB340` | The one brand accent: the VU needle, LLM segment, selection |
| Call / End | `#30B158` / `#FF3B30` | same | Phone vernacular |

**Type:** the platform's own UI face (SF Pro on Apple, Segoe UI Variable on Windows, Roboto on Android) with Schibsted Grotesk as the web fallback; the system face *is* the deliberate choice for a "native" brief. Sizes follow Apple's text styles: large title 26/32 bold, title 17 semibold, body 15, footnote 13, caption 12. Monospace (SF Mono / Plex Mono) only for JSON and numbers in the inspector.

## Layout

```
┌──────────────── window ────────────────────────────────────────────────┐
│ ● ● ●  sidebar (blur)  │ toolbar: Resepsiyonist ▸ Görüşme   [Paylaş][Kaydet]│
│ ◉ Görüşme              │                                   │ Inspector    │
│ ─ Tanım                │        ╭──── VU dial ────╮        │ Son görüşme  │
│   Görev                │        │   needle swings │        │ 820 ms  1:42 │
│   Kişilik              │        ╰─────────────────╯        │ Modeller     │
│   Bilgi                │       Resepsiyonist · Dinliyor    │ İstek logu   │
│   İşlemler             │  [bubble: agent]                  │              │
│   Modeller             │                  [bubble: you]    │              │
│   Gelişmiş             │        ( ● )  mute   ( ✕ )        │              │
└────────────────────────────────────────────────────────────────────────┘
```

Phone: sidebar becomes a scrollable pill bar under a compact toolbar; the inspector moves below the call.

## The one bold thing

**The VU dial.** A round meter on the call screen whose needle swings with the agent's voice level in real time (and a soft inner ring that follows *your* mic level). It is the product's mark come alive and replaces the generic glowing "AI orb". The needle colour says who is talking: amber when the agent speaks, green when it listens to you. Everything else stays quiet and system-like.

## Review against generic defaults

- Glowing gradient orb for voice → rejected (every voice demo uses it); replaced by the VU dial tied to the brand mark.
- Three equal rounded panels (v1) → a window with sidebar + content + inspector, different materials for each.
- SaaS card kit (same radius + same shadow everywhere) → radius hierarchy: window 12, groups 10, controls 7, buttons round; shadows only on the window and floating call controls.
- Middle-dot meta strings in chrome → used only where Apple itself does (subtitle under the agent name), nowhere else.
- All-caps eyebrows → group headers are sentence case footnote-size text, as in System Settings.
