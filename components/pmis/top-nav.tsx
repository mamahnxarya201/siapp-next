'use client'

import { Search, Bell, Plus, ChevronDown, Settings, LayoutGrid, GanttChart, Moon, Sun, Undo2, Redo2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { usePMISStore } from '@/lib/pmis-store'
import { cn } from '@/lib/utils'

export function TopNav() {
  const { resolvedTheme, setTheme } = useTheme()
  const [themeReady, setThemeReady] = useState(false)

  useEffect(() => setThemeReady(true), [])

  const { 
    currentProjectId, 
    projects,
    setCurrentProject,
    setSearchQuery,
    searchQuery,
    openTaskCreate,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePMISStore()

  const currentProject = projects.find(p => p.id === currentProjectId)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditableTarget = target?.closest('input, textarea, select, [contenteditable="true"]')
      if (isEditableTarget || !(event.ctrlKey || event.metaKey)) return

      const key = event.key.toLowerCase()
      if (key === 'z' && event.shiftKey && canRedo) {
        event.preventDefault()
        redo()
        return
      }
      if (key === 'z' && canUndo) {
        event.preventDefault()
        undo()
        return
      }
      if (key === 'y' && canRedo) {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canRedo, canUndo, redo, undo])

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <GanttChart className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">Planview</span>
        </div>

        {/* Project Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 text-sm">
              {currentProject ? currentProject.name : 'All Projects'}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem onClick={() => setCurrentProject(null)}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              All Projects
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {projects.map((project) => (
              <DropdownMenuItem 
                key={project.id} 
                onClick={() => setCurrentProject(project.id)}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'h-2 w-2 rounded-full',
                    project.status === 'active' && 'bg-success',
                    project.status === 'delayed' && 'bg-destructive',
                    project.status === 'on-hold' && 'bg-warning',
                    project.status === 'completed' && 'bg-info'
                  )} />
                  <span className="truncate">{project.name}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Center - Search */}
      <div className="flex flex-1 items-center justify-center px-8">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tasks, projects..."
            className="h-8 w-full bg-secondary pl-9 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 border-r border-border pr-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo last workspace change"
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo last workspace change"
            title="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label={themeReady && resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={themeReady && resolvedTheme === 'dark' ? 'Light theme' : 'Dark theme'}
          disabled={!themeReady}
        >
          {themeReady && resolvedTheme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {/* Quick Add */}
        <Button size="sm" className="h-8 gap-1.5" onClick={() => openTaskCreate()}>
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Task</span>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            3
          </span>
        </Button>

        {/* Settings */}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                  AC
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
