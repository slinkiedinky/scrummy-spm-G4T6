"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { TaskDetailModal } from "@/components/TaskDetailModal";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, RefreshCw } from "lucide-react";

import { auth } from "@/lib/firebase";
import { listAssignedTasks } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";
const STATUS_COLUMNS = [
  { id: "to-do", title: "To Do", status: "to-do" },
  { id: "in progress", title: "In Progress", status: "in progress" },
  { id: "completed", title: "Completed", status: "completed" },
  { id: "blocked", title: "Blocked", status: "blocked" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priority" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  if (typeof value === "object" && "seconds" in value) return new Date(value.seconds * 1000);
  return null;
};

const statusBadgeClasses = {
  "to-do": "bg-blue-400 text-white",
  "in progress": "bg-yellow-400 text-black",
  completed: "bg-green-400 text-white",
  blocked: "bg-muted text-muted-foreground",
};

const priorityBadgeClasses = {
  low: "bg-green-100 text-green-700 border border-green-200",
  medium: "bg-yellow-400 text-white border border-yellow-400",
  high: "bg-red-100 text-red-700 border border-red-200",
};

const statusLabel = (status) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ") : "Unknown";

const priorityLabel = (priority) =>
  priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : "N/A";

async function fetchUserById(id) {
  if (!id) return null;
  try {
    const res = await fetch(`${API_BASE}/users/${id}`);
    if (!res.ok) throw new Error("Failed to fetch user");
    return await res.json();
  } catch (err) {
    console.error("Error fetching user", err);
    return null;
  }
}

export default function TasksPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const [selectedTask, setSelectedTask] = useState(null);

  const loadTasks = useCallback(async (uid) => {
    if (!uid) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await listAssignedTasks({ assignedTo: uid });
      setTasks(
        (data || []).map((t) => {
          const projectId = t.projectId || "unassigned";
          const projectName = t.projectName || (projectId === "unassigned" ? "Unassigned Project" : projectId);
          return {
            ...t,
            projectId,
            projectName,
            status: (t.status || "").toLowerCase(),
            priority: (t.priority || "").toLowerCase(),
            tags: Array.isArray(t.tags) ? t.tags : [],
          };
        })
      );
    } catch (err) {
      setTasks([]);
      setError(err?.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setUserLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) {
      setTasks([]);
      setLoading(false);
      return;
    }
    loadTasks(currentUser.uid);
  }, [currentUser?.uid, loadTasks]);

  const projectsList = useMemo(() => {
    const unique = new Map();
    tasks.forEach((task) => {
      const id = task.projectId || "unassigned";
      const name = task.projectName || (id === "unassigned" ? "Unassigned Project" : id);
      if (!unique.has(id)) {
        unique.set(id, { id, name });
      }
    });
    return Array.from(unique.values());
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesSearch =
        !search ||
        (task.title || "").toLowerCase().includes(search) ||
        (task.description || "").toLowerCase().includes(search) ||
        (task.projectName || "").toLowerCase().includes(search);

      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesProject = projectFilter === "all" || task.projectId === projectFilter;

      return matchesSearch && matchesPriority && matchesStatus && matchesProject;
    });
  }, [tasks, searchTerm, priorityFilter, statusFilter, projectFilter]);

  const statusOrder = useMemo(
    () => STATUS_COLUMNS.map((column) => column.status),
    []
  );

  const tasksByProject = useMemo(() => {
    const map = new Map();

    filteredTasks.forEach((task) => {
      const id = task.projectId || "unassigned";
      if (!map.has(id)) {
        map.set(id, {
          projectId: id,
          projectName: task.projectName || (id === "unassigned" ? "Unassigned Project" : id),
          tasks: [],
        });
      }
      map.get(id).tasks.push(task);
    });

    const orderForStatus = (status) => {
      const idx = statusOrder.indexOf(status);
      return idx === -1 ? statusOrder.length : idx;
    };

    return Array.from(map.values())
      .map((entry) => {
        const sortedTasks = entry.tasks.slice().sort((a, b) => {
          const statusDiff = orderForStatus(a.status) - orderForStatus(b.status);
          if (statusDiff !== 0) return statusDiff;
          const dueA = toDate(a.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
          const dueB = toDate(b.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
          if (dueA !== dueB) return dueA - dueB;
          return (a.title || "").localeCompare(b.title || "");
        });
        return { ...entry, tasks: sortedTasks };
      })
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [filteredTasks, statusOrder]);

  const totalTasks = tasks.length;
  const overdueTasks = tasks.filter((task) => {
    const due = toDate(task.dueDate);
    return due && due < new Date() && task.status !== "completed";
  });

  const handleTaskClick = useCallback(async (task) => {
    if (!task) return;
    const assigneeId = task.assigneeId || task.ownerId;
    const hydrated = { ...task };

    if (assigneeId) {
      const user = await fetchUserById(assigneeId);
      if (user) {
        hydrated.assignee = user;
      }
    }

    setSelectedTask(hydrated);
  }, []);

  const handleRefresh = () => {
    if (currentUser?.uid) {
      loadTasks(currentUser.uid);
    }
  };

  if (userLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="h-64 grid place-items-center text-muted-foreground">Validating session…</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="h-64 grid place-items-center text-muted-foreground">Loading your tasks…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border p-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">My Tasks</h2>
            <p className="text-sm text-muted-foreground">Tasks assigned to {currentUser?.displayName || currentUser?.email}</p>
          </div>
          <Button variant="outline" onClick={handleRefresh} className="self-start lg:self-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total tasks</p>
            <p className="text-2xl font-semibold text-foreground">{totalTasks}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className={`text-2xl font-semibold ${overdueTasks.length ? "text-destructive" : "text-foreground"}`}>
              {overdueTasks.length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Active projects</p>
            <p className="text-2xl font-semibold text-foreground">{projectsList.length}</p>
          </Card>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, description, or project…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_COLUMNS.map((option) => (
                <SelectItem key={option.id} value={option.status}>
                  {option.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full lg:w-[220px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projectsList.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tasksByProject.length === 0 ? (
          <div className="h-full grid place-items-center text-center text-muted-foreground">
            <div>
              <p className="text-lg font-semibold">No tasks found</p>
              <p className="text-sm">Try adjusting your filters or search.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {tasksByProject.map((project) => (
              <Card key={project.projectId} className="gap-0">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {project.projectName}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {project.projectId === "unassigned"
                          ? "Tasks not linked to a project"
                          : `Project ID: ${project.projectId}`}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {project.tasks.length} task{project.tasks.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-6">
                  <div className="space-y-3">
                    {project.tasks.map((task) => {
                      const due = toDate(task.dueDate);
                      const updated = toDate(task.updatedAt);
                      const overdue = due && due < new Date() && task.status !== "completed";
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => handleTaskClick(task)}
                          className="w-full text-left rounded-lg border border-border bg-background/50 p-4 transition hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {task.title || "Untitled task"}
                              </p>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                            </div>
                            <Badge className={statusBadgeClasses[task.status] || "bg-muted text-muted-foreground"}>
                              {statusLabel(task.status)}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <Badge
                              className={priorityBadgeClasses[task.priority] || "bg-muted text-muted-foreground"}
                              variant="outline"
                            >
                              {priorityLabel(task.priority)} Priority
                            </Badge>
                            <span className={overdue ? "text-destructive font-medium" : ""}>
                              Due: {due ? due.toLocaleDateString() : "—"}
                            </span>
                            <span>Updated: {updated ? updated.toLocaleDateString() : "—"}</span>
                            {task.tags?.length > 0 && (
                              <span>Tags: {task.tags.join(", ")}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
