# Year 0 theme and interaction contract

This contract applies to the isolated vanilla demo in `experimental/gantt-engine`.
It does not change the React PMIS application.

## Themes

The host application selects one theme with `data-theme` on
`.gantt-application`. The supported values are `dark`, `light`, and `editorial`.
Controls use `data-action="theme.set"`; the stylesheet owns the semantic color
tokens, so interaction code does not contain palette decisions. The editorial theme
uses the project’s paper/ink, green, blue, amber, and red visual language while
preserving the same layout and behavior.

## Cell grid settings

The timeline is rendered as a cell grid with both date-column and row-boundary
lines. Grid presentation is intentionally separated from task scheduling in
`src/grid.js`; the engine accepts a future-facing `settings.grid` object with these
keys:

- `showVerticalLines`
- `showHorizontalLines`
- `showMajorLines`
- `minorLineColor`, `majorLineColor`, and `rowLineColor`
- `groupFill` and `taskFill`

The current demo uses the wireframe defaults. The `Timeline Settings` button in
`demo/index.html` and `demo/empty.html` opens a modal dialog that updates these
settings live: three switches (vertical lines, horizontal lines, major lines) and
five color fields (minor/major/row line colors, group/task fills). Saving applies
the settings through `normalizeGridSettings` without changing task geometry,
dependency routing, or scheduling rules; the same seam accepts a future
persistence backend.

## Task authoring

- The activity panel contains an editable task-name field for every task. The
  sidebar does not include an inline task-entry field.
- A right-click in empty timeline space suppresses the browser menu and offers
  `Add task bar here` (a name field in the context menu). The new bar starts at the
  clicked date and remains draggable through the existing schedule interaction
  controller. The name field is cleared each time the menu opens so a fresh menu
  never reuses the previous task's name.
- Right-clicking a task bar offers `Connect to another task`. Moving over a target
  renders a preview connector; clicking the target commits the edge. The canonical
  `predecessorIds` and UI-facing `dependencies` fields are updated together before
  normalization.
- Right-clicking a dependency connector offers removal.

Context-menu suppression is scoped to the Gantt root. Browser behavior outside the
demo remains untouched, and Escape cancels an open menu or connection preview.

The interaction mapping follows the documented Tom’s Planner pattern: names are
entered directly in the grid, schedule blocks are drawn on the timeline, and
dependencies are created from a source task to a target task.

## Project header: name and logo

The top navigation brand follows the React PMIS `top-nav.tsx` header. It exposes two
independent controls:

- **Project name.** Clicking the name button swaps it for a textbox. Enter or blur
  commits the new name; Escape cancels and restores the previous name. The name is
  session-only state (no persistence) and shows a status message when changed.
- **Project logo.** Clicking the 32px logo button opens the `Customize project logo`
  dialog: an image upload (`Choose image`), a fixed-square crop frame centered over a
  224px crop surface, pointer drag to reposition, and scroll to zoom (scale 0.5–3).
  `Save logo` applies the crop to the header logo; `Cancel` (or Escape, or clicking the
  backdrop) discards the draft. Like the name, the logo is session-only state.

Keyboard contract (per `STD-HCI.md`): the logo and name buttons are tab-reachable and
activate with Enter/Space. Inside the dialog, Tab advances Choose image → Save logo →
Cancel and then loops back to the first field; Escape closes the dialog and returns
focus to the logo button. Accept (`Save logo`) sits to the left of Decline (`Cancel`),
matching the non-destructive default.
