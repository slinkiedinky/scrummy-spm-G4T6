"use client"

import { useState, useMemo } from "react"
import { mockProjects } from "@/lib/mock-data"
import { ProjectCard } from "@/components/project-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, Plus, Filter, TrendingDown, X, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import type { Project } from "@/types/project"
import type { DateRange } from "react-day-picker"

type SortField = "overdue" | "completion" | "deadline"
type SortOrder = "asc" | "desc"

interface ActiveFilter {
  type: "project" | "department" | "employee" | "taskStatus" | "dateRange"
  value: string
  label: string
}

export function ProjectDashboard() {
  const [projects] = useState<Project[]>(mockProjects)
  const [searchTerm, setSearchTerm] = useState("")

  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [employeeFilter, setEmployeeFilter] = useState<string>("all")
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all")

  // date range + popover
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [dateOpen, setDateOpen] = useState(false)

  const [sortField, setSortField] = useState<SortField>("deadline")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  const activeFilters = useMemo((): ActiveFilter[] => {
    const filters: ActiveFilter[] = []
    if (projectFilter !== "all") {
      const project = projects.find((p) => p.id === projectFilter)
      filters.push({ type: "project", value: projectFilter, label: `Project: ${project?.name || projectFilter}` })
    }
    if (departmentFilter !== "all") {
      filters.push({ type: "department", value: departmentFilter, label: `Department: ${departmentFilter}` })
    }
    if (employeeFilter !== "all") {
      filters.push({ type: "employee", value: employeeFilter, label: `Employee: ${employeeFilter}` })
    }
    if (taskStatusFilter !== "all") {
      filters.push({ type: "taskStatus", value: taskStatusFilter, label: `Task Status: ${taskStatusFilter}` })
    }
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
        project.client?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesProject = projectFilter === "all" || project.id === projectFilter
      const matchesDepartment = departmentFilter === "all" || project.department === departmentFilter

      const matchesEmployee =
        employeeFilter === "all" ||
        project.team.some((member) => member.name.toLowerCase().includes(employeeFilter.toLowerCase()))

      const matchesTaskStatus =
        taskStatusFilter === "all" || project.tasks.some((task) => task.status === taskStatusFilter)

      const due = new Date(project.dueDate)
      const fromOk = dateRange?.from ? due >= dateRange.from : true
      const toOk = dateRange?.to ? due <= dateRange.to : true
      const matchesDateRange = fromOk && toOk

      return (
        matchesSearch && matchesProject && matchesDepartment && matchesEmployee && matchesTaskStatus && matchesDateRange
      )
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
          aValue = new Date(a.dueDate).getTime()
          bValue = new Date(b.dueDate).getTime()
          break
        default:
          return 0
      }
      const result = aValue - bValue
      return sortOrder === "asc" ? result : -result
    })

    return filtered
  }, [projects, searchTerm, projectFilter, departmentFilter, employeeFilter, taskStatusFilter, dateRange, sortField, sortOrder])

  const uniqueDepartments = useMemo(() => [...new Set(projects.map((p) => p.department).filter(Boolean))], [projects])
  const uniqueEmployees = useMemo(() => [...new Set(projects.flatMap((p) => p.team.map((t) => t.name)))], [projects])

  const removeFilter = (filterToRemove: ActiveFilter) => {
    switch (filterToRemove.type) {
      case "project":
        setProjectFilter("all")
        break
      case "department":
        setDepartmentFilter("all")
        break
      case "employee":
        setEmployeeFilter("all")
        break
      case "taskStatus":
        setTaskStatusFilter("all")
        break
      case "dateRange":
        setDateRange(undefined)
        break
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
    else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />
    return sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const getMedianDaysOverdue = () => {
    const today = new Date()
    const allOverdueTasks = projects
      .flatMap((project) => project.tasks)
      .filter((task) => task.status !== "completed" && new Date(task.dueDate) < today)
      .map((task) => Math.ceil((today.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      .sort((a, b) => a - b)

    if (allOverdueTasks.length === 0) return 0
    const middle = Math.floor(allOverdueTasks.length / 2)
    return allOverdueTasks.length % 2 === 0
      ? Math.round((allOverdueTasks[middle - 1] + allOverdueTasks[middle]) / 2)
      : allOverdueTasks[middle]
  }

  const medianDaysOverdue = getMedianDaysOverdue()

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

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {/* Active Projects — tag removed */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                <p className="text-2xl font-bold text-foreground">
                  {projects.filter((p) => p.status === "active").length}
                </p>
              </div>
            </div>
          </div>

          {/* Planning — tag removed */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Planning</p>
                <p className="text-2xl font-bold text-foreground">
                  {projects.filter((p) => p.status === "planning").length}
                </p>
              </div>
            </div>
          </div>

          {/* On Hold — left without a tag */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">On Hold</p>
                <p className="text-2xl font-bold text-foreground">
                  {projects.filter((p) => p.status === "on-hold").length}
                </p>
              </div>
            </div>
          </div>

          {/* Completed — tag removed */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-foreground">
                  {projects.filter((p) => p.status === "completed").length}
                </p>
              </div>
            </div>
          </div>

          {/* Median Days Overdue */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Median Days Overdue</p>
                <p className={`text-2xl font-bold ${medianDaysOverdue > 0 ? "text-destructive" : "text-foreground"}`}>
                  {medianDaysOverdue}
                </p>
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                  {uniqueDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {uniqueEmployees.map((employee) => (
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

              {/* Date Range (click to open calendar) */}
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[180px] justify-start text-left font-normal bg-transparent"
                    onClick={() => setDateOpen((o) => !o)}
                  >
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
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from ?? new Date()}
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range)
                      if (range?.from && range?.to) setDateOpen(false)
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {activeFilters.map((filter, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {filter.label}
                  <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removeFilter(filter)} />
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
