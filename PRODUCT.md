# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **The freelancer (owner):** a full-stack developer moving into AI agents and automations. Defines an agent for a prospective client's task, calls it, compares model combinations, reads latency and cost, then sends a link with the proposal.
- **Employers / clients:** receive that link and talk to "their" agent; they will also build and edit agents themselves, so the builder must be understandable for someone new to voice agents (confirmed in interview).
- Shared links are opened on phones and desktops about equally (confirmed in interview).

## Product Purpose

Define any company's voice agent (task, persona, knowledge, actions), pick the speech-to-text, language and text-to-speech models (or a realtime speech-to-speech model), and test it by talking. Success: a working, talkable demo in under two minutes, with numbers that prove quality: per-turn latency by layer, estimated cost, and the requests the agent would have sent.

## Positioning

"Don't say you can build it; send a link they can talk to." A single playground that is not tied to one business or provider: the same agent can be re-run on different model combinations and compared, and every action the agent triggers is simulated and logged instead of hitting a real system.

## Operating Context

- Voice only: there is no text input in a conversation; the screen shows the live transcript and measurements.
- Calls are short (max 3 minutes), rate-limited per IP, and require consent before the microphone opens.
- The freelancer works on desktop while preparing proposals; clients open links from proposals or messages.
- Turkish first, multilingual.

## Capabilities and Constraints

- Builder sections: task, persona, knowledge, actions, models, advanced (generated prompt and raw JSON).
- Models: 2 STT, 4 LLM, 3 TTS with voice libraries and previews, 2 realtime models.
- Safety: Task Guard blocks phishing/data-harvesting agents; profane personas are allowed with a content warning; shared links can be reported.
- Not yet built (must not be shown as working): action editor and simulator, request log entries, comparison table.

## Brand Commitments

- Product name stays **Voice Agent Playground** (confirmed in interview). No separate personal brand.
- No voice cloning; only providers' stock voices.

## Evidence on Hand

- Four seeded demo agents in `apps/web/seeds/demo-agents.json` (salon receptionist, outdoor-shop support, a profane tax advisor character, a tough sales coach), all labelled as examples.
- No real customers, testimonials or benchmarks exist; none may be invented.

## Product Principles

1. The call is the product; everything else supports getting to a good call faster.
2. Numbers over adjectives: show latency and cost per turn rather than claiming "fast" or "cheap".
3. A newcomer must be able to build an agent without knowing what STT or TTS means; experts must still see every knob.
4. Nothing pretends: simulated actions say they are simulated, unconfigured models say so.

## Accessibility & Inclusion

Microphone-first product: every state must also be readable on screen (agent state, time left, errors). No product-specific standard was set; WCAG AA is assumed (inferred, not confirmed).
