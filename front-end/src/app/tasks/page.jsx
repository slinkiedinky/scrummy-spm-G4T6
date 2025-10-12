"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { TaskDetailModal } from "@/components/TaskDetailModal";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, RefreshCw, AlertCircle, Trash2 } from "lucide-react";

import { auth } from "@/lib/firebase";
import {
  listAssignedTasks,
  listUsers,
  updateTask,
  deleteTask,
  getTask,
} from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined && item !== null);
  }
  if (value === undefined || value === null) return [];
  return [value];
};

const fallbackUserLabel = (id, index = 0) => {
  const raw = String(id ?? "").trim();
  if (raw) {
    return `User ${raw.slice(0, 4)}`;
  }
  const suffix = Number.isFinite(index) ? index + 1 : "?";
  return `User ${suffix}`;
};

const STATUS_COLUMNS = [
  { id: "to-do", title: "To-Do", status: "to-do" },
  { id: "in progress", title: "In Progress", status: "in progress" },
  { id: "completed", title: "Completed", status: "completed" },
  { id: "blocked", title: "Blocked", status: "blocked" },
];

const STATUS = STATUS_COLUMNS.map((column) => column.status);

const PRIORITY_VALUES = Array.from({ length: 10 }, (_, i) => String(i + 1));
const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priority" },
  ...PRIORITY_VALUES.map((value) => ({ value, label: `Priority ${value}` })),
];

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number")
    return new Date(value);
  if (typeof value === "object" && "seconds" in value)
    return new Date(value.seconds * 1000);
  return null;
};

const TAG_BASE =
  "rounded-full px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1";

const getStatusBadgeClass = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "to-do" || s === "todo")
    return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
  if (s === "in progress" || s === "in-progress")
    return `${TAG_BASE} bg-blue-100 text-blue-700 border border-blue-200`;
  if (s === "completed" || s === "done")
    return `${TAG_BASE} bg-emerald-100 text-emerald-700 border border-emerald-200`;
  if (s === "blocked")
    return `${TAG_BASE} bg-red-100 text-red-700 border border-red-200`;
  return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`; // fallback
};

const getPriorityBadgeClass = (priority) => {
  const value = Number(priority);
  if (!Number.isFinite(value)) {
    return `${TAG_BASE} bg-muted text-muted-foreground border border-border/50`;
  }
  if (value >= 8) {
    return `${TAG_BASE} bg-red-100 text-red-700 border border-red-200`;
  }
  if (value >= 5) {
    return `${TAG_BASE} bg-yellow-100 text-yellow-700 border border-yellow-200`;
  }
  return `${TAG_BASE} bg-emerald-100 text-emerald-700 border border-emerald-200`;
};

const statusLabel = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "to-do" || s === "todo") return "To-Do";
  if (s === "in progress" || s === "in-progress") return "In Progress";
  if (s === "completed" || s === "done") return "Completed";
  if (s === "blocked") return "Blocked";
  return "Unknown";
};

const priorityLabel = (priority) =>
  priority ? `Priority ${priority}` : "Priority —";

const toDateInputValue = (value) => {
  const date = toDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
};

export default function TasksPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    status: "to-do",
    priority: "5",
    dueDate: "",
  });
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
          const projectName =
            t.projectName ||
            (projectId === "unassigned" ? "Unassigned Project" : projectId);
          const priorityNumber = Number(t.priority);
          const priority = Number.isFinite(priorityNumber)
            ? String(priorityNumber)
            : "";
          return {
            ...t,
            projectId,
            projectName,
            status: (t.status || "").toLowerCase(),
            priority,
            priorityNumber: Number.isFinite(priorityNumber)
              ? priorityNumber
              : null,
            tags: Array.isArray(t.tags) ? t.tags : [],
            collaboratorsIds: ensureArray(t.collaboratorsIds),
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
      setUsers([]);
      setUsersLoading(false);
      setUsersError("");
      return;
    }
    loadTasks(currentUser.uid);
  }, [currentUser?.uid, loadTasks]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setUsers([]);
      setUsersLoading(false);
      setUsersError("");
      return;
    }

    let active = true;
    setUsersLoading(true);
    setUsersError("");

    (async () => {
      try {
        const data = await listUsers();
        if (!active) return;
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!active) return;
        setUsers([]);
        setUsersError(err?.message || "Failed to load users");
      } finally {
        if (active) {
          setUsersLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser?.uid]);

  const userLookup = useMemo(() => {
    const map = new Map();
    (users || []).forEach((user) => {
      if (!user || !user.id) return;
      const key = String(user.id).trim();
      if (!key) return;
      map.set(key, user);
    });
    return map;
  }, [users]);

  const summarizeUser = useCallback(
    (id) => {
      if (id === undefined || id === null) return null;
      const key = String(id).trim();
      if (!key) return null;
      const info = userLookup.get(key);
      if (!info) {
        return {
          id: key,
          name: fallbackUserLabel(key),
          email: "",
          role: "",
          avatar: "",
        };
      }
      const nameCandidate = [
        info.fullName,
        info.displayName,
        info.name,
        info.email,
        key,
      ].find((value) => typeof value === "string" && value.trim());
      return {
        id: key,
        name: nameCandidate ? nameCandidate.trim() : fallbackUserLabel(key),
        email: typeof info.email === "string" ? info.email : "",
        role: typeof info.role === "string" ? info.role : "",
        avatar: info.avatar || info.photoURL || "",
      };
    },
    [userLookup]
  );

  const resolveUserLabel = useCallback(
    (id) => {
      const summary = summarizeUser(id);
      return summary?.name || "";
    },
    [summarizeUser]
  );

  const projectsList = useMemo(() => {
    const unique = new Map();
    tasks.forEach((task) => {
      const id = task.projectId || "unassigned";
      const name =
        task.projectName || (id === "unassigned" ? "Unassigned Project" : id);
      if (!unique.has(id)) {
        unique.set(id, { id, name });
      }
    });
    return Array.from(unique.values());
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return tasks
      .filter((task) => {
        const matchesSearch =
          !search ||
          (task.title || "").toLowerCase().includes(search) ||
          (task.description || "").toLowerCase().includes(search) ||
          (task.projectName || "").toLowerCase().includes(search);

        const matchesPriority =
          priorityFilter === "all" || task.priority === priorityFilter;
        const matchesStatus =
          statusFilter === "all" || task.status === statusFilter;
        const matchesProject =
          projectFilter === "all" || task.projectId === projectFilter;

        return (
          matchesSearch && matchesPriority && matchesStatus && matchesProject
        );
      })
      .map((task) => {
        const collaboratorIds = ensureArray(task.collaboratorsIds);
        const dedupedCollaboratorIds = Array.from(
          new Set(
            collaboratorIds.filter(
              (id) => id !== undefined && id !== null && String(id).trim()
            )
          )
        ).map((id) => String(id).trim());

        const collaboratorSummaries = dedupedCollaboratorIds.map(
          (id, index) => {
            const summary = summarizeUser(id);
            if (summary) return summary;
            return {
              id,
              name: fallbackUserLabel(id, index),
              email: "",
              role: "",
              avatar: "",
            };
          }
        );

        const assigneeSummary = summarizeUser(task.assigneeId || task.ownerId);

        return {
          ...task,
          assigneeSummary,
          collaboratorIds: dedupedCollaboratorIds,
          collaboratorSummaries,
          collaboratorNames: collaboratorSummaries.map((item) => item.name),
        };
      });
  }, [
    tasks,
    searchTerm,
    priorityFilter,
    statusFilter,
    projectFilter,
    summarizeUser,
  ]);

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
          projectName:
            task.projectName ||
            (id === "unassigned" ? "Unassigned Project" : id),
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
          const statusDiff =
            orderForStatus(a.status) - orderForStatus(b.status);
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

  const resolveTaskRecord = useCallback(
    (task) => {
      if (!task) return null;
      const match = tasks.find(
        (entry) => entry.id === task.id && entry.projectId === task.projectId
      );
      return match || task;
    },
    [tasks]
  );

  const handleTaskClick = useCallback(
    (task) => {
      if (!task) return;

      const resolved = resolveTaskRecord(task) || task;
      const assigneeSummary = summarizeUser(
        resolved.assigneeId || resolved.ownerId
      );

      const sourceCollaborators =
        Array.isArray(resolved.collaboratorSummaries) &&
        resolved.collaboratorSummaries.length > 0
          ? resolved.collaboratorSummaries
          : (Array.isArray(resolved.collaboratorIds)
              ? resolved.collaboratorIds
              : ensureArray(resolved.collaboratorsIds)
            ).map(
              (id, index) =>
                summarizeUser(id) || {
                  id: String(id ?? ""),
                  name: fallbackUserLabel(id, index),
                  email: "",
                  role: "",
                  avatar: "",
                }
            );

      const collaborators = [];
      const seen = new Set();
      sourceCollaborators.forEach((item, index) => {
        if (!item) return;
        const key = String(item.id ?? index);
        if (!key || seen.has(key)) return;
        seen.add(key);
        collaborators.push({
          id: key,
          name: item.name || fallbackUserLabel(key, index),
          email: item.email || "",
          role: item.role || "",
          avatar: item.avatar || "",
        });
      });

      const creatorSummary = summarizeUser(resolved.createdBy);

      setSelectedTask({
        ...resolved,
        assigneeSummary: assigneeSummary || undefined,
        creatorSummary: creatorSummary || undefined,
        collaborators,
      });
    },
    [resolveTaskRecord, summarizeUser]
  );

  const openEditDialog = useCallback(
    (task) => {
      const base = resolveTaskRecord(task);
      if (!base) return;
      setEditingTask(base);
      setEditForm({
        title: base.title || "",
        description: base.description || "",
        status: (base.status || "to-do").toLowerCase(),
        priority:
          base.priority ||
          (Number.isFinite(base.priorityNumber)
            ? String(base.priorityNumber)
            : "5"),
        dueDate: toDateInputValue(base.dueDate),
      });
      setEditError("");
      setSavingEdit(false);
      setIsEditDialogOpen(true);
    },
    [resolveTaskRecord]
  );

  const closeEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setEditingTask(null);
    setEditError("");
    setSavingEdit(false);
  }, []);

  const handleEditFieldChange = useCallback((field, value) => {
    setEditForm((previous) => ({ ...previous, [field]: value }));
  }, []);

  const handleEditSubmit = useCallback(
    async (event) => {
      event?.preventDefault();
      if (!editingTask || !currentUser?.uid) {
        return;
      }

      const title = editForm.title.trim();
      if (!title) {
        setEditError("Task title is required.");
        return;
      }

      const priorityNumber = Number(editForm.priority);
      if (!Number.isFinite(priorityNumber)) {
        setEditError("Priority must be a number between 1 and 10.");
        return;
      }
      const clampedPriority = Math.min(
        10,
        Math.max(1, Math.round(priorityNumber))
      );

      setSavingEdit(true);
      setEditError("");

      try {
        const payload = {
          title,
          description: editForm.description.trim(),
          status: editForm.status || "to-do",
          priority: clampedPriority,
        };

        if (editForm.dueDate) {
          const due = new Date(`${editForm.dueDate}T00:00:00`);
          if (Number.isNaN(due.getTime())) {
            setEditError("Please provide a valid due date.");
            setSavingEdit(false);
            return;
          }
          payload.dueDate = due.toISOString();
        } else {
          payload.dueDate = null;
        }

        await updateTask(editingTask.projectId, editingTask.id, payload);
        await loadTasks(currentUser.uid);
        closeEditDialog();
        setSelectedTask(null);
      } catch (err) {
        setEditError(err?.message || "Failed to update task.");
        setSavingEdit(false);
      }
    },
    [editingTask, editForm, currentUser?.uid, loadTasks, closeEditDialog]
  );

  const requestDeleteTask = useCallback(
    (task) => {
      const base = resolveTaskRecord(task);
      if (!base) return;
      setDeleteCandidate(base);
      setDeleteError("");
      setIsDeleteDialogOpen(true);
    },
    [resolveTaskRecord]
  );

  const closeDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setDeleteCandidate(null);
    setDeleteError("");
    setDeletingTaskId("");
  }, []);

  const confirmDeleteTask = useCallback(async () => {
    if (
      !deleteCandidate ||
      !deleteCandidate.projectId ||
      !deleteCandidate.id ||
      !currentUser?.uid
    ) {
      return;
    }
    setDeletingTaskId(deleteCandidate.id);
    setDeleteError("");
    try {
      await deleteTask(deleteCandidate.projectId, deleteCandidate.id);
      await loadTasks(currentUser.uid);
      if (selectedTask?.id === deleteCandidate.id) {
        setSelectedTask(null);
      }
      closeDeleteDialog();
    } catch (err) {
      setDeleteError(err?.message || "Failed to delete task.");
      setDeletingTaskId("");
    }
  }, [
    closeDeleteDialog,
    currentUser?.uid,
    deleteCandidate,
    loadTasks,
    selectedTask?.id,
  ]);

  const handleRefresh = () => {
    if (currentUser?.uid) {
      loadTasks(currentUser.uid);
    }
  };

  if (userLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="h-64 grid place-items-center text-muted-foreground">
          Validating session…
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="h-64 grid place-items-center text-muted-foreground">
          Loading your tasks…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteDialog();
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete Task
            </DialogTitle>
            <DialogDescription>
              This action permanently removes the task and any associated
              metadata.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deleteCandidate?.title || "this task"}
              </span>
              ? This can’t be undone.
            </p>
            {deleteError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{deleteError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={Boolean(deletingTaskId)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteTask}
              disabled={Boolean(deletingTaskId)}
            >
              {deletingTaskId ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeEditDialog();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <form onSubmit={handleEditSubmit} className="space-y-6">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>
                Update task details and save to keep everyone aligned.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="edit-title"
                  className="text-sm font-medium text-foreground"
                >
                  Title
                </label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) =>
                    handleEditFieldChange("title", e.target.value)
                  }
                  placeholder="Task title"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="edit-description"
                  className="text-sm font-medium text-foreground"
                >
                  Description
                </label>
                <textarea
                  id="edit-description"
                  className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={editForm.description}
                  onChange={(e) =>
                    handleEditFieldChange("description", e.target.value)
                  }
                  placeholder="Add helpful context for this task"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="edit-status"
                    className="text-sm font-medium text-foreground"
                  >
                    Status
                  </label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) =>
                      handleEditFieldChange("status", value)
                    }
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_COLUMNS.find(
                            (column) => column.status === status
                          )?.title || status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="edit-priority"
                    className="text-sm font-medium text-foreground"
                  >
                    Priority (1 = least urgent, 10 = most urgent)
                  </label>
                  <Select
                    value={editForm.priority}
                    onValueChange={(value) =>
                      handleEditFieldChange("priority", value)
                    }
                  >
                    <SelectTrigger id="edit-priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {`Priority ${value}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="edit-due-date"
                  className="text-sm font-medium text-foreground"
                >
                  Due date
                </label>
                <Input
                  id="edit-due-date"
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) =>
                    handleEditFieldChange("dueDate", e.target.value)
                  }
                />
              </div>

              {editError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{editError}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeEditDialog}
                disabled={savingEdit}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="border-b border-border p-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">My Tasks</h2>
            <p className="text-sm text-muted-foreground">
              Tasks assigned to {currentUser?.displayName || currentUser?.email}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            className="self-start lg:self-auto"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total tasks</p>
            <p className="text-2xl font-semibold text-foreground">
              {totalTasks}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p
              className={`text-2xl font-semibold ${
                overdueTasks.length ? "text-destructive" : "text-foreground"
              }`}
            >
              {overdueTasks.length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Active projects</p>
            <p className="text-2xl font-semibold text-foreground">
              {projectsList.length}
            </p>
          </Card>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {usersError && !usersLoading && (
          <p className="text-xs text-muted-foreground">
            Unable to load teammate details. Collaborator names may be limited.
          </p>
        )}

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
                      {project.tasks.length} task
                      {project.tasks.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-6">
                  <div className="space-y-3">
                    {project.tasks.map((task) => {
                      const due = toDate(task.dueDate);
                      const updated = toDate(task.updatedAt);
                      const overdue =
                        due && due < new Date() && task.status !== "completed";
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
                            <Badge className={getStatusBadgeClass(task.status)}>
                              {statusLabel(task.status)}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge
                              className={getPriorityBadgeClass(task.priority)}
                            >
                              {priorityLabel(task.priority)}
                            </Badge>
                            <span
                              className={`text-xs text-muted-foreground ${
                                overdue ? "text-destructive font-medium" : ""
                              }`}
                            >
                              Due: {due ? due.toLocaleDateString() : "—"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Updated:{" "}
                              {updated ? updated.toLocaleDateString() : "—"}
                            </span>
                            {(() => {
                              const allAssigneeNames = [
                                task.assigneeSummary?.name,
                                ...(task.collaboratorNames || []),
                              ].filter(Boolean);
                              return (
                                allAssigneeNames.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {allAssigneeNames.map((name, idx) => (
                                      <span
                                        key={idx}
                                        className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium"
                                      >
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                )
                              );
                            })()}
                            {task.tags?.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                Tags: {task.tags.join(", ")}
                              </span>
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
          onEdit={openEditDialog}
          onDelete={requestDeleteTask}
          disableActions={Boolean(deletingTaskId) || savingEdit}
          onSubtaskChange={async () => {
            try {
              // Small delay to let backend update
              await new Promise((resolve) => setTimeout(resolve, 300));

              // Refetch the specific task with updated progress
              const updatedTask = await getTask(
                selectedTask.projectId,
                selectedTask.id
              );

              // Resolve assignee/creator like we do in handleTaskClick
              const assigneeSummary = summarizeUser(
                updatedTask.assigneeId || updatedTask.ownerId
              );
              const creatorSummary = summarizeUser(updatedTask.createdBy);

              const refreshedTask = {
                ...updatedTask,
                assigneeSummary,
                creatorSummary,
              };

              // Update the modal
              setSelectedTask(refreshedTask);

              // Update in the tasks list
              setTasks((prevTasks) =>
                prevTasks.map((t) =>
                  t.id === refreshedTask.id ? refreshedTask : t
                )
              );
            } catch (err) {
              console.error(
                "Failed to refresh task after subtask change:",
                err
              );
            }
          }}
        />
      )}
    </div>
  );
}
