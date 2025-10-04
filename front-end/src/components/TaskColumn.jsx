"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "lucide-react"

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") return new Date(value)
  if (typeof value === "object" && typeof value.seconds === "number") return new Date(value.seconds * 1000)
  return null
}

const TAG_BASE = "rounded-full px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1";
const getStatusColor = (sRaw) => {
  const s = String(sRaw || "").toLowerCase();
  if (s === "to-do" || s === "todo") return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
  if (s === "in progress" || s === "in-progress") return `${TAG_BASE} bg-blue-100 text-blue-700 border border-blue-200`;
  if (s === "completed" || s === "done") return `${TAG_BASE} bg-emerald-100 text-emerald-700 border border-emerald-200`;
  if (s === "blocked") return `${TAG_BASE} bg-red-100 text-red-700 border border-red-200`;
  return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
};
const getPriorityColor = (nRaw) => {
  const n = Number(nRaw);
  if (!Number.isFinite(n)) return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
  if (n >= 8) return `${TAG_BASE} bg-red-100 text-red-700 border border-red-200`;
  if (n >= 4) return `${TAG_BASE} bg-white text-yellow-700 border border-yellow-300`;
  return `${TAG_BASE} bg-emerald-100 text-emerald-700 border border-emerald-200`;
};


// const getPriorityBadgeClass = (priority) => {
//   const value = Number(priority)
//   if (!Number.isFinite(value)) {
//     return "bg-muted text-muted-foreground border border-border/50"
//   }
//   if (value >= 8) {
//     return "bg-red-100 text-red-700 border border-red-200"
//   }
//   if (value >= 4) {
//     return "bg-yellow-100 text-yellow-700 border border-yellow-200"
//   }
//   return "bg-emerald-100 text-emerald-700 border-emerald-200"
// }


// const statusClasses = {
//   "to-do": "bg-blue-400 text-white",
//   "in progress": "bg-yellow-400 text-black",
//   completed: "bg-green-400 text-white",
//   blocked: "bg-muted text-muted-foreground",
// }

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
                {task.projectName && (
                  <p className="text-xs text-muted-foreground truncate">{task.projectName}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge className={getStatusColor(task.status)}>
                    {task.status === "to-do" ? "To Do" : task.status === "in progress" ? "In Progress" : task.status === "blocked" ? "Blocked" : "Completed"}
                  </Badge>
                  <Badge className={getPriorityColor(task.priority)}>Priority {task.priority}</Badge>
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

                {(() => {
                  const candidate =
                    (task.assignee && typeof task.assignee === "object" && task.assignee.name) ||
                    task.assigneeName ||
                    (task.assigneeSummary && task.assigneeSummary.name) ||
                    ""
                  return candidate ? (
                    <div className="text-xs text-muted-foreground">Assignee: {candidate}</div>
                  ) : null
                })()}

                {(() => {
                  const names = Array.isArray(task.collaboratorNames)
                    ? task.collaboratorNames
                    : Array.isArray(task.collaborators)
                      ? task.collaborators
                          .map((item) => (typeof item === "object" ? item?.name : item))
                          .filter(Boolean)
                      : []
                  return names.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      Collaborators: {names.join(", ")}
                    </div>
                  ) : null
                })()}

                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {(() => {
                      const due = toDate(task.dueDate)
                      return due ? due.toLocaleDateString() : "—"
                    })()}
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
