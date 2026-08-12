# PMIS Editorial-Tech Style System

## Intent

Make dense PMIS ideas feel calm, legible, and serious. The visual language should
feel like a well-edited technical publication with subtle product-interface
signals—not a marketing template or administrative dashboard.

Canonical reference: `.agent/product-explanation-for-humans.html`

## Core principles

1. **Editorial hierarchy before decoration.** Use scale, spacing, rules, and
   rhythm to make the argument readable.
2. **The content is the visual.** Prefer diagrams, data, typographic contrast,
   and interface-like examples over ornamental imagery.
3. **Calm operational depth.** Allow information density, but give every layer a
   predictable place and clear priority.
4. **Lightly technical texture.** Use monospaced metadata, hairline grids, compact
   tags, and restrained system diagrams as supporting signals.
5. **One accent purpose at a time.** Color communicates category or emphasis; it
   does not fill space indiscriminately.

## Visual tokens

### Palette

- Paper: `#F4F1E9`
- Raised paper: `#EBE6DA`
- Ink: `#161815`
- Muted text: `#65685F`
- Primary green: `#1D6B4D`
- Blue: `#315F80`
- Amber: `#9A5D16`
- Red: `#A33F34`
- Borders: ink at 16–32% opacity

Use warm off-white rather than pure white. Use near-black rather than absolute
black. Reserve semantic colors for meaning.

### Typography

- Display and interface: a clean system sans-serif stack.
- Long-form leads and pull statements: a bookish serif stack.
- Metadata, labels, and state tags: a system monospace stack.
- Display headlines: tight line height and strong negative tracking.
- Reading copy: approximately 65–75 characters per line with generous leading.

### Layout

- Maximum canvas: approximately 1180px.
- Reading column: approximately 700–760px.
- Use generous vertical sections and thin structural rules.
- On wide screens, pair a sticky compact contents rail with the reading column.
- On small screens, collapse to one column and remove nonessential sticky chrome.
- Use restrained grid textures only inside diagrams or technical panels.

## Reusable patterns

### Hero

- Small monospaced eyebrow.
- One short, forceful headline.
- Serif explanatory lead.
- Compact facts panel rather than a conventional call-to-action cluster.

### Article section

- Numbered monospaced section label.
- Large sans-serif heading.
- Serif lead paragraph.
- Short supporting paragraphs and bordered lists.

### Product rule

Use a bordered pull statement with one accent edge for a principle that should be
remembered. Keep it to one or two sentences.

### State cards

Use a quiet two-column grid with one strong label, restrained semantic color, and
a short definition. Avoid generic feature-card shadows.

### Diagrams

- Prefer Mermaid or semantic HTML/CSS.
- Use linear flows, short labels, and the smallest graph that communicates the
  relationship.
- Place diagrams on subtle technical-grid paper with a caption.
- Keep the main flow dark or green; use blue for proposals, amber for review, red
  for factual risk or conflict.
- Provide an accessible textual explanation adjacent to every diagram.

### Change Record

Use a bordered, ledger-like panel with monospaced metadata, a plain-language
action summary, and an indented tree of before/after values and automatic effects.

## Voice

- Explain the project to an intelligent outsider without assuming PMIS jargon.
- Lead with the outcome or product truth.
- Prefer Why, What, and How when a section becomes complex.
- Use concrete examples to clarify state distinctions.
- Use short declarative principles sparingly.
- Avoid hype, startup clichés, and claims unsupported by the project.

## Documentation mode

- Default to this style for new PMIS human-facing explanatory artifacts unless
  the user supplies another reference.
- Keep each page focused on one narrative rather than recreating the entire app.
- Include print styling for durable documents.
- Mermaid through a CDN is acceptable for local HTML when internet-dependent
  rendering is disclosed; prefer local or semantic diagrams when offline use is
  required.

## UI exploration mode

Apply only on explicit request. Translate the language rather than pasting the
article layout into the product:

- warm or dark neutral foundations;
- strong typographic hierarchy;
- thin rules and subtle grid structure;
- compact monospaced metadata;
- calm panels with minimal decorative chrome;
- semantic color preserved for PMIS states;
- Timeline remains the visual center of gravity.

Do not override screenshot-authoritative layout, the three-panel execution view,
or progressive dependency disclosure.

## Avoid

- Generic SaaS gradients and glass cards.
- Excessive rounded containers.
- Equal visual weight for every action.
- Decorative stock photography.
- Huge navigation systems competing with the artifact's subject.
- User-customized colors that overwrite shared PMIS semantics.
- Dense prose without navigational landmarks.

## Trigger examples

- `Use $pmis-editorial-tech to explain the Forecast model as an HTML article.`
- `Create the PMIS approval documentation in our editorial tech style.`
- `Use the product explanation style for this project brief.`
- `Apply $pmis-editorial-tech to this UI exploration.`
