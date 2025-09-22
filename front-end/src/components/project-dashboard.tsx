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
import type { Project, TeamMember } from "@/types/project"

type SortField = "overdue" | "completion" | "deadline"
type SortOrder = "asc" | "desc"

interface ActiveFilter {
  type: "project" | "department" | "employee" | "taskStatus" | "dateRange"
  value: string
  label: string
}

/** Use Flask directly if NEXT_PUBLIC_API_BASE_URL is set; otherwise fall back to Next.js /api proxy. */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || ""
const apiUrl = (p: string) => (API_BASE ? `${API_BASE}${p}` : p) // p should start with /api

// ---------- helpers ----------
const toISO = (v: any) => {
  try {
    if (!v) return ""
    if (typeof v === "string") return v
    if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000).toISOString()
    if (v instanceof Date) return v.toISOString()
    return String(v)
  } catch { return "" }
}

const canonicalStatus = (raw: any): Project["status"] => {
  const s = String(raw ?? "active").trim().toLowerCase().replace(/_/g, "-")
  if (s === "on hold" || s === "onhold") return "on-hold"
  return (["active", "planning", "on-hold", "completed"].includes(s) ? s : "active") as Project["status"]
}
const canonicalPriority = (raw: any): Project["priority"] => {
  const p = String(raw ?? "medium").trim().toLowerCase()
  return (["low", "medium", "high", "urgent"].includes(p) ? p : "medium") as Project["priority"]
}

function normalize(raw: any): Project {
  const dept = Array.isArray(raw.department) ? (raw.department[0] ?? "") : (raw.department ?? "")
  const team: TeamMember[] = Array.isArray(raw.team) ? raw.team : []
  return {
    id: raw.id,
    name: raw.name ?? "Untitled",
    description: raw.description ?? "",
    client: raw.client ?? "",
    status: canonicalStatus(raw.status),
    priority: canonicalPriority(raw.priority),
    progress: Number(raw.progress ?? raw.completionPercentage ?? 0),
    completionPercentage: Number(raw.completionPercentage ?? raw.progress ?? 0),
    overduePercentage: Number(raw.overduePercentage ?? 0),
    riskLevel: (raw.riskLevel ?? "low") as Project["riskLevel"],
    medianDaysOverdue: Number(raw.medianDaysOverdue ?? 0),
    dueDate: toISO(raw.dueDate),
    budget: raw.budget,
    department: dept,
    team,
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    createdAt: toISO(raw.createdAt),
    updatedAt: toISO(raw.updatedAt),
  } as Project
}

/** Collect member ids we need to hydrate names for (from team[] or a raw teamIds array). */
function memberIds(raw: any, normalized: Project): string[] {
  const fromTeam = (normalized.team ?? []).map((m) => m.id).filter(Boolean)
  const rawIds = Array.isArray(raw.teamIds) ? raw.teamIds : []
  return Array.from(new Set([...rawIds, ...fromTeam]))
}

async function fetchUsersMap(ids: string[]) {
  if (!ids.length) return {} as Record<string, any>
  const res = await fetch(apiUrl(`/api/users?ids=${encodeURIComponent(ids.join(","))}`), { cache: "no-store" })
  if (!res.ok) return {}
  const arr = await res.json()
  const map: Record<string, any> = {}
  for (const u of arr) map[u.id] = u
  return map
}

// ---------- component ----------
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

        // 1) Get projects
        const pres = await fetch(apiUrl("/api/projects"), { cache: "no-store" })
        if (!pres.ok) throw new Error("Failed to fetch projects")
        const rawList: any[] = await pres.json()

        // 2) Normalize
        let normalized = rawList.map(normalize)

        // 3) Gather all ids that still need names/roles
        const need = new Set<string>()
        normalized.forEach((p, idx) => {
          const ids = memberIds(rawList[idx], p)
          const placeholders = (p.team ?? []).some(m => !m.name || m.name.startsWith("User ") || m.role === "Member")
          if (!p.team?.length || placeholders) ids.forEach(id => need.add(id))
        })

        // 4) Hydrate names/roles via /api/users
        let userMap: Record<string, any> = {}
        if (need.size) userMap = await fetchUsersMap(Array.from(need))

        normalized = normalized.map((p, idx) => {
          const raw = rawList[idx]
          let team: TeamMember[] = Array.isArray(p.team) ? p.team : []
          const ids = team.length ? team.map(m => m.id) : memberIds(raw, p)

          if (!team.length) {
            team = ids.map((id) => {
              const u = userMap[id] || {}
              return {
                id,
                name: u.name || `User ${String(id).slice(0, 4)}`,
                role: u.role || "Member",
                email: u.email || "",
                avatar: u.avatar || "",
                department: p.department || "General",
              }
            })
          } else {
            team = team.map((m) => {
              const u = userMap[m.id]
              return u ? { ...m, name: u.name || m.name, role: u.role || m.role, email: u.email || m.email, avatar: u.avatar || m.avatar } : m
            })
          }
          return { ...p, team }
        })

        setProjects(normalized)
      } catch (e: any) {
        setError(e?.message ?? "Failed to load projects")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // ---- top metrics (accurate) ----
  const { activeCount, planningCount, onHoldCount, completedCount, medianDaysOverdue } = useMemo(() => {
    const active = projects.filter((p) => p.status === "active").length
    const planning = projects.filter((p) => p.status === "planning").length
    const onHold = projects.filter((p) => p.status === "on-hold").length
    const completed = projects.filter((p) => p.status === "completed").length

    const today = new Date()
    const overdueDays = projects
      .flatMap((p) => p.tasks ?? [])
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

  // ---- filters & sorting ----
  const activeFilters = useMemo((): ActiveFilter[] => {
    const arr: ActiveFilter[] = []
    if (projectFilter !== "all") {
      const p = projects.find((x) => x.id === projectFilter)
      arr.push({ type: "project", value: projectFilter, label: `Project: ${p?.name || projectFilter}` })
    }
    if (departmentFilter !== "all") arr.push({ type: "department", value: departmentFilter, label: `Department: ${departmentFilter}` })
    if (employeeFilter !== "all") arr.push({ type: "employee", value: employeeFilter, label: `Employee: ${employeeFilter}` })
    if (taskStatusFilter !== "all") arr.push({ type: "taskStatus", value: taskStatusFilter, label: `Task Status: ${taskStatusFilter}` })
    if (dateRange?.from || dateRange?.to) {
      const fromStr = dateRange?.from ? format(dateRange.from, "MMM dd") : "Start"
      const toStr = dateRange?.to ? format(dateRange.to, "MMM dd") : "End"
      arr.push({ type: "dateRange", value: "dateRange", label: `Date: ${fromStr} - ${toStr}` })
    }
    return arr
  }, [projectFilter, departmentFilter, employeeFilter, taskStatusFilter, dateRange, projects])

  const filteredAndSortedProjects = useMemo(() => {
    const filtered = projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.client ?? "").toLowerCase().includes(searchTerm.toLowerCase())

      const matchesProject = projectFilter === "all" || p.id === projectFilter
      const matchesDepartment = departmentFilter === "all" || p.department === departmentFilter
      const matchesEmployee =
        employeeFilter === "all" ||
        p.team?.some((m) => (m.name ?? "").toLowerCase().includes(employeeFilter.toLowerCase()))
      const matchesTaskStatus =
        taskStatusFilter === "all" || (p.tasks ?? []).some((t: any) => t.status === taskStatusFilter)

      // Date range (inclusive)
      const due = p.dueDate ? new Date(p.dueDate) : null
      const fromOk = dateRange?.from ? (due ? due >= dateRange.from : false) : true
      const toOk = dateRange?.to ? (due ? due <= dateRange.to : false) : true
      const matchesDate = fromOk && toOk

      return matchesSearch && matchesProject && matchesDepartment && matchesEmployee && matchesTaskStatus && matchesDate
    })

    filtered.sort((a, b) => {
      let av: number, bv: number
      if (sortField === "overdue") { av = a.overduePercentage ?? 0; bv = b.overduePercentage ?? 0 }
      else if (sortField === "completion") { av = a.completionPercentage ?? a.progress ?? 0; bv = b.completionPercentage ?? b.progress ?? 0 }
      else { av = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY; bv = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY }
      const diff = av - bv
      return sortOrder === "asc" ? diff : -diff
    })

    return filtered
  }, [projects, searchTerm, projectFilter, departmentFilter, employeeFilter, taskStatusFilter, dateRange, sortField, sortOrder])

  const removeFilterByType = (t: ActiveFilter["type"]) => {
    if (t === "project") setProjectFilter("all")
    else if (t === "department") setDepartmentFilter("all")
    else if (t === "employee") setEmployeeFilter("all")
    else if (t === "taskStatus") setTaskStatusFilter("all")
    else if (t === "dateRange") setDateRange(undefined)
  }

  const clearAll = () => {
    setProjectFilter("all")
    setDepartmentFilter("all")
    setEmployeeFilter("all")
    setTaskStatusFilter("all")
    setDateRange(undefined)
    setSearchTerm("")
  }

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
    else { setSortField(f); setSortOrder("asc") }
  }
  const sortIcon = (f: SortField) => sortField !== f ? <ArrowUpDown className="h-4 w-4" /> : (sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)

  // ---- render ----
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

        {/* Stats (accurate) */}
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
              <Input placeholder="Search projects or clients..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {[...new Set(projects.map((p) => p.department).filter(Boolean))].map((d) => (
                    <SelectItem key={String(d)} value={String(d)}>{String(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Employee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {[...new Set(projects.flatMap((p) => (p.team ?? []).map((m) => m.name)).filter(Boolean))].map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Task Status" /></SelectTrigger>
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
                    {dateRange?.from
                      ? (dateRange?.to
                          ? <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}</>
                          : format(dateRange.from, "LLL dd, y"))
                      : <span>Date Range</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[1000]">
                  <Calendar mode="range" initialFocus defaultMonth={dateRange?.from ?? new Date()} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {activeFilters.map((f) => (
                <Badge key={`${f.type}-${f.value}`} variant="secondary" className="flex items-center gap-1">
                  {f.label}
                  <button aria-label={`Remove ${f.type} filter`} className="rounded p-0.5 hover:text-destructive" onClick={() => removeFilterByType(f.type)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground hover:text-foreground">
                Clear all
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Button variant={sortField === "overdue" ? "default" : "ghost"} size="sm" onClick={() => handleSort("overdue")} className="flex items-center gap-1">
              Overdue % {sortIcon("overdue")}
            </Button>
            <Button variant={sortField === "completion" ? "default" : "ghost"} size="sm" onClick={() => handleSort("completion")} className="flex items-center gap-1">
              Completion % {sortIcon("completion")}
            </Button>
            <Button variant={sortField === "deadline" ? "default" : "ghost"} size="sm" onClick={() => handleSort("deadline")} className="flex items-center gap-1">
              Deadline {sortIcon("deadline")}
            </Button>
          </div>
        </div>
      </div>

      {/* Grid */}
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
            {filteredAndSortedProjects.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
