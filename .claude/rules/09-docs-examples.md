---
paths:
  - "docs/**/*.md"
  - "examples/**/*"
  - "README*.md"
  - "CONTRIBUTING.md"
  - "CHANGELOG.md"
---

# Documentation and examples rules

## Purpose and source of truth

Documentation and examples explain the current public package behavior. Source code, tests, package exports, and checked-in configuration are the authority; prose MUST be synchronized with them. Examples may be runnable demonstrations or explicitly labeled historical/audit material.

- API examples MUST import from declared package entry points or supported aliases, never from deep implementation paths presented as stable usage.
- Docs MUST accurately describe registered-note versus pitch-class analysis, candidate/ambiguity/evidence behavior, MIDI half-open intervals and diagnostics, Pipeline cache/stream finalization, Harmony uncertainty/provenance, and Legacy compatibility semantics when those topics are covered.
- Defaults, option names, package subpaths, Node requirements, scripts, and coverage expectations MUST match current configuration.
- A historical example or audit artifact MUST be clearly labeled and MUST NOT be used to override current source, tests, or public declarations.
- Bilingual documentation MUST preserve the same normative meaning for warnings, defaults, and compatibility constraints.

## Writing and maintenance

- Use concise, executable instructions and include expected commands or outputs only when verified.
- New public APIs SHOULD include a minimal example and a statement of input/output semantics.
- When behavior changes, update the relevant architecture/API/testing/Playground documentation and changelog entry as appropriate.
- Documentation SHOULD identify privacy, browser capability, stream finalization, and error behavior where users could otherwise make unsafe assumptions.

## Verification

- Check code snippets against the current public exports and run the referenced commands before claiming they work.
- For release/process documentation, compare wording with package scripts and workflow files.
- Run `git diff --check`; review links, headings, and fenced code blocks for consistency.

## Prohibited changes

- MUST NOT document behavior that has not been verified in source or tests.
- MUST NOT present internal deep paths or generated artifacts as stable public API.
- MUST NOT let historical examples contradict current source, tests, or declarations without an explicit warning.
- MUST NOT use `dist/`, coverage, screenshots, or temporary probe output as the normative source of behavior.
- MUST NOT silently rewrite release, CI, publishing, or contribution-process semantics in prose.
