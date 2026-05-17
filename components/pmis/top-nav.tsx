'use client'

import { Search, Bell, Plus, ChevronDown, Settings, LayoutGrid, GanttChart } from 'lucide-react'
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
  const { 
    currentView, 
    currentProjectId, 
    projects,
    setCurrentProject,
    setSearchQuery,
    searchQuery
  } = usePMISStore()

  const currentProject = projects.find(p => p.id === currentProjectId)

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
                    project.status === 'active' && 'bg-emerald-500',
                    project.status === 'delayed' && 'bg-red-500',
                    project.status === 'on-hold' && 'bg-amber-500',
                    project.status === 'completed' && 'bg-blue-500'
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
        {/* Quick Add */}
        <Button size="sm" className="h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Task</span>
        </Button>

        {/* View Mode */}
        <div className="flex items-center rounded-lg border border-border bg-secondary p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2.5',
              currentView === 'dashboard' && 'bg-card shadow-sm'
            )}
            onClick={() => setCurrentProject(null)}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2.5',
              currentView === 'project' && 'bg-card shadow-sm'
            )}
            onClick={() => !currentProjectId && setCurrentProject(projects[0]?.id || null)}
          >
            <GanttChart className="h-3.5 w-3.5" />
          </Button>
        </div>

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
