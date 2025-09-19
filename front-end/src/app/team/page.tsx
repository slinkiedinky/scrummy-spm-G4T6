import { Sidebar } from "@/components/sidebar"
import { TeamView } from "@/components/team-view"

export default function TeamPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <TeamView />
      </main>
    </div>
  )
}
