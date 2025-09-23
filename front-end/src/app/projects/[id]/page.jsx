import { Sidebar } from "@/components/Sidebar"
import { ProjectDetailView } from "@/components/ProjectDetailedView"

export default function ProjectPage({ params }) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <ProjectDetailView projectId={params.id} />
      </main>
    </div>
  )
}