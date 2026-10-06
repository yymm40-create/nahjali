@AGENTS.md

# What Claude knows about JAWAD AI

Every Claude API call on the site starts with `config/jawad/knowledge.ts` (see `siteSystem` in `src/lib/film/anthropic.ts`). When you add or change a section, step, generator, study output or editor feature, update that text in the same change; `tests/jawad/knowledge.test.ts` fails when a section, generator or study output is missing from it.
