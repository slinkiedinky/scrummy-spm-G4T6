"use client"

import { useCallback, useState } from "react"
import { TaskColumn } from "@/components/TaskColumn"
import { TaskDetailModal } from "@/components/TaskDetailModal"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Filter } from "lucide-react"

const PRIORITY_VALUES = Array.from({ length: 10 }, (_, i) => String(i + 1))
const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priority" },
  ...PRIORITY_VALUES.map((value) => ({ value, label: `Priority ${value}` })),
]

const getPriorityBadgeClass = (priority) => {
  const value = Number(priority)
  if (!Number.isFinite(value)) {
    return "bg-muted text-muted-foreground border border-border/50"
  }
  if (value >= 8) {
    return "bg-red-100 text-red-700 border border-red-200"
  }
  if (value >= 5) {
    return "bg-yellow-100 text-yellow-700 border border-yellow-200"
  }
  return "bg-emerald-100 text-emerald-700 border border-emerald-200"
}

const priorityLabel = (priority) => (priority ? `Priority ${priority}` : "Priority —")

async function fetchUserById(id) {
  try {
    const res = await fetch(`http://localhost:5000/api/users/${id}`)
    if (!res.ok) throw new Error("Failed to fetch user")
    return await res.json() // expect {id, name, role}
  } catch (err) {
    console.error("Error fetching user", err)
    return null
  }
}

export function TaskBoard({}) {
    const [selectedTask, setSelectedTask] = useState(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [priorityFilter, setPriorityFilter] = useState("all")
    const [assigneeFilter, setAssigneeFilter] = useState("all")
    const [loadingTask, setLoadingTask] = useState(false)

    // pull tasks collection

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      (task.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description || "").toLowerCase().includes(searchTerm.toLowerCase())

    const matchesPriority =
      priorityFilter === "all" || String(task.priority) === priorityFilter

    const assigneeId =
      typeof task.assignee === "string" ? task.assignee : (task.assignee?.id ?? task.assigneeId)
    const matchesAssignee = assigneeFilter === "all" || assigneeId === assigneeFilter

    return matchesSearch && matchesPriority && matchesAssignee
  })

  const getTasksByStatus = (status) =>
    filteredTasks.filter(
      (task) => (task.status || "").toLowerCase().replace(" ", "-") === status
    )

  const columns = [
    { id: "to-do", title: "To Do", status: "to-do", color: "bg-blue-400" },
    { id: "in progress", title: "In Progress", status: "in progress", color: "bg-yellow-400" },
    { id: "completed", title: "Review", status: "completed", color: "bg-green-400" },
    { id: "blocked", title: "Blocked", status: "blocked", color: "bg-muted" },
  ]

  const handleTaskClick = useCallback(async (task) => {
    setLoadingTask(true)

    let assigneeId =
      typeof task.assignee === "string" ? task.assignee : (task.assignee?.id ?? task.assigneeId)

    let hydratedTask = { ...task }

    if (assigneeId) {
      const user = await fetchUserById(assigneeId)
      if (user) {
        hydratedTask.assignee = user
      } else {
        hydratedTask.assignee = {
          id: String(assigneeId),
          name: `User ${String(assigneeId).slice(0, 4)}`,
          role: "Member",
        }
      }
    }

    setSelectedTask(hydratedTask)
    setLoadingTask(false)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header w/ Filters */}
      <div className="border-b border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Tasks</h2>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Add Tasks
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
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {/* You could also pre-fetch users for the filter dropdown if needed */}
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
          loading={loadingTask}
        />
      )}
    </div>
  )
}
