import { notFound } from 'next/navigation'
import { PMISApp } from '@/components/pmis/pmis-app'
import { projects } from '@/lib/pmis-data'

export default async function ProjectTimelinePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  if (!projects.some((project) => project.id === projectId)) notFound()
  return <PMISApp route="project" projectId={projectId} />
}
