'use client'

import { usePMISStore } from '@/lib/pmis-store'
import { TopNav } from './top-nav'
import { DashboardView } from './dashboard-view'
import { ProjectView } from './project-view'
import { TaskCreateDialog } from './task-create-dialog'

export function PMISApp() {
  const { currentView } = usePMISStore()

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav />
      {currentView === 'dashboard' ? (
        <DashboardView />
      ) : (
        <ProjectView />
      )}
      <TaskCreateDialog />
    </div>
  )
}
