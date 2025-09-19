import { Sidebar } from "@/components/sidebar"
import { SettingsView } from "@/components/settings-view"

export default function SettingsPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <SettingsView />
      </main>
    </div>
  )
}
