import type {
  ChangeRecord,
  PlanningRevision,
  TaskChangeProposal,
} from '@/lib/domain/planning-types'

export interface PlanningRepository {
  initialize(): Promise<void>
  saveRevision(revision: PlanningRevision): Promise<void>
  getRevision(revisionId: string): Promise<PlanningRevision | null>
  listRevisions(projectId: string): Promise<PlanningRevision[]>
  appendChangeRecord(record: ChangeRecord): Promise<void>
  listChangeRecords(projectId: string): Promise<ChangeRecord[]>
  saveTaskChangeProposal(proposal: TaskChangeProposal): Promise<void>
  listTaskChangeProposals(projectId: string): Promise<TaskChangeProposal[]>
}
