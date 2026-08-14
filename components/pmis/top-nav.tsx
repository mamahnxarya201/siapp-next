'use client'

import { Search, Bell, Settings, GanttChart, Moon, Sun, Sparkles, Upload } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { usePMISStore } from '@/lib/pmis-store'

export function TopNav({ onOpenPlanning }: { onOpenPlanning: () => void }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [themeReady, setThemeReady] = useState(false)
  const [logoOpen, setLogoOpen] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoScale, setLogoScale] = useState(1)
  const [logoOffset, setLogoOffset] = useState({ x: 0, y: 0 })
  const cropDrag = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => setThemeReady(true), [])

  const { 
    currentProjectId, 
    projects,
    setSearchQuery,
    searchQuery,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePMISStore()

  const currentProject = projects.find(p => p.id === currentProjectId)

  useEffect(() => {
    if (!currentProjectId) return
    setLogoPreview(window.localStorage.getItem(`pmis-project-logo:${currentProjectId}`))
    const savedCrop = window.localStorage.getItem(`pmis-project-logo-crop:${currentProjectId}`)
    if (savedCrop) {
      const crop = JSON.parse(savedCrop) as { scale?: number; x?: number; y?: number }
      setLogoScale(crop.scale ?? 1)
      setLogoOffset({ x: crop.x ?? 0, y: crop.y ?? 0 })
    } else {
      setLogoScale(1)
      setLogoOffset({ x: 0, y: 0 })
    }
  }, [currentProjectId])

  const handleLogoFile = (file?: File) => {
    if (!file || !currentProjectId) return
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result)
      setLogoPreview(value)
    }
    reader.readAsDataURL(file)
  }

  const saveLogo = () => {
    if (currentProjectId && logoPreview) {
      window.localStorage.setItem(`pmis-project-logo:${currentProjectId}`, logoPreview)
      window.localStorage.setItem(`pmis-project-logo-crop:${currentProjectId}`, JSON.stringify({ scale: logoScale, x: logoOffset.x, y: logoOffset.y }))
    }
    setLogoOpen(false)
  }

  const cancelLogo = () => {
    if (currentProjectId) {
      setLogoPreview(window.localStorage.getItem(`pmis-project-logo:${currentProjectId}`))
      const savedCrop = window.localStorage.getItem(`pmis-project-logo-crop:${currentProjectId}`)
      const crop = savedCrop ? JSON.parse(savedCrop) as { scale?: number; x?: number; y?: number } : null
      setLogoScale(crop?.scale ?? 1)
      setLogoOffset({ x: crop?.x ?? 0, y: crop?.y ?? 0 })
    }
    setLogoOpen(false)
  }

  const handleCropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    cropDrag.current = { x: event.clientX - logoOffset.x, y: event.clientY - logoOffset.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

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
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={() => setLogoOpen(true)}
          aria-label="Customize project logo"
          title="Customize project logo"
        >
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-primary">
            {logoPreview ? <img src={logoPreview} alt="" className="h-full w-full object-cover" style={{ transform: `translate(${logoOffset.x * 0.08}px, ${logoOffset.y * 0.08}px) scale(${logoScale})` }} /> : <GanttChart className="h-4 w-4 text-primary-foreground" />}
          </div>
          <span className="font-semibold text-foreground">{currentProject?.name ?? 'PMIS'}</span>
        </button>
      </div>

      <Dialog open={logoOpen} onOpenChange={(open) => { if (open) setLogoOpen(true); else cancelLogo() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Customize project logo</DialogTitle><DialogDescription>Upload an image and adjust its crop. It is saved locally for this project.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div
              className="relative mx-auto h-56 w-full max-w-sm touch-none overflow-hidden rounded-xl border bg-muted"
              onWheel={(event) => { event.preventDefault(); setLogoScale((value) => Math.min(3, Math.max(0.5, value - event.deltaY * 0.001))) }}
              onPointerMove={(event) => { if (cropDrag.current) setLogoOffset({ x: event.clientX - cropDrag.current.x, y: event.clientY - cropDrag.current.y }) }}
              onPointerUp={() => { cropDrag.current = null }}
              onPointerCancel={() => { cropDrag.current = null }}
            >
              {logoPreview ? <img src={logoPreview} alt="Logo crop source" className="absolute left-1/2 top-1/2 max-h-none max-w-none cursor-grab select-none" draggable={false} onPointerDown={handleCropPointerDown} style={{ transform: `translate(calc(-50% + ${logoOffset.x}px), calc(-50% + ${logoOffset.y}px)) scale(${logoScale})` }} /> : <GanttChart className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />}
              <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-36 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]" aria-label="Locked square crop area" />
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm"><Upload className="h-4 w-4" /> Choose image<input type="file" accept="image/*" className="sr-only" onChange={(e) => handleLogoFile(e.target.files?.[0])} /></label>
            <p className="text-xs text-muted-foreground">Drag the image to reposition it. Scroll over the image to zoom. The square crop area is locked to the project logo ratio.</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={saveLogo}>Save logo</Button>
            <Button type="button" variant="outline" onClick={cancelLogo}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

        {currentProjectId && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onOpenPlanning}>
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Planning</span>
          </Button>
        )}

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
                <AvatarFallback className="!flex !items-center !justify-center bg-primary text-[10px] leading-none text-primary-foreground">
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
