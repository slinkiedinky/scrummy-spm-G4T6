"use client"

import { useEffect, useMemo, useState } from "react"
import { ProjectCard } from "@/components/project-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, Plus, Filter, TrendingDown, X, ArrowUpDown, ArrowUp, ArrowDown, Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import type { Project } from "@/types/project"

type SortField = "overdue" | "completion" | "deadline"
type SortOrder = "asc" | "desc"

interface ActiveFilter {
  type: "project" | "department" | "employee" | "taskStatus" | "dateRange"
  value: string
  label: string
}

// --- API (proxy to Flask via next.config) ---
async function fetchProjects() {
  const res = await fetch("/api/projects", { cache: "no-store" })
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`)
  return (await res.json()) as any[]
}

// --- Helpers ---
const toISO = (v: any) => {
  try {
    if (!v) return ""
    if (typeof v === "string") return v
    if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000).toISOString()
    if (v instanceof Date) return v.toISOString()
    return String(v)
  } catch {
    return ""
  }
}

const canonicalStatus = (raw: any): Project["status"] => {
  const s = String(raw ?? "active").trim().toLowerCase().replace(/_/g, "-")
  if (s === "on hold" || s === "onhold") return "on-hold"
  if (s === "in-progress") return "active" // just in case
  if (["active", "planning", "on-hold", "completed"].includes(s)) return s as Project["status"]
  return "active"
}

const canonicalPriority = (raw: any): Project["priority"] => {
  const p = String(raw ?? "medium").trim().toLowerCase()
  if (["low", "medium", "high"].includes(p)) return p as Project["priority"]
  return "medium"
}

// Normalize backend → UI shape expected by card & filters
function normalize(p: any): Project {
  const dept =
    Array.isArray(p.department) && p.department.length > 0
      ? p.department[0]
      : typeof p.department === "string"
      ? p.department
      : ""

  const team =
    Array.isArray(p.team) && p.team.length
      ? p.team
      : Array.isArray(p.teamIds)
      ? p.teamIds.map((id: string) => ({ id, name: `User ${id.slice(0, 4)}` }))
      : []

  return {
    id: p.id,
    name: p.name ?? "Untitled",
    description: p.description ?? "",
    client: p.client ?? "",
    status: canonicalStatus(p.status),
    priority: canonicalPriority(p.priority),
    progress: Number(p.progress ?? 0),
    overduePercentage: Number(p.overduePercentage ?? 0),
    dueDate: toISO(p.dueDate),
    budget: p.budget,
    department: dept,
    team,
    tasks: Array.isArray(p.tasks) ? p.tasks : [],
    createdAt: toISO(p.createdAt),
    updatedAt: toISO(p.updatedAt),
  } as Project
}

export function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [employeeFilter, setEmployeeFilter] = useState<string>("all")
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  const [sortField, setSortField] = useState<SortField>("completion")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const data = await fetchProjects()
        setProjects(data.map(normalize))
      } catch (e: any) {
        setError(e?.message ?? "Failed to load projects")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // ---- Accurate counters (based on canonical statuses) ----
  const { activeCount, planningCount, onHoldCount, completedCount, medianDaysOverdue } = useMemo(() => {
    const active = projects.filter((p) => p.status === "active").length
    const planning = projects.filter((p) => p.status === "planning").length
    const onHold = projects.filter((p) => p.status === "on-hold").length
    const completed = projects.filter((p) => p.status === "completed").length

    const today = new Date()
    const overdueDays = projects
      .flatMap((project) => project.tasks ?? [])
      .filter((t: any) => t?.dueDate && t.status !== "completed" && new Date(t.dueDate) < today)
      .map((t: any) => Math.ceil((today.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      .sort((a: number, b: number) => a - b)

    const median =
      overdueDays.length === 0
        ? 0
        : overdueDays.length % 2
        ? overdueDays[Math.floor(overdueDays.length / 2)]
        : Math.round((overdueDays[overdueDays.length / 2 - 1] + overdueDays[overdueDays.length / 2]) / 2)

    return { activeCount: active, planningCount: planning, onHoldCount: onHold, completedCount: completed, medianDaysOverdue: median }
  }, [projects])

  // ---- Filters & sorting (unchanged logic, works with normalized data) ----
  const activeFilters = useMemo((): ActiveFilter[] => {
    const filters: ActiveFilter[] = []
    if (projectFilter !== "all") {
      const project = projects.find((p) => p.id === projectFilter)
      filters.push({ type: "project", value: projectFilter, label: `Project: ${project?.name || projectFilter}` })
    }
    if (departmentFilter !== "all") filters.push({ type: "department", value: departmentFilter, label: `Department: ${departmentFilter}` })
    if (employeeFilter !== "all") filters.push({ type: "employee", value: employeeFilter, label: `Employee: ${employeeFilter}` })
    if (taskStatusFilter !== "all") filters.push({ type: "taskStatus", value: taskStatusFilter, label: `Task Status: ${taskStatusFilter}` })
    if (dateRange?.from || dateRange?.to) {
      const fromStr = dateRange?.from ? format(dateRange.from, "MMM dd") : "Start"
      const toStr = dateRange?.to ? format(dateRange.to, "MMM dd") : "End"
      filters.push({ type: "dateRange", value: "dateRange", label: `Date: ${fromStr} - ${toStr}` })
    }
    return filters
  }, [projectFilter, departmentFilter, employeeFilter, taskStatusFilter, dateRange, projects])

  const filteredAndSortedProjects = useMemo(() => {
    const filtered = projects.filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (project.client ?? "").toLowerCase().includes(searchTerm.toLowerCase())

      const matchesProject = projectFilter === "all" || project.id === projectFilter
      const matchesDepartment = departmentFilter === "all" || project.department === departmentFilter
      const matchesEmployee =
        employeeFilter === "all" ||
        project.team?.some((m) => (m.name ?? "").toLowerCase().includes(employeeFilter.toLowerCase()))

      const matchesTaskStatus =
        taskStatusFilter === "all" || (project.tasks ?? []).some((t: any) => t.status === taskStatusFilter)

      // Date range (inclusive)
      const due = project.dueDate ? new Date(project.dueDate) : null
      const fromOk = dateRange?.from ? (due ? due >= dateRange.from : false) : true
      const toOk = dateRange?.to ? (due ? due <= dateRange.to : false) : true
      const matchesDateRange = fromOk && toOk

      return matchesSearch && matchesProject && matchesDepartment && matchesEmployee && matchesTaskStatus && matchesDateRange
    })

    filtered.sort((a, b) => {
      let aValue: number
      let bValue: number
      switch (sortField) {
        case "overdue":
          aValue = a.overduePercentage || 0
          bValue = b.overduePercentage || 0
          break
        case "completion":
          aValue = a.progress
          bValue = b.progress
          break
        case "deadline":
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
          break
        default:
          return 0
      }
      const result = aValue - bValue
      return sortOrder === "asc" ? result : -result
    })

    return filtered
  }, [projects, searchTerm, projectFilter, departmentFilter, employeeFilter, taskStatusFilter, dateRange, sortField, sortOrder])

  function removeFilterByType(type: ActiveFilter["type"]) {
    switch (type) {
      case "project": setProjectFilter("all"); break
      case "department": setDepartmentFilter("all"); break
      case "employee": setEmployeeFilter("all"); break
      case "taskStatus": setTaskStatusFilter("all"); break
      case "dateRange": setDateRange(undefined); break
    }
  }

  const clearAllFilters = () => {
    setProjectFilter("all")
    setDepartmentFilter("all")
    setEmployeeFilter("all")
    setTaskStatusFilter("all")
    setDateRange(undefined)
    setSearchTerm("")
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortOrder("asc") }
  }

  const getSortIcon = (field: SortField) =>
    sortField !== field ? <ArrowUpDown className="h-4 w-4" /> : (sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)

  // Loading / Error
  if (loading) return <div className="flex-1 overflow-auto p-6"><div className="h-64 grid place-items-center text-muted-foreground">Loading projects…</div></div>
  if (error)   return <div className="flex-1 overflow-auto p-6"><div className="h-64 grid place-items-center text-destructive">Error: {error}</div></div>

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Project Dashboard</h1>
            <p className="text-muted-foreground mt-1">Manage and track all your company projects</p>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Stats Overview (now accurate) */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-background rounded-lg p-4 border border-border">
            <p className="text-sm text-muted-foreground">Active Projects</p>
            <p className="text-2xl font-bold text-foreground">{activeCount}</p>
          </div>
          <div className="bg-background rounded-lg p-4 border border-border">
            <p className="text-sm text-muted-foreground">Planning</p>
            <p className="text-2xl font-bold text-foreground">{planningCount}</p>
          </div>
          <div className="bg-background rounded-lg p-4 border border-border">
            <p className="text-sm text-muted-foreground">On Hold</p>
            <p className="text-2xl font-bold text-foreground">{onHoldCount}</p>
          </div>
          <div className="bg-background rounded-lg p-4 border border-border">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-foreground">{completedCount}</p>
          </div>
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Median Days Overdue</p>
                <p className={`text-2xl font-bold ${medianDaysOverdue > 0 ? "text-destructive" : "text-foreground"}`}>{medianDaysOverdue}</p>
              </div>
              <TrendingDown className={`h-4 w-4 ${medianDaysOverdue > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {medianDaysOverdue === 0 ? "No overdue tasks" : "Across all projects"}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects or clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {[...new Set(projects.map((p) => p.department).filter(Boolean))].map((dept) => (
                    <SelectItem key={dept} value={dept as string}>{dept as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {[...new Set(projects.flatMap((p) => (p.team ?? []).map((t: any) => t.name)))].map((employee) => (
                    <SelectItem key={employee} value={employee}>{employee}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Task Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-start text-left font-normal bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange?.to ? (
                        <>
                          {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Date Range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[1000]">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from ?? new Date()}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {activeFilters.map((filter) => (
                <Badge key={`${filter.type}-${filter.value}`} variant="secondary" className="flex items-center gap-1">
                  {filter.label}
                  <button
                    type="button"
                    aria-label={`Remove ${filter.type} filter`}
                    className="rounded p-0.5 hover:text-destructive"
                    onClick={() => removeFilterByType(filter.type)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground hover:text-foreground">
                Clear all
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Button variant={sortField === "overdue" ? "default" : "ghost"} size="sm" onClick={() => handleSort("overdue")} className="flex items-center gap-1">
              Overdue % {getSortIcon("overdue")}
            </Button>
            <Button variant={sortField === "completion" ? "default" : "ghost"} size="sm" onClick={() => handleSort("completion")} className="flex items-center gap-1">
              Completion % {getSortIcon("completion")}
            </Button>
            <Button variant={sortField === "deadline" ? "default" : "ghost"} size="sm" onClick={() => handleSort("deadline")} className="flex items-center gap-1">
              Deadline {getSortIcon("deadline")}
            </Button>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-auto p-6">
        {filteredAndSortedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No matching projects found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAndSortedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
