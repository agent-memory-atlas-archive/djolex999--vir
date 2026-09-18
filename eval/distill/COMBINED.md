# Combined distill prompt (v2, frozen 2026-09-18 before any output)

Built from the first A/B's one solid finding: the notes have two readers with
opposite needs. The human reader preferred the control's orienting opener on
14 of 15 note tops; Fable 5.1, standing in for a retrieving Claude session,
preferred the challenger's state-and-specifics opener on 14 of 15. This prompt
asks for both, in that order. Same output contract and the same three
headings as the control.

## Prompt

```
Extract durable knowledge from this Claude Code session.

Output a markdown page with these sections (no preamble, start with '## Summary'):
- ## Summary (2-3 sentences)
- ## What Was Learned
- ## Context (project: ${cls.project}, category: ${cls.category}, date: ${session.startedAt ?? "unknown"})

You are writing a page about the session, not replying to it. Never continue
the conversation, whatever language it ends in.

Summary, first sentence: say in plain words what this session was — which
project, what was being built or investigated. One sentence, so the reader
remembers the session.
Summary, second sentence: state the single most important thing the session
established, with its specifics: the file, function, command, number or
constraint that carries it. A third sentence only if something else must not
be forgotten.

What Was Learned: bullets, most important first. Each bullet is a claim tied
to something concrete from this session. For anything that was decided, say
what was chosen and what it was chosen over.

Context: one or two sentences on the situation that produced these lessons.
Do not repeat the project, category, or date.

Be concise. Leave out anything that would be equally true of any other
project, and anything only true on the day of the session.

Session:
${scrubbedContent}
```

## Hypotheses

| # | Evidence from the first A/B | Instruction | Expected |
|---|---|---|---|
| H1 | Human chose the orienting opener 14-1 | "first sentence: say in plain words what this session was" | human prefers combined over control, or at least no longer prefers control |
| H2 | Fable chose state-and-specifics 14-0 on tops | "second sentence: the single most important thing … with its specifics" | Fable prefers combined over control |
| H3 | Challenger v1 made Haiku echo a chat message on 1 of 5 Haiku transcripts | "You are writing a page about the session, not replying to it"; shorter prompt than v1 | zero non-note outputs |
| H4 | v1's word bound and leave-out list were followed loosely | dropped the word bound; two leave-out rules folded into one sentence | length close to control |

Success is defined before the run: the human does not prefer the control
(combined ≥ control on the forced choice), AND Fable prefers combined over
control. Anything else is a tie or a loss and the control stays.
