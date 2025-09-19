import { Sidebar } from "@/components/sidebar"
import { AnalyticsView } from "@/components/analytics-view"

export default function AnalyticsPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <AnalyticsView />
      </main>
    </div>
  )
}
