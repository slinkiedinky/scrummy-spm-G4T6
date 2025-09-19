import { Sidebar } from "@/components/sidebar"
import { ProjectDashboard } from "@/components/project-dashboard"

export default function ProjectsPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <ProjectDashboard />
      </main>
    </div>
  )
}
