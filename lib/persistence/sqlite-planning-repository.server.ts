import { DatabaseSync } from 'node:sqlite'
import type {
  ChangeRecord,
  PlanningRevision,
  TaskChangeProposal,
} from '@/lib/domain/planning-types'
import type { PlanningRepository } from './planning-repository'

const schema = `
CREATE TABLE IF NOT EXISTS planning_revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  layer TEXT NOT NULL,
  status TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  source_revision_id TEXT,
  created_at TEXT NOT NULL,
  activated_at TEXT,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS planning_revisions_project_idx ON planning_revisions(project_id, created_at);
CREATE TABLE IF NOT EXISTS change_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  effects_json TEXT NOT NULL,
  automatic_effects_json TEXT NOT NULL,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS change_records_project_idx ON change_records(project_id, occurred_at);
CREATE TABLE IF NOT EXISTS task_change_proposals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  requested_dates_json TEXT NOT NULL,
  proposed_forecast_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS task_change_proposals_project_idx ON task_change_proposals(project_id, created_at);
`

type JsonRow = Record<string, unknown>

export class SqliteQueryBuilder {
  constructor(private readonly db: DatabaseSync) {}

  execute(sql: string, ...params: unknown[]) {
    return this.db.prepare(sql).run(...params)
  }

  one<T>(sql: string, mapper: (row: JsonRow) => T, ...params: unknown[]): T | null {
    const row = this.db.prepare(sql).get(...params) as JsonRow | undefined
    return row ? mapper(row) : null
  }

  many<T>(sql: string, mapper: (row: JsonRow) => T, ...params: unknown[]): T[] {
    return (this.db.prepare(sql).all(...params) as JsonRow[]).map(mapper)
  }
}

const asDate = (value: unknown) => new Date(String(value))

function revisionFromRow(row: JsonRow): PlanningRevision {
  const payload = JSON.parse(String(row.payload_json)) as PlanningRevision
  return {
    ...payload,
    createdAt: asDate(row.created_at),
    activatedAt: row.activated_at ? asDate(row.activated_at) : undefined,
  }
}

function changeRecordFromRow(row: JsonRow): ChangeRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    actorId: String(row.actor_id),
    action: row.action as ChangeRecord['action'],
    targetType: row.target_type as ChangeRecord['targetType'],
    targetId: String(row.target_id),
    occurredAt: asDate(row.occurred_at),
    effects: JSON.parse(String(row.effects_json)),
    automaticEffects: JSON.parse(String(row.automatic_effects_json)),
    reason: row.reason ? String(row.reason) : undefined,
  }
}

function proposalFromRow(row: JsonRow): TaskChangeProposal {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    taskId: String(row.task_id),
    requestedBy: String(row.requested_by),
    reviewerId: String(row.reviewer_id),
    requestedDates: JSON.parse(String(row.requested_dates_json)),
    proposedForecast: JSON.parse(String(row.proposed_forecast_json)),
    status: row.status as TaskChangeProposal['status'],
    createdAt: asDate(row.created_at),
  }
}

export class SqlitePlanningRepository implements PlanningRepository {
  private readonly query: SqliteQueryBuilder

  constructor(private readonly db: DatabaseSync) {
    this.query = new SqliteQueryBuilder(db)
  }

  async initialize() {
    this.db.exec(schema)
  }

  async saveRevision(revision: PlanningRevision) {
    this.query.execute(
      `INSERT INTO planning_revisions
       (id, project_id, layer, status, owner_id, source_revision_id, created_at, activated_at, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         activated_at = excluded.activated_at,
         payload_json = excluded.payload_json`,
      revision.id,
      revision.projectId,
      revision.layer,
      revision.status,
      revision.ownerId,
      revision.sourceRevisionId ?? null,
      revision.createdAt.toISOString(),
      revision.activatedAt?.toISOString() ?? null,
      JSON.stringify(revision),
    )
  }

  async getRevision(revisionId: string) {
    return this.query.one(
      'SELECT * FROM planning_revisions WHERE id = ?',
      revisionFromRow,
      revisionId,
    )
  }

  async listRevisions(projectId: string) {
    return this.query.many(
      'SELECT * FROM planning_revisions WHERE project_id = ? ORDER BY created_at ASC',
      revisionFromRow,
      projectId,
    )
  }

  async appendChangeRecord(record: ChangeRecord) {
    this.query.execute(
      `INSERT INTO change_records
       (id, project_id, actor_id, action, target_type, target_id, occurred_at, effects_json, automatic_effects_json, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.projectId,
      record.actorId,
      record.action,
      record.targetType,
      record.targetId,
      record.occurredAt.toISOString(),
      JSON.stringify(record.effects),
      JSON.stringify(record.automaticEffects),
      record.reason ?? null,
    )
  }

  async listChangeRecords(projectId: string) {
    return this.query.many(
      'SELECT * FROM change_records WHERE project_id = ? ORDER BY occurred_at ASC',
      changeRecordFromRow,
      projectId,
    )
  }

  async saveTaskChangeProposal(proposal: TaskChangeProposal) {
    this.query.execute(
      `INSERT INTO task_change_proposals
       (id, project_id, task_id, requested_by, reviewer_id, requested_dates_json, proposed_forecast_json, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status`,
      proposal.id,
      proposal.projectId,
      proposal.taskId,
      proposal.requestedBy,
      proposal.reviewerId,
      JSON.stringify(proposal.requestedDates),
      JSON.stringify(proposal.proposedForecast),
      proposal.status,
      proposal.createdAt.toISOString(),
    )
  }

  async listTaskChangeProposals(projectId: string) {
    return this.query.many(
      'SELECT * FROM task_change_proposals WHERE project_id = ? ORDER BY created_at ASC',
      proposalFromRow,
      projectId,
    )
  }
}

let defaultRepository: SqlitePlanningRepository | null = null

export function getSqlitePlanningRepository(): SqlitePlanningRepository {
  if (!defaultRepository) {
    const db = new DatabaseSync(process.env.PMIS_SQLITE_PATH ?? 'pmis.local.sqlite')
    defaultRepository = new SqlitePlanningRepository(db)
  }
  return defaultRepository
}
