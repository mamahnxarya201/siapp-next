'use client'

import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Users,
  ArrowRight,
  Calendar,
  Zap
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { usePMISStore } from '@/lib/pmis-store'
import type { Project } from '@/lib/pmis-data'

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'active': return 'bg-success'
      case 'delayed': return 'bg-destructive'
      case 'on-hold': return 'bg-warning'
      case 'completed': return 'bg-info'
    }
  }

  const getStatusText = (status: Project['status']) => {
    switch (status) {
      case 'active': return 'Active'
      case 'delayed': return 'Delayed'
      case 'on-hold': return 'On Hold'
      case 'completed': return 'Completed'
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <Card 
      className="cursor-pointer hover:bg-accent/50 transition-colors border-border"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">{project.name}</CardTitle>
            <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>
          </div>
          <Badge 
            variant="secondary" 
            className={cn(
              'text-[10px]',
              project.status === 'active' && 'bg-success/15 text-success',
              project.status === 'delayed' && 'bg-destructive/15 text-destructive',
              project.status === 'on-hold' && 'bg-warning/15 text-warning',
              project.status === 'completed' && 'bg-info/15 text-info'
            )}
          >
            {getStatusText(project.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-foreground">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-1.5" />
        </div>

        {/* Metrics row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(project.startDate)} - {formatDate(project.endDate)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{project.teamSize}</span>
          </div>
        </div>

        {/* Health indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className={cn(
              'h-2 w-2 rounded-full',
              project.healthScore >= 70 && 'bg-success',
              project.healthScore >= 40 && project.healthScore < 70 && 'bg-warning',
              project.healthScore < 40 && 'bg-destructive'
            )} />
            <span className="text-[10px] text-muted-foreground">Health {project.healthScore}%</span>
          </div>
          {project.delayedMilestones > 0 && (
            <span className="text-[10px] text-destructive">
              {project.delayedMilestones} delayed
            </span>
          )}
          {project.pendingApprovals > 0 && (
            <span className="text-[10px] text-warning">
              {project.pendingApprovals} pending
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function KPICard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  trendValue,
  color = 'default'
}: { 
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: 'up' | 'down'
  trendValue?: string
  color?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const iconColors = {
    default: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    danger: 'text-destructive bg-destructive/10',
  }

  return (
    <Card className="border-border">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn('rounded-lg p-2', iconColors[color])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        {trend && trendValue && (
          <div className="mt-2 flex items-center gap-1">
            <TrendingUp className={cn(
              'h-3 w-3',
              trend === 'up' ? 'text-success' : 'rotate-180 text-destructive'
            )} />
            <span className={cn(
              'text-xs',
              trend === 'up' ? 'text-success' : 'text-destructive'
            )}>
              {trendValue}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardView() {
  const { projects, tasks, setCurrentProject } = usePMISStore()

  // Calculate KPIs
  const activeProjects = projects.filter(p => p.status === 'active').length
  const delayedProjects = projects.filter(p => p.status === 'delayed').length
  const totalPendingApprovals = projects.reduce((sum, p) => sum + p.pendingApprovals, 0)
  const avgHealthScore = Math.round(projects.reduce((sum, p) => sum + p.healthScore, 0) / projects.length)
  
  const tasksInProgress = tasks.filter(t => t.status === 'in-progress').length
  const blockedTasks = tasks.filter(t => t.status === 'blocked').length
  const criticalPathTasks = tasks.filter(t => t.isCriticalPath && t.status !== 'done').length
  const milestonesUpcoming = tasks.filter(t => t.isMilestone && t.status !== 'done').length

  // High risk items
  const highRiskProjects = projects.filter(p => p.riskScore > 50)
  const blockedTasksList = tasks.filter(t => t.status === 'blocked')

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Project Overview</h1>
          <p className="text-sm text-muted-foreground">
            Monitor project health, track milestones, and manage risks across your portfolio.
          </p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard
            title="Active Projects"
            value={activeProjects}
            subtitle={`${projects.length} total`}
            icon={Activity}
            trend="up"
            trendValue="+2 this month"
            color="success"
          />
          <KPICard
            title="Delayed Projects"
            value={delayedProjects}
            subtitle="Need attention"
            icon={AlertTriangle}
            color={delayedProjects > 0 ? 'danger' : 'default'}
          />
          <KPICard
            title="Pending Approvals"
            value={totalPendingApprovals}
            subtitle="Across all projects"
            icon={Clock}
            color={totalPendingApprovals > 3 ? 'warning' : 'default'}
          />
          <KPICard
            title="Avg Health Score"
            value={`${avgHealthScore}%`}
            subtitle="Portfolio health"
            icon={TrendingUp}
            color={avgHealthScore >= 70 ? 'success' : avgHealthScore >= 40 ? 'warning' : 'danger'}
          />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="border-border">
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="rounded-lg bg-info/10 p-2">
                <Zap className="h-4 w-4 text-info" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{tasksInProgress}</p>
                <p className="text-xs text-muted-foreground">Tasks In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="rounded-lg bg-destructive/10 p-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{blockedTasks}</p>
                <p className="text-xs text-muted-foreground">Blocked Tasks</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="rounded-lg bg-warning/10 p-2">
                <Activity className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{criticalPathTasks}</p>
                <p className="text-xs text-muted-foreground">Critical Path Tasks</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="rounded-lg bg-milestone/10 p-2">
                <CheckCircle2 className="h-4 w-4 text-milestone" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{milestonesUpcoming}</p>
                <p className="text-xs text-muted-foreground">Upcoming Milestones</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Projects</h2>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              View All
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map(project => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onClick={() => setCurrentProject(project.id)}
              />
            ))}
          </div>
        </div>

        {/* Risk Summary */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* High Risk Projects */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                High Risk Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {highRiskProjects.length === 0 && blockedTasksList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No high risk items at this time</p>
              ) : (
                <>
                  {highRiskProjects.map(project => (
                    <div 
                      key={project.id}
                      className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-destructive" />
                        <span className="text-sm text-foreground">{project.name}</span>
                      </div>
                      <Badge variant="outline" className="border-destructive/35 text-destructive">
                        Risk: {project.riskScore}%
                      </Badge>
                    </div>
                  ))}
                  {blockedTasksList.slice(0, 3).map(task => (
                    <div 
                      key={task.id}
                      className="flex items-center justify-between rounded-lg border border-warning/20 bg-warning/5 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-warning" />
                        <span className="text-sm text-foreground">{task.name}</span>
                      </div>
                      <Badge variant="outline" className="border-warning/35 text-warning">
                        Blocked
                      </Badge>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Milestones */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-primary" />
                Upcoming Milestones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.filter(t => t.isMilestone && t.status !== 'done').slice(0, 4).map(task => (
                <div 
                  key={task.id}
                  className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-milestone">◆</span>
                    <div>
                      <span className="text-sm text-foreground">{task.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {task.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      'text-[10px]',
                      task.status === 'in-progress' && 'bg-info/15 text-info',
                      task.status === 'todo' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {task.status === 'in-progress' ? 'In Progress' : 'Planned'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
