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

## Adaptive Route Selection

### Normal left-entry route

When horizontal clearance is at least twice `DEPENDENCY_ELBOW_GAP`, the line:

1. Leaves the predecessor's right-center edge.
2. Travels horizontally to an intermediate elbow.
3. Travels vertically to the dependent's centerline.
4. Enters the dependent at its left-center edge.

### Cramped top-entry route

When normal left entry would create a short or backward-looking final segment, the line:

1. Leaves the predecessor by `DEPENDENCY_PARENT_EXIT_GAP`.
2. Routes vertically above the dependent.
3. Travels horizontally to `DEPENDENCY_TOP_INSET` from the dependent's left edge.
4. Travels downward and stops `DEPENDENCY_TOP_GAP` above the bar.
5. Uses the final downward segment to orient the arrowhead correctly.

## Adjustable Geometry

The following top-level constants in `gantt-chart.tsx` independently control connector geometry:

| Constant | Responsibility |
| --- | --- |
| `DEPENDENCY_ELBOW_GAP` | Normal-route clearance and vertical approach space |
| `DEPENDENCY_PARENT_EXIT_GAP` | Short horizontal segment leaving a predecessor in cramped routing |
| `DEPENDENCY_TOP_INSET` | Horizontal position of the top-entry arrow relative to the dependent's left edge |
| `DEPENDENCY_TOP_GAP` | Visual gap between the arrow endpoint and the dependent bar |

Do not combine these values into one constant. Independent tuning prevents one visual correction from damaging another route.

## Continuous Stroke Requirement

Dependency paths must render as continuous solid strokes.

Do not use a fixed numeric `stroke-dasharray` to animate path drawing. A fixed dash length such as `1000` becomes a repeating dash-and-gap pattern when the connector's total path length exceeds that number. SVG arrow markers still appear at the destination, producing a visibly detached arrow and a large missing section.

The `.dependency-line` CSS rule therefore has no dash animation. It uses `vector-effect: non-scaling-stroke` so line thickness remains stable if SVG scaling is introduced.

Each dependency `<path>` also enforces `strokeDasharray: 'none'` and `strokeDashoffset: 0` through its React inline style. This is deliberately redundant with the CSS rule: inline SVG styling prevents stale compiled CSS, theme overrides, or a future broad path animation from restoring a dashed state when a long connector is recomputed during dragging.

SVG paths are not viewport-cull-rendered by this component. Horizontal scrolling only changes which portion of the full timeline SVG is visible. Moving a task beyond the current viewport expands/recomputes timeline geometry, but the resulting dependency path must still be one continuous SVG stroke across its full coordinates.

If a drawing animation is added in the future, it must derive the actual path length per element or use normalized `pathLength`. It must also account for arrow-marker visibility during the animation. A new animation requires visual testing on both short and very long connectors.

## Render Order

The SVG layers are ordered as follows:

1. Timeline background and grid.
2. Row backgrounds.
3. Dependency paths.
4. Task bars and milestones.

This allows task bars to cover connector segments that pass beneath them. Such occlusion is intentional. A gap in otherwise unobstructed timeline space is not intentional.

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

- [ ] Long connectors render continuously from source to arrowhead.
- [ ] No arrowhead is detached in empty timeline space.
- [ ] Normal routes enter the dependent from the left.
- [ ] Cramped routes enter from above near the upper-left edge.
- [ ] Arrow direction matches the final path segment.
- [ ] Normal and critical connectors use their correct theme colors.
- [ ] Hidden tasks do not leave orphan connectors.
- [ ] Selecting and hovering tasks does not animate or flicker connector strokes.
- [ ] Day, week, and month scales preserve continuous lines.
