---
name: pmis-editorial-tech
description: Create PMIS documentation, product explainers, briefs, reports, and explicitly requested UI explorations in the project's calm editorial-tech visual language. Use when the user invokes $pmis-editorial-tech, asks for the established PMIS documentation style, says "editorial tech style," references the product-explanation-for-humans page, or requests new PMIS documentation without specifying another visual direction. Apply to application UI only when the user explicitly requests this style for UI; never let it silently override authoritative PMIS screenshots or accepted interaction architecture.
---

# PMIS Editorial Tech

Use the established PMIS editorial language: calm, high-contrast, spacious,
lightly technical, and structured around strong explanatory hierarchy.

## Required references

1. Read `references/style-system.md` completely.
2. For HTML, web, or UI work, inspect the canonical artifact at
   `../../../.agent/product-explanation-for-humans.html` before designing.
3. Read the normal PMIS product documents required by the repository contract.

## Choose the mode

- **Documentation mode:** Use by default for PMIS explanatory HTML, articles,
  briefs, human-readable product documentation, and visual reports unless the
  user requests another style.
- **UI exploration mode:** Use only when the user explicitly invokes this skill
  or asks to apply the editorial-tech style to application UI. Preserve the
  three-panel project architecture, semantic colors, progressive dependency
  disclosure, and screenshot-authoritative interaction structure.
- **Plain Markdown mode:** Preserve the voice, hierarchy, and information design;
  do not manufacture visual decoration that the format cannot support.

## Workflow

1. Identify the reader and the single question the artifact must answer.
2. Lead with a strong product truth, then explain Why, What, and How.
3. Use the smallest helpful diagram for relationships or lifecycle sequences.
4. Apply the tokens and layout rules in `references/style-system.md`.
5. Reuse product terminology from confirmed PMIS decisions exactly.
6. Keep visual hierarchy strong and interface chrome restrained.
7. Verify responsive layout, readable line length, contrast, semantic structure,
   keyboard accessibility, and print behavior when relevant.

## Boundaries

- Treat the canonical HTML as a reference system, not a page to clone verbatim.
- Do not copy Cursor, Amp, or another company's identity, logo, wording, or exact
  composition.
- Do not add generic gradients, glassmorphism, oversized dashboard chrome, or
  decorative imagery without a content reason.
- Do not convert application UI to this style merely because documentation uses
  it. Require explicit UI intent.
- Do not override accepted PMIS product semantics or protected behaviours.

