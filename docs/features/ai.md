# Feature: AI

AI-assisted productivity: board summaries and idea generation. **Scaffolded, not production-wired.**

## What it does (intended)

- `POST /ai/boards/:boardId/summarize` — summarize a board's tasks.
- `POST /ai/ideas` — generate N ideas from a topic (`topic`, `count`).

## Current implementation

- `AiProvider` interface with two implementations in `modules/ai/providers`:
  - `GeminiAiProvider` — calls the Gemini API; on failure falls back to `MockAiProvider`.
  - `MockAiProvider` — deterministic canned responses for offline dev/test.
- `AiService.summarizeBoard` validates the board exists, then feeds **hardcoded sample tasks** to the provider — it does not yet read real tasks from the database. `generateIdeas(topic, count)` delegates straight to the provider.

## Status / decision

**Skipped by product decision (2026-08-11): AI wiring is being skipped until after launch.** The endpoints and provider seam remain; wiring `summarize` to real board tasks would be the first step when picked up. The web UI may surface AI entry points, but behavior is placeholder/mock until then.

## Tables

No AI-specific tables; consumes boards + tasks.