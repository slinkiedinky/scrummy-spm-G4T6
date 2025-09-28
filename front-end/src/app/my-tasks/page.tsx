import { Sidebar } from "@/components/sidebar";
import { MyTasksDashboard } from "@/components/my-tasks-dashboard";

export default function MyTasksPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <MyTasksDashboard />
      </main>
    </div>
  );
}
