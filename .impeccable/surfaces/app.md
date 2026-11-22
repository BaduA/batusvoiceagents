# Surface brief: Voice Agent Playground app (workbench, call, shared link, welcome)

Scope: apps/web (all routes). Mode: Operate (the visitor completes a task: build an agent, call it, read the numbers). The shared link `/a/:slug` is the same Operate surface with the builder hidden.

Audience and job: the freelancer and employers/clients (newcomers too) define an agent and call it; clients open shared links on phone and desktop equally. Success: a talkable agent in under two minutes and per-turn latency/cost legible without explanation. Must stay untouched: voice-only conversation, consent before mic, all existing functions. Would feel wrong: an AI-orb dashboard, a costume of any device, invented claims.

## Direction contract

THESIS: A voice agent turn is a journey through stations (end of speech, LLM, TTS); this app draws every turn as a metro route. It refuses the dark AI-orb dashboard and the device costume of the previous version.

OWN-WORLD: Istanbul transit signage. White ground, slate-navy signboard top bar (#14243A) with white Overpass. Line colours carry roles only: STT green #009A44, LLM magenta #E5007E, TTS sky #00A0DF, Realtime purple #7B2D86, end-of-speech grey. Square line badges with rounded corners, thick 4px line segments, circular stations with white cores. Overpass for UI, Overpass Mono for milliseconds, cost and time.

STORY: The visitor sees the agent and one big start-call button, talks, watches each reply arrive with its route drawn underneath, then reads the average first-audio time and cost in the side panel and tries another route (model combination).

FIRST VIEWPORT: Navy top bar (route mark, agent name + save state, Share, Save). Left nav (Call, then Definition items, each with its line badge style marker). Centre: agent name and status, transcript with route strips under agent replies, start/end controls bottom centre. Right: stats, "Route" model picker drawn as a vertical line through three stations, request log.

FORM: Standard product shell (top bar + side nav + inspector), position 1 of the ordered list (transit wayfinding), seed: none (unavailable). Disclosure: the roll was skipped, not run; concept-seed never executed because the impeccable launcher binary was not permitted to run in this environment. The seven candidates were derived by hand and the directions (Hat, Amblem, category standard) were put to the user through the structured question tool; the user chose Hat.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
