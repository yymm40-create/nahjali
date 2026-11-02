@AGENTS.md

# What Claude knows about JAWAD AI

Every robot — the owner's conversations included — reads only the short brief in `config/jawad/brief.ts` plus its own training, like a plain Claude conversation (the owner, 2 November 2026 — see `siteSystem` in `src/lib/film/anthropic.ts`); `config/jawad/knowledge.ts` is the platform's full written description, kept current but sent to no robot. When you add or change a section, step, generator, study output or editor feature, update knowledge.ts in the same change (and brief.ts when a section is added); `tests/jawad/knowledge.test.ts` fails when a section, generator or study output is missing from it. Per-message facts go in `callClaudeJson`'s `turnNote`, never in `system`, so the system and the conversation stay cached.
