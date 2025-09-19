"use client"

import { TaskCard } from "@/components/task-card"
import { Badge } from "@/components/ui/badge"
import type { Task } from "@/types/project"

interface TaskColumnProps {
  title: string
  tasks: Task[]
  color: string
  onTaskClick: (task: Task) => void
}

export function TaskColumn({ title, tasks, color, onTaskClick }: TaskColumnProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {tasks.length}
        </Badge>
      </div>

      {/* Tasks */}
      <div className="flex-1 space-y-3 overflow-auto">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 border-2 border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">No tasks</p>
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />)
        )}
      </div>
    </div>
  )
}
