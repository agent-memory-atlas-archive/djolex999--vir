---
title: "retroactive-transcript-archaeology-positioning"
description: "Decision distilled by vir from a Claude Code session on 2026-09-02. Extended session building and iterating on the vir marketing site (virwiki.dev): brainstorming/spec/plan through impleme"
editUrl: false
---

:::note[Written by vir, not by a human]
**Decision** · session `b86ba9dc` · 2026-09-02 · classifier confidence 0.92
:::

## Summary
Extended session building and iterating on the vir marketing site (virwiki.dev): brainstorming/spec/plan through implementation, followed by multiple rounds of live polish (accessibility, honesty/proof mechanisms, dark mode, docs, RSS, public vault) and a critical CI-setup pass that surfaced real latent bugs (a silently-broken test, npm lockfile drift, node-version incompatibilities). Establishes durable conventions for how this project builds credibility (derived numbers, uncurated proof, no competitor bashing) and how its dual Node-version toolchain must be tested.

## What Was Learned
- **Positioning strategy**: differentiate by inversion, not attack. Never name competitors negatively (PLUR is never mentioned); credit the closest peer (Basic Memory) honestly. Lead with an uncontested claim (retroactive recovery of pruned history) rather than generic "agents forget" framing shared by the whole category.
- **Numbers must be derivable, never hand-copied.** Every stale/duplicated figure drifted within days (vaultNotes mismatch, cost totals, "13 checks" frozen since an old version). Fix by deleting duplicate sources or building a script (`npm run refresh`) that diffs committed vs. measured values, compared at display precision.
- **Proof beats assertion.** Publishing real, uncurated artifacts (labeled hero graph from actual vault data, a public `/vault` of real notes including weak ones, visitor-runnable `find` commands) is more credible than curated demos or benchmark claims — and is a differentiator competitors with non-human-readable memory formats can't copy.
- **Untested checkers are not checkers.** Verify link-checkers, test-count guards, etc. by deliberately breaking them first.
- **Environment-dependent tests are silent landmines.** A test that lets production code auto-resolve a dependency (e.g., an embedding provider) tests the machine, not the contract — inject or explicitly pin dependencies. A stale `vi.mock` targeting a function the code no longer calls is invisible until the real path fails.
- **CI is non-negotiable even solo.** This repo had no CI; a real test failure went unnoticed for weeks. First CI run immediately caught 3 more bugs: out-of-sync lockfile, wrong vitest config resolution, and Node-version-specific native module (better-sqlite3) failures. Native modules pin a repo to one Node major; cross-major testing needs explicit guards.
- **Astro + Preact (not React) for marketing sites**: near-zero JS budget achievable; islands only where interactivity is needed.
- Accessibility matters at scale: unbounded `tabindex` on generated content (110 graph nodes) is a serious a11y bug — limit focusability to meaningful elements.

## Context (project: vir, category: decision, date: 2026-09-02T15:13:51.747Z)
Built and iteratively hardened the `virwiki.dev` marketing/docs site for the `vir` CLI tool, inside the `vir` monorepo (`site/` subdirectory). Work spanned spec → plan → implementation → many rounds of live feedback-driven polish, culminating in the repo's first CI pipeline. Surfaced and fixed real product issues along the way (stale doctor check count, an actually-broken CLI test, npm publish blocked). Decisions here (positioning rules, number-derivation discipline, CI structure, dual-Node-version handling) are now codified in `CLAUDE.md` and should be treated as binding conventions for future work on this repo.

## Related

- [thesis-as-launch-launchpad](/vault/decisions/thesis-as-launch-launchpad-395d2f80/)
- [cost-logging-architecture](/vault/decisions/cost-logging-architecture-e16e7aec/)
- [readme-restructure-badges](/vault/decisions/readme-restructure-badges-b71e2ae1/)
- [three-state project triage before cost](/vault/decisions/three-state-project-triage-before-cost-990e18b0/)
- [time-window selection resolves schema tension](/vault/decisions/time-window-selection-resolves-schema-tension-3745b31b/)
