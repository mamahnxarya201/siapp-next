import { NextResponse } from 'next/server'
import { getSqlitePlanningRepository } from '@/lib/persistence/sqlite-planning-repository.server'

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
  const repository = getSqlitePlanningRepository()
  await repository.initialize()
  return NextResponse.json({ revisions: await repository.listRevisions(projectId) })
}
