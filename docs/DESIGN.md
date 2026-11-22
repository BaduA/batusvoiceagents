# Design plan (frontend-design skill)

**Subject:** a test bench where a freelancer defines a text/voice agent for a prospective client, tries it with different models, and sends the client a link.
**Audience:** (1) the builder — technical, wants control and numbers; (2) the client opening a shared link — non-technical, wants to talk to "their" agent and see that it works.
**Primary job:** define → talk → see what happened (latency, cost, the requests the agent would have sent).

## Tokens

| Name | Hex | Role |
|---|---|---|
| Desk | `#E7ECF0` | App background — cool console grey, not cream |
| Sheet | `#FAFBFC` | Panels where the user types |
| Ink | `#1D2935` | Text, primary strokes (deep slate, not tinted near-black) |
| Graphite | `#5B6875` | Secondary text, hints |
| Needle | `#F0A020` | The one accent: VU-meter amber. Live/listening state, primary action fill (ink text on top) |
| Console | `#1F2B37` | Request log surface — the "machine side" of the screen |
| Pass | `#13795B` / Fault `#C23B2E` | 200 OK / error, validation warnings |

**Type:** Schibsted Grotesk (UI + headings, one family, weights 400/500/700; good Turkish coverage). IBM Plex Mono only for real machine content: JSON, action names, ms values in the log. Sentence case everywhere, no all-caps eyebrows.

**Radius hierarchy:** inputs 6px, panels 10px, chips/pills full. Shadows: none on panels (separated by the desk colour), one soft shadow on the floating composer.

## Layout

Workbench (`/agents/new`, `/agents/:id`):

```
+------------------+-------------------------------+-------------------+
| Definition       | Conversation                  | Requests (dark)   |
| [Task][Persona]  |  agent turn                   |  11:42 POST ...   |
| [Knowledge]...   |  ▕▇▇▇▇▇░░░░░░▏ 820 ms         |  { json }         |
|                  |  user turn                    |-------------------|
| [Save and test]  |  [ composer ............ (mic)]| Metrics           |
+------------------+-------------------------------+-------------------+
```

Phone: one column with a three-way switch (Definition / Conversation / Requests).

Landing: no marketing hero. Title + one sentence, then the template list as rows (each row shows the actions it pre-fills, because that is what differs between templates), then demo agents and "your agents".

Shared link (`/a/:slug`): conversation first; a short "what this agent does" summary instead of the editor; content-warning and "Report" in the header.

## Principles

1. **The memorable thing is the latency strip** under every agent turn: a thin bar split by layer (STT · LLM first token · TTS) drawn to scale, with the number. Everything else stays quiet.
2. The request log looks like a machine wrote it — dark console, mono, status dot — because it represents a backend call that did not happen.
3. Structure means something: numbers only on real sequences, borders only between distinct zones.
4. Motion only answers the user: the needle pulse while listening, a log row sliding in when an action fires.

## Review against generic defaults

- Three-pane playground is the conventional layout; kept because it matches the job (define / talk / inspect) — distinctiveness comes from palette, latency strip and console log instead.
- Rejected: identical rounded template cards with soft shadows (SaaS-card kit) → rows with action chips.
- Rejected: near-black UI with one neon accent → light desk, dark only where it carries meaning (log).
- Rejected: "→" on buttons, middle-dot meta strings in UI chrome, mono for small labels.
