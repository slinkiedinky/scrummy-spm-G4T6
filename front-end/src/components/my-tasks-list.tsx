"use client";

import { useEffect, useState } from "react";
import { fetchMyTasks } from "@/lib/api";
import { TaskCard } from "@/components/task-card";
import { TaskDetailModal } from "@/components/task-detail-modal";

// Nested Task Component for handling collapsible subtasks
function NestedTask({ task, onTaskClick }: { task: any; onTaskClick: (task: any) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2">
        {task.subtasks && task.subtasks.length > 0 && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors"
            aria-label={collapsed ? "Expand subtasks" : "Collapse subtasks"}
          >
            {collapsed ? "▶" : "▼"}
          </button>
        )}
        <div className="flex-1">
          <TaskCard 
            task={task} 
            onClick={() => onTaskClick(task)} 
          />
        </div>
      </div>
      
      {!collapsed && task.subtasks && task.subtasks.length > 0 && (
        <div className="ml-6 border-l border-muted pl-4 mt-2">
          {task.subtasks.map((subtask: any) => (
            <NestedTask key={subtask.id} task={subtask} onTaskClick={onTaskClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// Main MyTasks Component
interface MyTasksProps {
  userId: string;
  className?: string;
}

export function MyTasksList({ userId, className = "" }: MyTasksProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const userTasks = await fetchMyTasks(userId);

        const loadTasks = async () => {
  try {
    setLoading(true);
    setError(null);
    const userTasks = await fetchMyTasks(userId);
    
    // Debug: Log the raw data to see what's coming from API
    console.log("Raw tasks from API:", userTasks);
    
    // Debug: Check each task's priority
    userTasks.forEach((task, index) => {
      console.log(`Task ${index} priority:`, task.priority, typeof task.priority);
    });
    
    setTasks(userTasks);
  } catch (err) {
    console.error("Error fetching tasks:", err);
    setError("Failed to load tasks. Please try again.");
  } finally {
    setLoading(false);
  }
};


        setTasks(userTasks);
      } catch (err) {
        console.error("Error fetching tasks:", err);
        setError("Failed to load tasks. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [userId]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span>Loading your tasks...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-8 ${className}`}>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <div className="text-muted-foreground">
          <p className="text-lg mb-2">No tasks assigned to you</p>
          <p className="text-sm">Tasks assigned to you will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned to you
        </p>
      </div>
      
      <div className="space-y-3">
        {tasks.map((task) => (
          <NestedTask key={task.id} task={task} onTaskClick={setSelectedTask} />
        ))}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}