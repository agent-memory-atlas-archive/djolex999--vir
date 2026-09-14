# Challenger distill prompt (v1.1, frozen 2026-09-15)

Same output contract as the control: marker-less markdown body, the same three
headings in the same order, no title, no `## Related`, no structured fields.
The headings are kept identical on purpose: a different layout would let a
grader identify the arm. Only the instructions under the headings change.

## Prompt

```
Extract durable knowledge from this Claude Code session.

Output a markdown page with these sections (no preamble, start with '## Summary'):
- ## Summary (2-3 sentences)
- ## What Was Learned
- ## Context (project: ${cls.project}, category: ${cls.category}, date: ${session.startedAt ?? "unknown"})

Hard limit: the whole page is under 400 words. Cut bullets before cutting
precision.

This page will be read a month from now, without the transcript, by the person
who ran the session. Write for that reader.

Summary: state the single most important thing this session established, as a
claim about this codebase. Do not begin with what the session did; do not list
deliverables.

What Was Learned: bullets, most important first. Each bullet is one claim that
could turn out to be wrong, tied to something concrete from this session: a
file, function, command, error, number, or constraint. For anything that was
decided, say what was chosen, what it was chosen over, and what would make you
reverse it.

Context: one or two sentences on the situation that produced these lessons.
Do not repeat the project, category, or date; they are already recorded.

Leave out:
- anything that would be equally true of any other project
- the sequence of events (what was asked, what was run, what failed first)
- test counts, release checklists, deploy status, unpushed work, or anything
  only true on the day of the session
- messages to the user, next steps, and follow-ups

Session:
${scrubbedContent}
```

## Hypotheses

Each maps a failure mode from the Phase 2 reading (F1-F8, recorded with
excerpts in `~/.vir/eval/distill/failure-modes.md`) to an instruction and an
expected rubric effect.

| # | Current notes do | Instruction | Expected |
|---|---|---|---|
| H1 | Summary narrates the session (F1) | "state the single most important thing … as a claim … Not what was done" | D1 and D5 up |
| H2 | Titled lesson buried in a flat grab-bag (F2) | "most important first", one claim per bullet | D1 up; fewer bullets |
| H3 | Decision notes record no alternative (F3) | "what was chosen, what it was chosen over, and what would make you reverse it" | D2 up on decision notes |
| H4 | Generic maxims (F5) | "tied to something concrete"; "leave out anything equally true of any other project" | D3 and D4 up |
| H5 | Status snapshots and handoff text (F6, F7) | the "leave out" list | D5 up; length down |
| H6 | Context echoes frontmatter or dumps chronology (F4) | "one or two sentences on the situation"; "Do not repeat the project, category, or date" | D5 up; no cap truncation |
| H7 | Length set by the cap (F8) | "Hard limit: … under 400 words" placed before the section instructions | zero cap hits |
| H8 | Assistant voice (F7) | "read a month from now … by the person who ran the session" | D5 up |

Risks stated up front:
- H7 may cost D4: fewer words can mean fewer checkable claims. That trade is
  the point of the test, not something to tune away.
- Style differences between arms are visible to a grader even with labels
  hidden. Blinding hides which arm is which, not that they differ.
- The control might win. A tie closes the roadmap item.

## v1.1 changes (Gate 2, before any run)

The Gate 2 preview showed two instructions the model did not follow: the
trailing word bound (347 and 507 words on a 400 bound) and the summary
opener ("This session was…"). v1.1 moves the bound to the top as a hard
limit and adds "Do not begin with what the session did". Frozen after this
commit; no edits during or after the run.
