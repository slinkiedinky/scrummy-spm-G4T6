"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { listProjects, createProject, listUsers } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  TrendingDown,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

/* ------------------- Constants ------------------- */

const PROJECT_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const COMPLETION_BUCKETS = [
  { value: "all", label: "Any %" },
  { value: "0-24", label: "0–24%" },
  { value: "25-49", label: "25–49%" },
  { value: "50-74", label: "50–74%" },
  { value: "75-99", label: "75–99%" },
  { value: "100", label: "100%" },
];

const priorityOrder = { low: 1, medium: 2, high: 3 };

/* ------------------- Helpers ------------------- */

const ensureProjectPriority = (value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (priorityOrder[normalized]) return normalized;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return ensureProjectPriority(parsed);
    return "medium";
  }
  if (typeof value === "number") {
    if (value >= 8) return "high";
    if (value <= 3) return "low";
    return "medium";
  }
  if (value && typeof value === "object" && "value" in value) {
    return ensureProjectPriority(value.value);
  }
  return "medium";
};

// normalize backend status -> UI status
function canonUiStatus(s = "") {
  const v = (s || "").toLowerCase();
  if (v === "doing") return "in progress";
  if (v === "done") return "completed";
  if (v === "to-do" || v === "todo") return "to-do";
  return v;
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function projectCompletion(p) {
  // prefer explicit numeric progress
  if (typeof p?.progress === "number" && !Number.isNaN(p.progress)) {
    return clamp(Math.round(p.progress), 0, 100);
  }
  // compute from tasks if present
  const tasks = p?.tasks ?? [];
  if (tasks.length > 0) {
    const done = tasks.filter((t) => canonUiStatus(t?.status) === "completed").length;
    return clamp(Math.round((done / tasks.length) * 100), 0, 100);
  }
  // fallback based on project status
  const s = canonUiStatus(p?.status);
  if (s === "completed") return 100;
  if (s === "to-do" || s === "blocked") return 0;
  return 50; // neutral for "in progress"/unknown
}

function inCompletionBucket(percent, bucketValue) {
  if (bucketValue === "all") return true;
  if (bucketValue === "100") return percent === 100;
  const [a, b] = bucketValue.split("-").map((x) => parseInt(x, 10));
  if (Number.isFinite(a) && Number.isFinite(b)) {
    return percent >= a && percent <= b;
  }
  return true;
}

/* ------------------- Page ------------------- */

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // Project/Task status
  const [completionFilter, setCompletionFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all"); // NEW

  const [sortField, setSortField] = useState("completion"); // "completion" | "deadline"
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectStatus, setNewProjectStatus] = useState("to-do");
  const [newProjectPriority, setNewProjectPriority] = useState("medium");
  const [newProjectMembers, setNewProjectMembers] = useState([]);
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState("");
  const [allUsers, setAllUsers] = useState([]);

  
  
  const load = useCallback(async (userId) => {
    if (!userId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await listProjects({ assignedTo: userId });
      setProjects(
        (data || []).map((p) => ({
          ...p,
          status: canonUiStatus(p.status),
          priority: ensureProjectPriority(p.priority),
        }))
      );
    } catch (e) {
      setError(e?.message ?? "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  const [memberQuery, setMemberQuery] = useState("");
// Whether the suggestion panel is visible (optional)
const [showMemberSuggestions, setShowMemberSuggestions] = useState(false);

// Add/remove helpers
const addMember = (user) => {
  setNewProjectMembers((prev) =>
    prev.includes(user.id) ? prev : [...prev, user.id]
  );
  setMemberQuery("");
  setShowMemberSuggestions(false);
};

const removeMember = (userId) => {
  setNewProjectMembers((prev) => prev.filter((id) => id !== userId));
};

// Derived list: users matching the query and not already selected
const filteredMemberOptions = useMemo(() => {
  const q = memberQuery.trim().toLowerCase();
  if (!q) return [];
  return (allUsers || [])
    .filter((u) =>
      [u.fullName, u.email].filter(Boolean).some((s) => s.toLowerCase().includes(q))
    )
    .filter((u) => !newProjectMembers?.includes(u.id))
    .slice(0, 8); // show up to 8 suggestions
}, [allUsers, memberQuery, newProjectMembers]);

// Convenience map to read full user records for selected ids
const selectedMemberRecords = useMemo(() => {
  const byId = Object.fromEntries((allUsers || []).map((u) => [u.id, u]));
  return (newProjectMembers || []).map((id) => byId[id]).filter(Boolean);
}, [allUsers, newProjectMembers]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setUserLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) {
      setProjects([]);
      setLoading(false);
      return;
    }
    load(currentUser.uid);
  }, [currentUser?.uid, load]);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const users = await listUsers();
        setAllUsers(users || []);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    }
    fetchUsers();
  }, []);
  
  const { todoCount, inProgressCount, completedCount, blockedCount, medianDaysOverdue } =
    useMemo(() => {
      const todo = projects.filter((p) => p.status === "to-do").length;
      const inProgress = projects.filter((p) => p.status === "in progress").length;
      const completed = projects.filter((p) => p.status === "completed").length;
      const blocked = projects.filter((p) => p.status === "blocked").length;

      const today = new Date();
      const overdueDays = projects
        .flatMap((p) => p.tasks ?? [])
        .filter((t) => t?.dueDate && t.status !== "completed" && new Date(t.dueDate) < today)
        .map((t) =>
          Math.ceil((today.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        )
        .sort((a, b) => a - b);

      const median =
        overdueDays.length === 0
          ? 0
          : overdueDays.length % 2
          ? overdueDays[Math.floor(overdueDays.length / 2)]
          : Math.round(
              (overdueDays[overdueDays.length / 2 - 1] + overdueDays[overdueDays.length / 2]) / 2
            );

      return {
        todoCount: todo,
        inProgressCount: inProgress,
        completedCount: completed,
        blockedCount: blocked,
        medianDaysOverdue: median,
      };
    }, [projects]);

  const activeFilters = useMemo(() => {
    const arr = [];
    if (projectFilter !== "all") {
      const p = projects.find((x) => x.id === projectFilter);
      
      arr.push({
        type: "project",
        value: projectFilter,
        label: `Project: ${p?.name || projectFilter}`,
      });
    }
    if (employeeFilter) {
      arr.push({ type: "employee", value: employeeFilter, label: `Employee: ${employeeFilter}` });
    }
   
    if (statusFilter !== "all") {
      arr.push({ type: "status", value: statusFilter, label: `Status: ${statusFilter}` });
    }

    if (completionFilter !== "all") {
      const label = COMPLETION_BUCKETS.find((b) => b.value === completionFilter)?.label ?? completionFilter;
      arr.push({ type: "completion", value: completionFilter, label: `Completion: ${label}` });
    }
    if (priorityFilter !== "all") {
      arr.push({ type: "priority", value: priorityFilter, label: `Priority: ${priorityFilter}` });
    }
    return arr;
  }, [projectFilter, employeeFilter, statusFilter, completionFilter, priorityFilter, projects]);

  const filteredAndSortedProjects = useMemo(() => {
    const filtered = projects.filter((p) => {
      const matchesSearch =
        (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.client ?? "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesProject = projectFilter === "all" || p.id === projectFilter;

      const matchesEmployee =
        !employeeFilter ||
        p.teamIds?.some((m) => {
          if (!m) return false;
          if (typeof m === "string") {
            return m.toLowerCase().includes(employeeFilter.toLowerCase());
          }
          return (m?.name ?? "").toLowerCase().includes(employeeFilter.toLowerCase());
        });

      
      // FIX: status filter now matches project status OR any task status
      const matchesStatus =
        statusFilter === "all" ||
        canonUiStatus(p.status) === statusFilter ||
        (p.tasks ?? []).some((t) => canonUiStatus(t.status) === statusFilter);

      const percent = projectCompletion(p);
      const matchesCompletion = inCompletionBucket(percent, completionFilter);

      const matchesPriority =
        priorityFilter === "all" || ensureProjectPriority(p.priority) === priorityFilter;

      return (
        matchesSearch &&
        matchesProject &&
        matchesEmployee &&
        matchesStatus &&
        matchesCompletion &&
        matchesPriority
      );
    });

    filtered.sort((a, b) => {
      let av, bv;
      if (sortField === "completion") {
        av = projectCompletion(a);
        bv = projectCompletion(b);
      } else {
        av = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        bv = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      }
      const diff = av - bv;
      return sortOrder === "asc" ? diff : -diff;
    });

    return filtered;
  }, [
    projects,
    searchTerm,
    projectFilter,
    employeeFilter,
    statusFilter,
    completionFilter,
    priorityFilter,
    sortField,
    sortOrder,
  ]);

  const removeFilterByType = (type) => {
    if (type === "project") setProjectFilter("all");
    else if (type === "employee") setEmployeeFilter("");
    else if (type === "status") setStatusFilter("all");
    else if (type === "completion") setCompletionFilter("all");
    else if (type === "priority") setPriorityFilter("all");
  };

  const clearAll = () => {
    setProjectFilter("all");
    setEmployeeFilter("");
    setStatusFilter("all");
    setCompletionFilter("all");
    setPriorityFilter("all");
    setSearchTerm("");
  };

  const handleSort = (field) => {
    if (sortField === field) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const resetCreateProjectForm = () => {
    setNewProjectName("");
    setNewProjectDescription("");
    setNewProjectStatus("to-do");
    setNewProjectPriority("medium");
    setNewProjectMembers([]);
  };

  const handleCreateDialogChange = (open) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setCreateProjectError("");
      setCreatingProject(false);
      resetCreateProjectForm();
    }
  };

  async function onCreateProject(e) {
    e.preventDefault();
    if (creatingProject) return;
    if (!newProjectName.trim()) {
      setCreateProjectError("Project name is required.");
      return;
    }
    if (!currentUser?.uid) {
      setCreateProjectError("You must be signed in to create a project.");
      return;
    }

    setCreatingProject(true);
    setCreateProjectError("");

    try {
      const teamIds = Array.from(new Set([currentUser.uid, ...newProjectMembers]));

      await createProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim(),
        status: newProjectStatus,
        priority: newProjectPriority,
        teamIds,
        ownerId: currentUser.uid,
      });
      await load(currentUser.uid);
      handleCreateDialogChange(false);
    } catch (e) {
      setCreateProjectError(e?.message ?? "Failed to create project.");
      setCreatingProject(false);
    }
  }

  const sortIcon = (field) =>
    sortField !== field ? (
      <ArrowUpDown className="h-4 w-4" />
    ) : sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );

  /* ------------------- Render ------------------- */

  if (userLoading) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="h-64 grid place-items-center text-muted-foreground">Loading user…</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="h-64 grid place-items-center text-muted-foreground">Loading projects…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="h-64 grid place-items-center text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={["Staff", "Manager"]}>
      <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogChange}>
        <DialogContent>
          <form onSubmit={onCreateProject} className="space-y-6">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>Set up the project details. You can adjust them later.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="project-name" className="text-sm font-medium text-foreground">
                  Project Name
                </label>
                <Input
                  id="project-name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter project name"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="project-description" className="text-sm font-medium text-foreground">
                  Description
                </label>
                <Textarea
                  id="project-description"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="Enter project description"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="project-status" className="text-sm font-medium text-foreground">
                    Status
                  </label>
                  <Select value={newProjectStatus} onValueChange={setNewProjectStatus}>
                    <SelectTrigger id="project-status" className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to-do">To Do</SelectItem>
                      <SelectItem value="in progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="project-priority" className="text-sm font-medium text-foreground">
                    Priority
                  </label>
                  <Select value={newProjectPriority} onValueChange={setNewProjectPriority}>
                    <SelectTrigger id="project-priority" className="w-full">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_PRIORITIES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Project members */}
              <div className="space-y-2">
                <label htmlFor="project-members" className="block text-sm font-medium text-gray-700">
                  Project members
                </label>

                {/* Search input */}
                <div className="relative">
                  <Input
                    id="project-members"
                    placeholder="Type a name or email…"
                    value={memberQuery}
                    onChange={(e) => {
                      setMemberQuery(e.target.value);
                      setShowMemberSuggestions(true);
                    }}
                    onFocus={() => setShowMemberSuggestions(true)}
                    onBlur={() => {
                      // tiny delay so a click on a suggestion still registers
                      setTimeout(() => setShowMemberSuggestions(false), 120);
                    }}
                    className="w-full"
                  />

                  {/* Autocomplete suggestions */}
                  {showMemberSuggestions && filteredMemberOptions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                      <ul className="max-h-60 overflow-auto py-1">
                        {filteredMemberOptions.map((u) => (
                          <li
                            key={u.id}
                            className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addMember(u)}
                          >
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                              {(u.fullName || u.email || "?")
                                .trim()
                                .slice(0, 1)
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-gray-900">
                                {u.fullName || u.email}
                              </div>
                              {u.email && (
                                <div className="truncate text-xs text-gray-500">{u.email}</div>
                              )}
                            </div>
                            <span className="ml-auto text-xs text-blue-600">Add</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Selected members as chips */}
                {selectedMemberRecords.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedMemberRecords.map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
                      >
                        <span className="font-medium">{u.fullName || u.email}</span>
                        <button
                          type="button"
                          onClick={() => removeMember(u.id)}
                          className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                          aria-label={`Remove ${u.fullName || u.email}`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Helper text */}
                <p className="text-xs text-gray-500">
                  Start typing to search by name or email. Click a suggestion to add. You can remove someone by clicking the × on a chip.
                </p>
              </div>


              {createProjectError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{createProjectError}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCreateDialogChange(false)}
                disabled={creatingProject}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creatingProject || !newProjectName.trim()}>
                {creatingProject ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col h-full bg-background">
        <div className="border-b border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-foreground">Project Dashboard</h1>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleCreateDialogChange(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>

          {/* KPI cards */}
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
                  <p
                    className={`text-2xl font-bold ${
                      medianDaysOverdue > 0 ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {medianDaysOverdue}
                  </p>
                </div>
                <TrendingDown
                  className={`h-4 w-4 ${
                    medianDaysOverdue > 0 ? "text-destructive" : "text-muted-foreground"
                  }`}
                />
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

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="to-do">To Do</SelectItem>
                    <SelectItem value="in progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={completionFilter} onValueChange={setCompletionFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Completion %" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPLETION_BUCKETS.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* NEW: Priority filter */}
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
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
    </RoleGuard>
  );
}