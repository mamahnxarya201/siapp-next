---
name: google-developer-docs
description: Enforce clear, accessible, consistent technical documentation using the Google developer documentation style guide. Trigger whenever an agent writes, edits, reviews, or formats documentation, READMEs, guides, API references, changelogs, help content, or explanatory technical prose, unless the user explicitly requests another style.
---

# Google developer documentation style

Use this skill for documentation work. Apply project-specific terminology, product rules, and formatting conventions first. Then apply this skill. Use the Google guide as the default when project guidance is silent. If a deliberate deviation improves clarity for the audience, keep it consistent and mention it only when material.

## Before writing

1. Identify the reader, their goal, and the single question the document must answer.
2. Check the repository's project-specific documentation guidance and required terminology.
3. Choose the smallest useful structure: overview, prerequisites, procedure, reference, example, or troubleshooting.
4. Prefer verified facts. Do not invent behavior, commands, outputs, links, or guarantees.

## Voice and language

- Write conversationally, clearly, and respectfully; stay professional and useful.
- Prefer simple, direct language for a global audience.
- Use second person (`you`) when addressing the reader.
- Prefer active voice and name the actor when it matters.
- Put conditions before instructions: "If the service is running, restart it."
- Put the important distinction or conclusion first in a paragraph.
- Keep sentences focused; split long or compound instructions.
- Define acronyms on first use when readers might not know them.
- Use standard American spelling unless project terminology requires otherwise.
- Avoid slang, idioms, culturally specific references, clichés, buzzwords, vague claims, ableist or exclusionary language, and unexplained jargon.
- Avoid filler such as "please note," "at this time," "simply," and "it's easy."
- Avoid `we` and `let's` in instructions, excessive politeness, exclamation marks, and announcements about future documentation.

## Structure and formatting

- Use sentence case for titles and headings.
- Use one level-1 heading for the document title, then a logical heading hierarchy without skipped levels.
- Make headings descriptive and unique. Do not use empty headings.
- Use numbered lists for sequences and procedures; use bullets for unordered items.
- Keep list items parallel in grammar and structure.
- Introduce a list or table with a sentence when context is needed.
- Use serial commas.
- Put commands, filenames, paths, code symbols, parameters, and literal values in code formatting.
- Put UI labels in bold, using the exact visible label.
- Use unambiguous dates, preferably `YYYY-MM-DD` when a precise machine-readable date is needed.
- Use descriptive link text that makes sense out of context. Never use "click here" or "read this."
- Explain unexpected link behavior, such as downloads or new tabs.
- Avoid tables when a list or prose is clearer. Introduce tables, use meaningful headers, and do not put essential meaning only in symbols or color.

## Procedures and examples

- Start with the purpose or outcome, then give the action.
- Use one numbered step per meaningful action.
- State where the action happens before the action: "In the terminal, run ..."
- Keep a step in this order: action, command, placeholder explanation, detail, output, result.
- Use lowercase lettered substeps and lowercase Roman numerals for deeper substeps when the format requires them.
- Mark optional steps with `Optional:` at the beginning.
- Prefer the shortest accessible method when several methods exist; document alternatives separately only when they matter.
- Do not repeat a procedure. Link to or refer to the existing procedure.
- Put expected results after the action that causes them.
- Make examples runnable or label them clearly as illustrative. Explain placeholders and expected output.
- Preserve exact syntax, capitalization, punctuation, and whitespace in code examples.

## Accessibility and inclusion

- Write so the document remains understandable without images, color, sound, punctuation, or spatial context.
- Use semantic headings, lists, tables, and native HTML elements when writing HTML.
- Keep navigation and interactive content keyboard accessible.
- Provide useful alt text for informative images; use empty alt text for decorative images.
- Do not put new information in images, screenshots of text, or color alone. Repeat the information in text.
- Provide captions, transcripts, or descriptions for video and audio.
- Refer to UI controls by their visible label or accessible name, not by position, color, or an icon alone.
- Avoid directional wording such as "above," "below," "left," and "right" when "preceding," "following," or a named element is clearer.
- Keep Markdown and HTML structure compatible with screen readers and browser zoom.

## Final editorial pass

Before delivering documentation, check:

- The reader and purpose are obvious in the opening.
- Claims, commands, links, terminology, and examples are verified.
- Headings, lists, procedures, code, UI labels, dates, and links follow the rules above.
- The document is scannable, concise, and free of repeated instructions.
- Accessibility does not depend on color, images, layout, or punctuation.
- Project-specific guidance and accepted product terminology remain intact.
- Any intentional exception is consistent and necessary for this audience.

## Source

This skill summarizes the Google developer documentation style guide:

- https://developers.google.com/style
- https://developers.google.com/style/highlights
- https://developers.google.com/style/tone
- https://developers.google.com/style/procedures
- https://developers.google.com/style/accessibility

The project-specific style guide takes precedence over this general guide.
