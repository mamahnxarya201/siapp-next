export const DEFAULT_GRID_SETTINGS = Object.freeze({
  showVerticalLines: true,
  showHorizontalLines: true,
  showMajorLines: true,
  minorLineColor: "#dededc",
  majorLineColor: "#c9c9c7",
  rowLineColor: "#d8d8d6",
  groupFill: "#fff8ef",
  taskFill: "#ffffff",
});

export function normalizeGridSettings(value = {}) {
  return Object.freeze({
    ...DEFAULT_GRID_SETTINGS,
    ...(value && typeof value === "object" ? value : {}),
  });
}
