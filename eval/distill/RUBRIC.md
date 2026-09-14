# Distill note rubric (v1)

Written before any challenger prompt existed. Grades one note body at a time.
Every grade record carries the SHA-256 of this file.

A note exists for two readers: Djole a month later, and a future Claude Code
session that retrieved it. Each dimension is scored 0, 1 or 2. Grade the body
only. The title and frontmatter come from the classify step and are identical
across arms. A note cut off mid-sentence is graded as it reads; the cap hit is
recorded separately by the runner.

## D1. Decision recorded

Does the note state what was decided, not what happened?

- 0: No decision is stated, or the note only describes events and code.
- 1: A decision is implied or buried inside narrative; you have to infer it.
- 2: The decision is stated plainly, in a form you could act on or reverse.

## D2. Reasoning recoverable

Could you reconstruct why, well enough to disagree with it?

- 0: No reason given, or only "it is better" with nothing behind it.
- 1: A reason is given, but no alternative or trade-off; you cannot argue back.
- 2: The reason and what it was chosen over are both present; you could disagree on the merits.

## D3. Specific

Is it about this codebase, or advice that would fit any project?

- 0: Generic advice; swap the project name and nothing changes.
- 1: Names the project or a file, but the lesson itself is generic.
- 2: Grounded in this codebase: named files, functions, constraints or numbers that carry the lesson.

## D4. Correctable

Is there a claim concrete enough to be wrong?

- 0: Nothing falsifiable; every sentence is safe.
- 1: One concrete claim a reader could check and mark wrong.
- 2: Several concrete claims; a reviewer could verify or reject the note on evidence.

## D5. Narration suppressed

Is it free of "the user asked, then I ran, then it failed"?

- 0: Mostly chronology of the session.
- 1: Some chronology mixed with durable content.
- 2: No session play-by-play; only what remains true after the session ended.

## Grading protocol

- Notes are presented one at a time under opaque ids, in a seeded shuffle.
- No arm label, no running total, no pairing shown.
- Scores are written as the five integers plus optional free text.
- A model preview of the same rubric may be computed in parallel; it is not
  shown until every human grade is in, and it is never the result.
