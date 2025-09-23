"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "lucide-react"

const priorityClasses = {
  low: "bg-green-100 text-green-700 border border-green-200",
  medium: "bg-yellow-400 text-white border border-yellow-400",
  high: "bg-red-100 text-red-700 border border-red-200",
}

const statusClasses = {
  "to-do": "bg-blue-400 text-white",
  "in progress": "bg-yellow-400 text-black",
  completed: "bg-green-400 text-white",
  blocked: "bg-muted text-muted-foreground",
}

export function TaskColumn({ title, color, tasks, onTaskClick }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
        </div>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-sm text-muted-foreground p-6">No tasks</CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              className="hover:border-primary/40 transition cursor-pointer"
              onClick={() => onTaskClick(task)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  {task.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    className={statusClasses[task.status] || "bg-muted text-muted-foreground"}
                  >
                    {task.status
                      ? task.status.charAt(0).toUpperCase() +
                        task.status.slice(1).replace("-", " ")
                      : "Unknown"}
                  </Badge>
                  <Badge
                    className={
                      priorityClasses[task.priority] || "bg-muted text-muted-foreground"
                    }
                    variant="outline"
                  >
                    {task.priority
                      ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1)
                      : "N/A"}
                  </Badge>
                </div>

                {task.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
