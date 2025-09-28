"use client";

import useCurrentUser from "@/hooks/useCurrentUser";
import { MyTasksList } from "@/components/my-tasks-list";

export function MyTasksDashboard() {
  const user = useCurrentUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md mx-auto p-8">
          <h1 className="text-2xl font-bold mb-4">My Tasks</h1>
          <div className="bg-muted/50 border border-muted rounded-lg p-6">
            <p className="text-lg text-muted-foreground">
              Please log in to view your tasks.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">My Tasks</h1>
          <MyTasksList userId={user.uid} />
        </div>
      </div>
    </div>
  );
}