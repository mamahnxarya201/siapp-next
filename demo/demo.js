import "../src/ui-primitives.js";
import { Gateway } from "../src/bridge/index.mjs";
import { InMemoryTransport } from "../src/bridge/transports.mjs";
import { createGanttEngine } from "../src/engine.js";
import { demoTasks, demoWorkstreams } from "../src/fixtures.js";

let storedTasks = structuredClone(demoTasks);
const gateway = new Gateway({
  transport: new InMemoryTransport({
    latencyMs: 35,
    handlers: {
      "schedule.load": () => ({ tasks: storedTasks }),
      "schedule.commit": ({ tasks }) => {
        storedTasks = structuredClone(tasks);
        return { accepted: true, taskCount: storedTasks.length };
      },
    },
  }),
  clientName: "pmis-vanilla-gantt-demo",
  clientVersion: "0.1.0",
});
const engine = createGanttEngine({
  root: document.querySelector("#gantt-application"),
  taskListElement: document.querySelector("#task-list"),
  timelineElement: document.querySelector("#timeline-viewport"),
  statusElement: document.querySelector("#application-status"),
  selectionStatusElement: document.querySelector("#selection-status"),
  taskCountElement: document.querySelector("#task-count"),
  tasks: demoTasks,
  workstreams: demoWorkstreams,
  gateway,
  settings: {
    scale: "week",
    snapIncrement: "half-day",
    visibleWeekdays: [0, 1, 2, 3, 4, 5, 6],
  },
});
engine.start();
globalThis.ganttDemo = engine;
