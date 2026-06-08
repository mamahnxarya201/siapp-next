'use client'

import { useEffect } from 'react'
import { usePMISStore } from '@/lib/pmis-store'
import { TopNav } from './top-nav'
import { DashboardView } from './dashboard-view'
import { ProjectView } from './project-view'

export function PMISApp({ dataMode = 'default' }: { dataMode?: 'default' | 'stress' }) {
  const { currentView, setDataMode } = usePMISStore()

  useEffect(() => {
    setDataMode(dataMode)
  }, [dataMode, setDataMode])

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav />
      {currentView === 'dashboard' ? (
        <DashboardView />
      ) : (
        <ProjectView />
      )}
    </div>
  )
}
