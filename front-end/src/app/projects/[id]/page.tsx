import { Sidebar } from "@/components/sidebar"
import { ProjectDetailView } from "@/components/project-detail-view"

interface ProjectPageProps {
  params: {
    id: string
  }
}

export default function ProjectPage({ params }: ProjectPageProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <ProjectDetailView projectId={params.id} />
      </main>
    </div>
  )
}
