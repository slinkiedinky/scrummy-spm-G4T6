"use client";

import { listProjects, createProject } from "@/lib/api";

import AuthGuard from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { useEffect, useMemo, useState } from "react";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Plus, TrendingDown, X, ArrowUpDown, ArrowUp, ArrowDown, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";


// normalize backend status -> UI status
function canonUiStatus(s = "") {
  const v = (s || "").toLowerCase();
  if (v === "doing") return "in progress";
  if (v === "done") return "completed";
  if (v === "to-do" || v === "todo") return "to-do";
  return v; // e.g., "blocked"
}

export default function ProjectsPage() {
  const [projectsRaw, setProjectsRaw] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState(undefined);

  const [sortField, setSortField] = useState("completion"); // "completion" | "deadline"
  const [sortOrder, setSortOrder] = useState("asc"); // "asc" | "desc"

  // fetch from Flask
  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await listProjects(); // GET /api/projects/
      setProjectsRaw(data);
      setProjects((data || []).map((p) => ({ ...p, status: canonUiStatus(p.status) })));
    } catch (e) {
      setError(e?.message ?? "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // metrics
  const { todoCount, inProgressCount, completedCount, blockedCount, medianDaysOverdue } = useMemo(() => {
    const todo = projects.filter((p) => p.status === "to-do").length;
    const inProgress = projects.filter((p) => p.status === "in progress").length;
    const completed = projects.filter((p) => p.status === "completed").length;
    const blocked = projects.filter((p) => p.status === "blocked").length;

    const today = new Date();
    const overdueDays = projects
      .flatMap((p) => p.tasks ?? [])
      .filter((t) => t?.dueDate && t.status !== "completed" && new Date(t.dueDate) < today)
      .map((t) => Math.ceil((today.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      .sort((a, b) => a - b);

    const median =
      overdueDays.length === 0
        ? 0
        : overdueDays.length % 2
        ? overdueDays[Math.floor(overdueDays.length / 2)]
        : Math.round((overdueDays[overdueDays.length / 2 - 1] + overdueDays[overdueDays.length / 2]) / 2);

    return { todoCount: todo, inProgressCount: inProgress, completedCount: completed, blockedCount: blocked, medianDaysOverdue: median };
  }, [projects]);

  // active filters display chips
  const activeFilters = useMemo(() => {
    const arr = [];
    if (projectFilter !== "all") {
      const p = projects.find((x) => x.id === projectFilter);
      arr.push({ type: "project", value: projectFilter, label: `Project: ${p?.name || projectFilter}` });
    }
    if (employeeFilter) {
      arr.push({ type: "employee", value: employeeFilter, label: `Employee: ${employeeFilter}` });
    }
    if (taskStatusFilter !== "all") {
      arr.push({ type: "taskStatus", value: taskStatusFilter, label: `Task Status: ${taskStatusFilter}` });
    }
    if (dateRange?.from || dateRange?.to) {
      const fromStr = dateRange?.from ? format(dateRange.from, "MMM dd") : "Start";
      const toStr = dateRange?.to ? format(dateRange.to, "MMM dd") : "End";
      arr.push({ type: "dateRange", value: "dateRange", label: `Date: ${fromStr} - ${toStr}` });
    }
    return arr;
  }, [projectFilter, employeeFilter, taskStatusFilter, dateRange, projects]);

  // filter + sort
  const filteredAndSortedProjects = useMemo(() => {
    const filtered = projects.filter((p) => {
      const matchesSearch =
        (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.client ?? "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesProject = projectFilter === "all" || p.id === projectFilter;

      const matchesEmployee =
        !employeeFilter ||
        p.teamIds?.some((m) => (m?.name ?? "").toLowerCase().includes(employeeFilter.toLowerCase()));

      const matchesTaskStatus =
        taskStatusFilter === "all" || (p.tasks ?? []).some((t) => t.status === taskStatusFilter);

      const due = p.dueDate ? new Date(p.dueDate) : null;
      const fromOk = dateRange?.from ? (due ? due >= dateRange.from : false) : true;
      const toOk = dateRange?.to ? (due ? due <= dateRange.to : false) : true;
      const matchesDate = fromOk && toOk;

      return matchesSearch && matchesProject && matchesEmployee && matchesTaskStatus && matchesDate;
    });

    filtered.sort((a, b) => {
      let av, bv;
      if (sortField === "completion") {
        av = a.progress ?? 0;
        bv = b.progress ?? 0;
      } else {
        av = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        bv = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      }
      const diff = av - bv;
      return sortOrder === "asc" ? diff : -diff;
    });

    return filtered;
  }, [projects, searchTerm, projectFilter, employeeFilter, taskStatusFilter, dateRange, sortField, sortOrder]);

  const removeFilterByType = (type) => {
    if (type === "project") setProjectFilter("all");
    else if (type === "employee") setEmployeeFilter("");
    else if (type === "taskStatus") setTaskStatusFilter("all");
    else if (type === "dateRange") setDateRange(undefined);
  };

  const clearAll = () => {
    setProjectFilter("all");
    setEmployeeFilter("");
    setTaskStatusFilter("all");
    setDateRange(undefined);
    setSearchTerm("");
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // create project (simple prompt)
  async function onCreateProject() {
    const name = window.prompt("Project name?");
    if (!name) return;
    await createProject({ name, status: "to-do", priority: "medium" });
    await load();
  }

  const sortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  // states
  if (loading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="h-64 grid place-items-center text-muted-foreground">Loading projects…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="h-64 grid place-items-center text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b border-border bg-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Project Dashboard</h1>
                </div>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onCreateProject}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-background rounded-lg p-4 border border-border">
                  <p className="text-sm text-muted-foreground">To Do</p>
                  <p className="text-2xl font-bold text-foreground">{todoCount}</p>
                </div>
                <div className="bg-background rounded-lg p-4 border border-border">
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold text-foreground">{inProgressCount}</p>
                </div>
                <div className="bg-background rounded-lg p-4 border border-border">
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-foreground">{completedCount}</p>
                </div>
                <div className="bg-background rounded-lg p-4 border border-border">
                  <p className="text-sm text-muted-foreground">Blocked</p>
                  <p className="text-2xl font-bold text-foreground">{blockedCount}</p>
                </div>
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search projects..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder="Employee name..."
                      value={employeeFilter}
                      onChange={(e) => setEmployeeFilter(e.target.value)}
                      className="w-[180px]"
                    />

                    <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Task Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="to-do">To Do</SelectItem>
                        <SelectItem value="in progress">In Progress</SelectItem>
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
                                ? <>
                                    {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                                  </>
                                : format(dateRange.from, "LLL dd, y"))
                            : <span>Date Range</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[1000]">
                        <Calendar
                          mode="range"
                          initialFocus
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
                    {activeFilters.map((f) => (
                      <Badge key={`${f.type}-${f.value}`} variant="secondary" className="flex items-center gap-1">
                        {f.label}
                        <button
                          aria-label={`Remove ${f.type} filter`}
                          className="rounded p-0.5 hover:text-destructive"
                          onClick={() => removeFilterByType(f.type)}
                        >
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
                  <Button
                    variant={sortField === "completion" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleSort("completion")}
                    className="flex items-center gap-1"
                  >
                    Completion % {sortIcon("completion")}
                  </Button>
                  <Button
                    variant={sortField === "deadline" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleSort("deadline")}
                    className="flex items-center gap-1"
                  >
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
                  {filteredAndSortedProjects.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
