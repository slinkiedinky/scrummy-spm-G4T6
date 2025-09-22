"use client"

import { useCallback, useMemo, useState } from "react"
import { TaskColumn } from "@/components/task-column"
import { TaskDetailModal } from "@/components/task-detail-modal"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Filter } from "lucide-react"

import type { Project, Task, TeamMember } from "@/types/project"

interface TaskBoardProps {
  project: Project
}

/**
 * Ensure a task has an assignee object (name, role, etc.), not just an id.
 * We look the id up in project.team and attach the full TeamMember.
 */
function withHydratedAssignee(task: Task, team: TeamMember[]): Task {
  const raw = task as any
  const already = typeof raw.assignee === "object" && raw.assignee
  const assigneeId =
    already?.id ??
    (typeof raw.assignee === "string" ? raw.assignee : raw.assigneeId)

  const member = team.find((m) => m.id === assigneeId)
  if (member) return { ...task, assignee: member } as Task

  // Fallback placeholder (keeps UI stable if user doc is missing)
  return assigneeId
    ? ({
        ...task,
        assignee: {
          id: String(assigneeId),
          name: `User ${String(assigneeId).slice(0, 4)}`,
          role: "Member",
          email: "",
          avatar: "",
          department: "General",
        },
      } as Task)
    : task
}

export function TaskBoard({ project }: TaskBoardProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all")

  const tasks = project.tasks ?? []

  const filteredTasks = useMemo(() => {
    return tasks.filter((task: any) => {
      const matchesSearch =
        (task.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.description || "").toLowerCase().includes(searchTerm.toLowerCase())

      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter

      // Support either a string id or an { id, name } object
      const assigneeId =
        typeof task.assignee === "string" ? task.assignee : (task.assignee?.id ?? task.assigneeId)
      const matchesAssignee = assigneeFilter === "all" || assigneeId === assigneeFilter

      return matchesSearch && matchesPriority && matchesAssignee
    })
  }, [tasks, searchTerm, priorityFilter, assigneeFilter])

  const getTasksByStatus = (status: string) =>
    filteredTasks.filter(
      (task: any) => (task.status || "").toLowerCase().replace(" ", "-") === status
    )

  const columns = [
    { id: "todo", title: "To Do", status: "todo", color: "bg-muted" },
    { id: "in-progress", title: "In Progress", status: "in-progress", color: "bg-primary" },
    { id: "review", title: "Review", status: "review", color: "bg-secondary" },
    { id: "completed", title: "Completed", status: "completed", color: "bg-chart-3" },
  ]

  // Wrap the click so the modal always receives a hydrated task
  const handleTaskClick = useCallback(
    (t: Task) => setSelectedTask(withHydratedAssignee(t, project.team || [])),
    [project.team]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header w/ Filters */}
      <div className="border-b border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Tasks</h2>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {(project.team || []).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full">
          {columns.map((col) => (
            <TaskColumn
              key={col.id}
              title={col.title}
              color={col.color}
              tasks={getTasksByStatus(col.status)}
              onTaskClick={handleTaskClick}
            />
          ))}
        </div>
      </div>

      {/* Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}
