@AGENTS.md

# What Claude knows about JAWAD AI

No Claude API call sends `config/jawad/knowledge.ts` whole any more: every call starts with its short version (`config/jawad/knowledge-brief.ts` — the robot's own section in full, the rest in brief; see `siteSystem` in `src/lib/film/anthropic.ts`), and what a message asks about is looked up in the whole text and added to that message (`addSiteLookup`). The whole text is still the source of all of it. When you add or change a section, step, generator, study output or editor feature, update that text in the same change; `tests/jawad/knowledge.test.ts` fails when a section, generator or study output is missing from it.
