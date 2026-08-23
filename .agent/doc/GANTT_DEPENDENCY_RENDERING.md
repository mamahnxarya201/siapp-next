# Gantt Dependency Line Rendering and Performance

## Purpose

This document defines how PMIS dependency connectors are selected, positioned, rendered, and kept performant. These rules are part of the core Gantt behavior and must remain consistent with the dependency scheduling constraints documented in `AGENT_PRODUCT_KNOWLEDGE.md` and `INITIAL_PMIS_HANDOFF.md`.

## Rendering Pipeline

Dependency connectors are rendered by `DependencyLine` in `components/pmis/gantt-chart.tsx` as SVG `<path>` elements.

The pipeline is:

1. `getVisibleRows()` supplies the currently visible task rows.
2. `taskPositions` converts each visible task's dates and row into SVG coordinates.
3. `visibleDependencies` selects only the dependency relationships required by the current UI state.
4. Each relationship becomes one orthogonal SVG path.
5. An SVG marker supplies the destination arrowhead.
6. Dependency paths are rendered before task bars so bars remain the primary foreground objects.

## Visibility Rules

| UI state | Rendered dependencies |
| --- | --- |
| Default | None |
| Task hovered | Direct predecessor and dependent edges |
| Task selected | Visible upstream and downstream chain |
| All Dependencies enabled | All edges between visible tasks |
| Critical Path enabled | Visible critical-path edges |

Collapsed or filtered-out tasks do not receive connectors because no visible SVG position exists for them.

## Coordinate Model

For a predecessor (`from`) and dependent (`to`):

- `fromX` is the right edge of the predecessor bar.
- `fromY` is the vertical center of the predecessor bar.
- `toX` is the left edge of the dependent bar.
- `toY` is the vertical center of the dependent bar.

All connectors use horizontal and vertical SVG path commands (`H` and `V`). Curves are intentionally not used.

## Adaptive route selection

Committed connectors use the Tom's Planner route pattern. Every route starts at
the predecessor's right-center edge and uses no more than two elbows.

### Normal left-entry route

When horizontal clearance is at least twice `DEPENDENCY_ELBOW_GAP`, the line:

1. Leaves the predecessor by `DEPENDENCY_ELBOW_GAP`.
2. Turns onto a vertical trunk.
3. Turns once at the dependent's centerline.
4. Enters the dependent at its left-center edge.

For predecessor endpoint $(x_f, y_f)$, dependent endpoint $(x_t, y_t)$, and gap
$g$, the ordered route points are:

$$
P_{\text{left}} =
\left[
  (x_f, y_f),
  (x_f + g, y_f),
  (x_f + g, y_t),
  (x_t, y_t)
\right]
$$

### Cramped vertical-edge route

When normal left entry lacks sufficient clearance, the line:

1. Travels horizontally to `DEPENDENCY_TOP_INSET` from the dependent's left edge.
2. Turns once toward the nearest vertical edge.
3. Terminates exactly on the dependent bar.

The connector touches the dependent's top edge when the dependent is lower than
the predecessor. It touches the bottom edge when the dependent is higher. This
two-segment route avoids both a detached endpoint and a short or backward
horizontal tail.

## Adjustable Geometry

The following top-level constants independently control connector geometry:

| Constant | Responsibility |
| --- | --- |
| `DEPENDENCY_ELBOW_GAP` | Clearance threshold for normal left entry. |
| `DEPENDENCY_TOP_INSET` | Horizontal position of a cramped vertical-edge entry. |

Keep these values independent so that route-selection clearance and endpoint
placement remain separately adjustable.

## Appearance preferences

**Timeline Settings** exposes two normalized dependency appearance preferences:

- normal line width: 1px to 3px in 0.5px steps, default 1.5px;
- direction cue size: 3px to 8px in 1px steps, default 6px.

Critical connector width preserves proportional emphasis:

$$
w_{\text{critical}} = 1.33w_{\text{normal}}
$$

The renderer rounds critical width to two decimal places. Cue size changes the
fixed triangle dimensions for every eligible segment; it does not scale with
segment length. The minimum eligible segment length remains 12px. The invisible
12px hover corridor also remains fixed, so thinner visible lines are not harder
to target.

## Half-day interaction grid

Move, start-resize, and end-resize gestures use the nearest half-day. New tasks
start in the half-day region containing the pointer but retain a one-day initial
duration. The minimum resized duration is one half-day.

For pixel delta $\Delta x$, day width $w$, and half-day increment $q = 0.5$:

$$
\Delta u =
\operatorname{sgn}(\Delta x)
\operatorname{round}
\left(
  \frac{|\Delta x|}{wq}
\right)q
$$

Resize hit zones shrink on short bars:

$$
h = \min\left(10, \frac{b}{2}\right)
$$

Here, $b$ is the rendered bar width and $h$ is each edge's hit-zone width. The
formula prevents overlapping start and end targets at week and month scales.

## Connection preview performance

Beginning a connection creates one preview SVG path through the ordinary render
pipeline. Pointer movement updates only that path and is coalesced to one update
per animation frame. It does not rebuild the timeline snapshot or replace the
grid, task bars, and committed connectors.

The engine listens to `pointermove` for this gesture. It does not also process
compatibility `mousemove` events. Commit, cancellation, and disposal cancel any
pending preview frame.

## Continuous Stroke Requirement

Dependency paths must render as continuous solid strokes.

Do not use a fixed numeric `stroke-dasharray` to animate path drawing. A fixed dash length such as `1000` becomes a repeating dash-and-gap pattern when the connector's total path length exceeds that number. SVG arrow markers still appear at the destination, producing a visibly detached arrow and a large missing section.

The `.dependency-line` CSS rule therefore has no dash animation. It uses `vector-effect: non-scaling-stroke` so line thickness remains stable if SVG scaling is introduced.

Each dependency `<path>` also enforces `strokeDasharray: 'none'` and `strokeDashoffset: 0` through its React inline style. This is deliberately redundant with the CSS rule: inline SVG styling prevents stale compiled CSS, theme overrides, or a future broad path animation from restoring a dashed state when a long connector is recomputed during dragging.

SVG paths are not viewport-cull-rendered by this component. Horizontal scrolling only changes which portion of the full timeline SVG is visible. Moving a task beyond the current viewport expands/recomputes timeline geometry, but the resulting dependency path must still be one continuous SVG stroke across its full coordinates.

If a drawing animation is added in the future, it must derive the actual path length per element or use normalized `pathLength`. It must also account for arrow-marker visibility during the animation. A new animation requires visual testing on both short and very long connectors.

## Render order

The SVG layers are ordered as follows:

1. Timeline background and grid.
2. Row backgrounds.
3. Dependency paths.
4. Task bars and milestones.

This allows task bars to cover connector segments that pass beneath them. Such occlusion is intentional. A gap in otherwise unobstructed timeline space is not intentional.

The normal selected-task halo extends 2px beyond the bar. During an active drag
preview, the renderer hides that filled halo because it is painted after
dependency paths and would otherwise cover the connector endpoint. The preview
bar remains visible and continues to cover only the intentional segment beneath
the bar itself.

During edge autoscroll, the renderer creates one constrained position map and
uses it for both dependency paths and preview bars. Scheduling continues to use
the raw snapshot positions. Mixing raw connector coordinates with a constrained
bar coordinate creates a visible source gap and an overlapping incoming endpoint.

Timeline compaction may change the rendered date range and scroll alignment. It
must preserve every task's identity, duration, committed date, DOM bar, and
visibility at the aligned release edge.

## Performance Characteristics

Let:

- `T` be the total task count.
- `V` be the visible task count.
- `E` be the number of dependency edges selected for display.

The current behavior has these characteristics:

- Task coordinate generation is `O(V)`.
- Dependency selection is approximately `O(T + E)` for traversal, with some task lookups currently using linear `find` operations.
- SVG output is one path per visible selected edge: `O(E)` DOM elements.
- Route calculation is constant work per edge.
- `useMemo` prevents position and dependency recalculation when their inputs are unchanged.
- Progressive disclosure keeps `E` small during normal hover and selection workflows.
- Removing stroke-drawing animation avoids per-path animation frames, dash-offset repaints, and length-dependent rendering defects.
- The inline solid-stroke invariant adds constant work per path and has no frame-by-frame runtime cost.

For the current prototype-sized dataset, this is appropriate. If task and edge counts grow substantially, the first optimization should be an ID-to-task map for constant-time lookup, followed by viewport-based edge culling if profiling shows SVG element count as the bottleneck.

## Verification Checklist

- [ ] Long connectors render as one continuous stroke.
- [ ] Distant routes use a predecessor exit, vertical trunk, and target tail.
- [ ] Cramped routes use one elbow and the nearest vertical target edge.
- [ ] No committed route uses more than two elbows.
- [ ] Hovering within the invisible interaction corridor reveals direction cues.
- [ ] Each eligible segment has at most one direction cue.
- [ ] Half-day movement and both resize edges snap symmetrically.
- [ ] New tasks retain a one-day duration at midnight or noon starts.
- [ ] Short-bar resize hit zones do not overlap at any scale.
- [ ] Hidden tasks do not leave orphan connectors.
- [ ] Selecting and hovering tasks does not animate or flicker connector strokes.
- [ ] Day, week, and month scales preserve continuous lines.
