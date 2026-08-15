'use client'

import { usePMISStore } from '@/lib/pmis-store'
import { TopNav } from './top-nav'
import { DashboardView } from './dashboard-view'
import { ProjectView } from './project-view'
import { TaskCreateDialog } from './task-create-dialog'
import { TaskDeleteDialog } from './task-delete-dialog'
import { PlanningPanel } from './planning-panel'
import { useState } from 'react'
import { useEffect } from 'react'

export function PMISApp({ route = 'dashboard', projectId }: { route?: 'dashboard' | 'project'; projectId?: string }) {
  const { currentProjectId } = usePMISStore()
  const setCurrentProject = usePMISStore((state) => state.setCurrentProject)
  const [planningOpen, setPlanningOpen] = useState(false)

  useEffect(() => {
    setCurrentProject(route === 'project' ? projectId ?? null : null)
  }, [projectId, route, setCurrentProject])

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav onOpenPlanning={() => setPlanningOpen(true)} />
      {route === 'dashboard' ? (
        <DashboardView />
      ) : (
        <ProjectView key={currentProjectId ?? 'no-project'} />
      )}
      <TaskCreateDialog />
      <TaskDeleteDialog />
      <PlanningPanel open={planningOpen} onOpenChange={setPlanningOpen} />
    </div>
  )
}
