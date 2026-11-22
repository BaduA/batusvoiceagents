# Design history

The current UI is v5 below. Tokens live in `apps/web/src/app/globals.css`. Product truth lives in [`/PRODUCT.md`](../PRODUCT.md); the direction contract for the app surface is in `.impeccable/surfaces/app.md`.

How we got here:

1. **v1, flat panels** (Anthropic `frontend-design` skill): light desk, three equal panels, amber accent. Rejected as "too flat, too panel-like".
2. **v2, macOS clone**: blurred sidebar, coloured icon squares, grouped lists, green/red phone buttons, VU needle dial. Rejected as still "AI slop": it borrowed another product's identity wholesale.
3. **v3, field recorder**: aluminium chassis, olive LCD, hardware keys. Not shipped to the user as final; per Impeccable's Operate rules, a world taken from an instrument the user operates becomes a costume of that tool on a working screen.
4. **v4, "Hat" (current)**: built with the [Impeccable](https://github.com/pbakaus/impeccable) skill (Apache 2.0, vendored in `.claude/skills/impeccable`). Flow: `init` → PRODUCT.md interview, `new-work` → seven candidates from the audience's world, user chose Istanbul transit wayfinding; Operate mode keeps standard controls and lets the world lend only type, palette, density and one signature move: every agent turn drawn as a metro route (sustun → STT → LLM → TTS, to scale). Replaced by v5.
5. **v5, talk-first (current)**: the user rejected Hat ("still ugly") and asked for a home screen that is only the conversation, with settings hidden behind a button and the per-minute total of the chosen models. Instead of designing another look in-house, the UI now adopts LiveKit's official [Agent Starter React](https://github.com/livekit-examples/agent-starter-react) (MIT, licence in `apps/web/src/components/agents-ui/`): its Aura shader visualizer, shadcn-style tokens (`#002cf2` / `#1fd5f9`), Public Sans + Commit Mono, pill buttons and floating control bar. Our additions: a closed-by-default settings sheet (models with prices, voice picker, agent definition, sharing) headed by a live `$/dk` estimate (`estimatePerMinute` in `@vap/core`), and per-reply latency captions (STT / LLM / TTS) under the agent's words.
