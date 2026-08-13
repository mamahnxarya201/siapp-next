'use client'

import { usePMISStore } from '@/lib/pmis-store'
import { TopNav } from './top-nav'
import { DashboardView } from './dashboard-view'
import { ProjectView } from './project-view'
import { TaskCreateDialog } from './task-create-dialog'
import { TaskDeleteDialog } from './task-delete-dialog'
import { PlanningPanel } from './planning-panel'
import { useState } from 'react'

export function PMISApp() {
  const { currentView, currentProjectId } = usePMISStore()
  const [planningOpen, setPlanningOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav onOpenPlanning={() => setPlanningOpen(true)} />
      {currentView === 'dashboard' ? (
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
