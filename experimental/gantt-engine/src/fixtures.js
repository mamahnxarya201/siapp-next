const DAY_MS = 24 * 60 * 60 * 1000;

const teamMembers = [
  { id: "u1", name: "Alex Chen", initials: "AC", color: "#dcecef" },
  { id: "u2", name: "Sarah Miller", initials: "SM", color: "#e6eef5" },
  { id: "u3", name: "James Wilson", initials: "JW", color: "#e8e9f6" },
  { id: "u4", name: "Emma Davis", initials: "ED", color: "#e9f1e8" },
  { id: "u5", name: "Michael Brown", initials: "MB", color: "#f1eadf" },
  { id: "u6", name: "Lisa Johnson", initials: "LJ", color: "#f2e4ed" },
  { id: "u7", name: "David Kim", initials: "DK", color: "#e7edf0" },
  { id: "u8", name: "Rachel Green", initials: "RG", color: "#eee9df" },
];

export const demoWorkstreams = [
  { id: "gateway-foundation", label: "Gateway Foundation", color: "#287984", icon: "foundation" },
  { id: "service-migration", label: "Service Migration", color: "#287984", icon: "core-platform" },
  { id: "traffic-transition", label: "Traffic Transition", color: "#32765e", icon: "execution-ui" },
  { id: "resilience-validation", label: "Resilience Validation", color: "#8a5a0a", icon: "validation" },
  { id: "regional-rollout", label: "Regional Rollout", color: "#66548f", icon: "release" },
];

const performanceTaskNames = [
  "Define route contract",
  "Migrate service adapter",
  "Configure traffic policy",
  "Run resilience validation",
  "Complete regional rollout",
];

const performanceTeams = [
  "infrastructure",
  "backend",
  "deployment",
  "qa",
  "management",
];

const teamLabels = {
  infrastructure: "Infra",
  backend: "Backend",
  deployment: "Deployment",
  qa: "QA",
  management: "Management",
};

const teamColors = {
  infrastructure: "#287984",
  backend: "#287984",
  deployment: "#66548f",
  qa: "#8a5a0a",
  management: "#60747c",
};

function addDays(value, days) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfToday() {
  const result = new Date();
  result.setHours(0, 0, 0, 0);
  return result;
}

function performanceSpecs() {
  return Array.from({ length: 240 }, (_, index) => {
    const lane = index % demoWorkstreams.length;
    const wave = Math.floor(index / demoWorkstreams.length);
    const dependencies = new Set();

    if (wave > 0) dependencies.add(`performance-${index - demoWorkstreams.length + 1}`);
    if (lane > 0) dependencies.add(`performance-${index}`);
    if (wave > 1 && lane > 0 && wave % 3 === 0)
      dependencies.add(`performance-${index - demoWorkstreams.length}`);

    const blocked = index > 20 && index % 47 === 0;
    const status = blocked
      ? "blocked"
      : wave < 9
        ? "done"
        : wave < 18
          ? "in-progress"
          : "todo";
    const duration = 1 + (index % 3);

    return {
      id: `performance-${index + 1}`,
      name: `${performanceTaskNames[lane]} — migration wave ${String(wave + 1).padStart(2, "0")}`,
      groupName: demoWorkstreams[lane].id,
      teamName: performanceTeams[lane],
      startDate: addDays(startOfToday(), -28 + wave * 3 + lane),
      endDate: addDays(startOfToday(), -28 + wave * 3 + lane + duration),
      dependencies: [...dependencies],
      status,
      progress: status === "done" ? 100 : status === "in-progress" ? 25 + (index * 7) % 70 : 0,
      priority: index % 29 === 0 ? "critical" : index % 7 === 0 ? "high" : "medium",
      assignee: teamMembers[index % teamMembers.length],
      isMilestone: index > 0 && index % 40 === 0,
      isCriticalPath: lane === demoWorkstreams.length - 1,
      blockers: blocked ? ["Migration approval is waiting on the owning service team."] : [],
      riskLevel: blocked ? "high" : index % 11 === 0 ? "medium" : "low",
      estimatedDays: duration,
      optimisticDays: Math.max(1, duration - 1),
      pessimisticDays: duration + 2,
      createdAt: addDays(startOfToday(), -240 + index),
      plannedStart: addDays(startOfToday(), -28 + wave * 3 + lane),
      plannedEnd: addDays(startOfToday(), -28 + wave * 3 + lane + duration),
      earliestStart: addDays(startOfToday(), -28 + wave * 3 + lane),
      description: `Performance fixture task ${index + 1} of 240.`,
      checklist: [],
      linkedChangeRequests: [],
      labels: [],
      comments: [],
    };
  });
}

function schedulePerformanceTasks(specs) {
  const byId = new Map(specs.map((task) => [task.id, task]));
  const scheduled = new Map();
  const visiting = new Set();

  function schedule(id) {
    if (scheduled.has(id)) return scheduled.get(id);
    if (visiting.has(id)) throw new Error(`Circular fixture dependency: ${id}`);
    const task = byId.get(id);
    if (!task) throw new Error(`Unknown fixture dependency: ${id}`);
    visiting.add(id);
    const predecessors = task.dependencies.map(schedule);
    visiting.delete(id);

    const minimumStart = predecessors.reduce(
      (latest, predecessor) =>
        !latest || predecessor.endDate > latest ? predecessor.endDate : latest,
      null,
    );
    const startDate =
      minimumStart && task.startDate < minimumStart
        ? new Date(minimumStart)
        : new Date(task.startDate);
    const duration = Math.max(DAY_MS, task.endDate.getTime() - task.startDate.getTime());
    const result = {
      ...task,
      startDate,
      endDate: new Date(startDate.getTime() + duration),
      earliestStart: minimumStart ? new Date(minimumStart) : new Date(startDate),
      group: task.teamName,
      teamName: teamLabels[task.teamName] ? task.teamName : "management",
      teamLabel: teamLabels[task.teamName] ?? "Management",
      teamColor: teamColors[task.teamName] ?? teamColors.management,
    };
    scheduled.set(id, result);
    return result;
  }

  return specs.map((task) => schedule(task.id));
}

// This is the same deterministic 240-task performance fixture used by React's p3 route.
export const demoTasks = schedulePerformanceTasks(performanceSpecs());
