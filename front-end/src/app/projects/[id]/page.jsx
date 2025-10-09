"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  getProject,
  updateProject,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listUsers,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Trash2, AlertCircle, Loader2, Pencil, ChevronDown, Calendar as CalendarIcon, FileText } from "lucide-react";
import { format, startOfDay } from "date-fns";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { TeamTimeline } from "@/components/TeamTimeline";
const TAG_BASE = "rounded-full px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1";

const STATUS = ["to-do", "in progress", "completed", "blocked"];
const TASK_PRIORITY_VALUES = Array.from({ length: 10 }, (_, i) => String(i + 1));
const PROJECT_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
const STATUS_LABELS = {
  "to-do": "To-Do",
  "in progress": "In Progress",
  "completed": "Completed",
  "blocked": "Blocked",
};
const TASK_PRIORITY_LABELS = TASK_PRIORITY_VALUES.reduce((acc, value) => {
  acc[value] = `Priority ${value}`;
  return acc;
}, {});

const PROJECT_PRIORITY_LABELS = PROJECT_PRIORITIES.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const projectPriorityOrder = { low: 1, medium: 2, high: 3 };

const ensureProjectPriority = (value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (projectPriorityOrder[normalized]) {
      return normalized;
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return ensureProjectPriority(parsed);
    }
    return "medium";
  }
  if (typeof value === "number") {
    if (value >= 8) return "high";
    if (value <= 3) return "low";
    return "medium";
  }
  return "medium";
};

const getPriorityBadgeClass = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return `${TAG_BASE} bg-muted text-muted-foreground border border-border/50`;
  }
  if (numeric >= 8) {
    return `${TAG_BASE} bg-red-100 text-red-700 border border-red-200`;
  }
  if (numeric >= 4) {
    return `${TAG_BASE} bg-yellow-100 text-yellow-700 border border-yellow-200`;
  }
  return `${TAG_BASE} bg-emerald-100 text-emerald-700 border border-emerald-200`;
};

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
      .filter(Boolean);
  }
  if (value === undefined || value === null) return [];
  const str = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return str ? [str] : [];
};

const createEmptyTaskForm = (uid = "") => ({
  title: "",
  description: "",
  assigneeId: uid,
  dueDate: "",
  priority: "5",
  status: "to-do",
  tags: "",
  collaboratorsIds: [],
});

const toDateInputValue = (value) => {
  const date = toDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
};

export default function ProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [pStatus, setPStatus] = useState("to-do");
  const [pPriority, setPPriority] = useState("medium");

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(() => createEmptyTaskForm());
  const [savingTask, setSavingTask] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [selectedMember, setSelectedMember] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState("");
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaError, setMetaError] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletingTaskId, setDeletingTaskId] = useState("");
  const isEditingTask = Boolean(editingTaskId);



  // ⭐ ADDED: infer next project status from a list of tasks
  const inferProjectStatusFromTasks = useCallback((arr) => {
    const list = Array.isArray(arr) ? arr : [];
    if (list.length === 0) return "to-do"; // default when no tasks
    const statuses = list.map((t) => (t?.status || "").toLowerCase());
    const allCompleted = statuses.length > 0 && statuses.every((s) => s === "completed");
    if (allCompleted) return "completed";
    const anyInProgress = statuses.some((s) => s === "in progress");
    if (anyInProgress) return "in progress";
    // fallback if nothing in progress and not all completed
    return "to-do";
  }, []);

  // ⭐ ADDED: apply inferred status, persist to DB, and keep local state in sync
  const syncProjectStatusWithTasks = useCallback(
    async (arr) => {
      const next = inferProjectStatusFromTasks(arr);
      if (!next || next === pStatus) return;
      const prev = pStatus;
      setPStatus(next);
      try {
        await updateProject(id, { status: next }); // persist
        setProject((prevProject) => (prevProject ? { ...prevProject, status: next } : prevProject));
      } catch {
        // on failure, revert local state
        setPStatus(prev);
      }
    },
    [id, inferProjectStatusFromTasks, pStatus]
  );

  const load = useCallback(async (userId) => {
    if (!userId) return;

    try {
      setLoading(true);
      setErr("");
      const [p, t, u] = await Promise.all([
        getProject(id, { assignedTo: userId }),
        listTasks(id, { assigneeId: userId }),
        listUsers(),
      ]);
      const normalizedProject = { ...p, priority: ensureProjectPriority(p.priority) };

      // normalize tasks once here so we can reuse the array
      const normalizedTasks = (t || []).map((task) => {
        const priorityNumber = Number(task.priority);
        const priority = Number.isFinite(priorityNumber) ? String(priorityNumber) : "";
        return {
          ...task,
          status: (task.status || "").toLowerCase(),
          priority,
          priorityNumber: Number.isFinite(priorityNumber) ? priorityNumber : null,
          collaboratorsIds: ensureArray(task.collaboratorsIds),
        };
      });

      setProject(normalizedProject);
      setTasks(normalizedTasks);
      setUsers(Array.isArray(u) ? u : []);
      setPStatus((p.status || "to-do").toLowerCase());
      setPPriority(ensureProjectPriority(p.priority));
      setSelectedMember("");
      setMemberError("");
      setDescriptionDraft(p.description || "");
      setEditingDescription(false);
      setMetaError("");

      // (Optional) You can uncomment this if you want auto-sync also on initial load
      // await syncProjectStatusWithTasks(normalizedTasks);

    } catch (e) {
      setErr(e?.message || "Failed to load project");
      setProject(null);
      setTasks([]);
      setUsers([]);
      setMemberError("");
    } finally {
      setLoading(false);
    }
  }, [id /*, syncProjectStatusWithTasks*/]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setUserLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) {
      setProject(null);
      setTasks([]);
      setLoading(false);
      return;
    }
    load(currentUser.uid);
  }, [currentUser?.uid, load]);

  const resetTaskForm = useCallback(() => {
    setTaskForm(createEmptyTaskForm(currentUser?.uid ?? ""));
  }, [currentUser?.uid]);

  useEffect(() => {
    resetTaskForm();
  }, [resetTaskForm]);

  const handleTaskDialogChange = useCallback((open) => {
    setIsTaskDialogOpen(open);
    if (!open) {
      setTaskError("");
      setSavingTask(false);
      setEditingTaskId(null);
      resetTaskForm();
    }
  }, [resetTaskForm]);

  const applyProjectUpdates = useCallback(async (updates) => {
    if (!updates || Object.keys(updates).length === 0) return;
    try {
      setMetaError("");
      setMetaSaving(true);
      await updateProject(id, updates);
      setProject((prev) => (prev ? { ...prev, ...updates } : prev));
    } catch (error) {
      setMetaError(error?.message || "Failed to update project.");
      throw error;
    } finally {
      setMetaSaving(false);
    }
  }, [id]);

  const handleStatusChange = async (value) => {
    const prevValue = pStatus;
    setPStatus(value);
    try {
      await applyProjectUpdates({ status: value });
    } catch (error) {
      setPStatus(prevValue);
    }
  };

  const handlePriorityChange = async (value) => {
    const prevValue = pPriority;
    const nextPriority = ensureProjectPriority(value);
    setPPriority(nextPriority);
    try {
      await applyProjectUpdates({ priority: nextPriority });
    } catch (error) {
      setPPriority(prevValue);
    }
  };

  const handleDescriptionSave = async () => {
    const trimmed = descriptionDraft.trim();
    try {
      await applyProjectUpdates({ description: trimmed });
      setDescriptionDraft(trimmed);
      setEditingDescription(false);
    } catch (error) {
      /* leave editing mode active */
    }
  };

  const updateTaskForm = (field, value) => {
    setTaskForm((prev) => {
      if (field === "assigneeId") {
        const trimmedValue = typeof value === "string" ? value.trim() : String(value ?? "");
        const filteredCollaborators = ensureArray(prev.collaboratorsIds).filter((id) => id !== trimmedValue);
        return { ...prev, assigneeId: trimmedValue, collaboratorsIds: filteredCollaborators };
      }
      return { ...prev, [field]: value };
    });
  };

  const overdueCount = useMemo(() => {
    const today = new Date();
    return tasks.filter((t) => {
      const d = toDate(t.dueDate);
      const s = (t.status || "").toLowerCase();
      return d && s !== "completed" && d < startOfDay(today);
    }).length;
  }, [tasks]);

  const ownerId = project?.ownerId || project?.createdBy || "";

  const userLookup = useMemo(() => {
    const map = new Map();
    users.forEach((user) => {
      if (user?.id) {
        map.set(user.id, user);
      }
    });
    return map;
  }, [users]);

  const resolveUserLabel = useCallback((id) => {
    if (!id) return "";
    const info = userLookup.get(id);
    if (!info) return id;
    const label = (info.fullName || info.displayName || info.name || info.email || "").trim();
    return label || id;
  }, [userLookup]);

  const teamMembers = useMemo(() => {
    const ids = Array.isArray(project?.teamIds) ? [...project.teamIds] : [];
    if (ownerId && !ids.includes(ownerId)) {
      ids.unshift(ownerId);
    }
    const seen = new Set();
    return ids
      .map((raw) => (typeof raw === "string" ? raw.trim() : String(raw ?? "")).trim())
      .filter((id) => {
        if (!id) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((id) => {
        const info = userLookup.get(id);
        const fullName = (info?.fullName || info?.displayName || info?.name || "").trim();
        const email = (info?.email || "").trim();
        const role = typeof info?.role === "string" ? info.role.trim() : "";
        const displayName = fullName || email || id;
        return {
          id,
          fullName,
          email,
          role,
          isOwner: !!ownerId && id === ownerId,
          isCurrentUser: id === (currentUser?.uid || ""),
          displayName,
        };
      });
  }, [project?.teamIds, userLookup, ownerId, currentUser?.uid]);

  const availableUsers = useMemo(() => {
    const teamSet = new Set(teamMembers.map((member) => member.id));
    return users
      .filter((user) => user?.id && !teamSet.has(user.id))
      .map((user) => ({
        id: user.id,
        label: resolveUserLabel(user.id),
        email: (user.email || "").trim(),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [users, teamMembers, resolveUserLabel]);

  useEffect(() => {
    if (selectedMember && !availableUsers.some((user) => user.id === selectedMember)) {
      setSelectedMember("");
    }
  }, [availableUsers, selectedMember]);

  useEffect(() => {
    if (!selectedMember) {
      setMemberError("");
    }
  }, [selectedMember]);

  const isSubmitDisabled = savingTask || !taskForm.title.trim();

  const collaboratorOptions = useMemo(() =>
    teamMembers.map((member) => ({
      id: member.id,
      label: member.displayName || resolveUserLabel(member.id),
      email: member.email,
      isOwner: member.isOwner,
      isCurrentUser: member.isCurrentUser,
    })),
  [teamMembers, resolveUserLabel]);

  const selectedCollaborators = ensureArray(taskForm.collaboratorsIds);
  const selectedCollaboratorNames = selectedCollaborators
    .map((id) => resolveUserLabel(id))
    .filter(Boolean);
  const collaboratorButtonLabel = selectedCollaboratorNames.length === 0
    ? "Select assignees"
    : selectedCollaboratorNames.length <= 2
      ? selectedCollaboratorNames.join(", ")
      : `${selectedCollaboratorNames.slice(0, 2).join(", ")} +${selectedCollaboratorNames.length - 2} more`;

  useEffect(() => {
    const allowedIds = new Set(collaboratorOptions.map((option) => option.id));
    setTaskForm((prev) => {
      const current = ensureArray(prev.collaboratorsIds);
      const filtered = current.filter((id) => allowedIds.has(id));
      if (filtered.length === current.length) {
        return prev;
      }
      return { ...prev, collaboratorsIds: filtered };
    });
  }, [collaboratorOptions]);

  const handleCollaboratorToggle = (id, checked) => {
    const isActive = Boolean(checked);
    setTaskForm((prev) => {
      const current = ensureArray(prev.collaboratorsIds);
      if (isActive) {
        if (current.includes(id)) return prev;
        return { ...prev, collaboratorsIds: [...current, id] };
      }
      return { ...prev, collaboratorsIds: current.filter((value) => value !== id) };
    });
  };

  const handleMemberSelect = (value) => {
    setSelectedMember(value);
    if (value) {
      setMemberError("");
    }
  };

  async function handleAddMember() {
    if (!project || !selectedMember) {
      return;
    }

    if (Array.isArray(project.teamIds) && project.teamIds.includes(selectedMember)) {
      setSelectedMember("");
      return;
    }

    setAddingMember(true);
    setMemberError("");
    try {
      const nextTeamIds = Array.from(
        new Set([...(Array.isArray(project.teamIds) ? project.teamIds : []), selectedMember])
      );
      await updateProject(id, { teamIds: nextTeamIds });
      setProject((prev) => (prev ? { ...prev, teamIds: nextTeamIds } : prev));
      setSelectedMember("");
    } catch (error) {
      setMemberError(error?.message ?? "Failed to add member.");
    } finally {
      setAddingMember(false);
    }
  }

  const handleViewSchedule = useCallback(
    (memberId) => {
      if (!memberId) return;
      router.push(`/tasks?assignee=${encodeURIComponent(memberId)}`);
    },
    [router]
  );

  const handleRemoveMember = useCallback(
    async (memberId) => {
      if (!memberId || memberId === ownerId) {
        return;
      }
      setMemberError("");
      setRemovingMemberId(memberId);
      try {
        const currentTeam = Array.isArray(project?.teamIds) ? project.teamIds : [];
        const nextTeamIds = currentTeam.filter((idValue) => idValue !== memberId);
        await updateProject(id, { teamIds: nextTeamIds });
        setProject((prev) => (prev ? { ...prev, teamIds: nextTeamIds } : prev));
      } catch (error) {
        setMemberError(error?.message || "Failed to remove member.");
      } finally {
        setRemovingMemberId("");
      }
    },
    [id, ownerId, project?.teamIds]
  );

  async function handleSubmitTask(e) {
    e?.preventDefault();
    if (savingTask) return;

    const title = taskForm.title.trim();
    if (!title) {
      setTaskError("Task title is required.");
      return;
    }

    // Validate due date is required
    if (!taskForm.dueDate) {
      setTaskError("Due date is required.");
      return;
    }

    // Validate at least one assignee
    if (selectedCollaborators.length === 0) {
      setTaskError("At least one assignee is required.");
      return;
    }

    if (!currentUser?.uid) {
      setTaskError("You must be signed in to create tasks.");
      return;
    }

    setSavingTask(true);
    setTaskError("");

    try {
      const numericPriority = Number(taskForm.priority);
      const priorityValue = Number.isFinite(numericPriority) ? numericPriority : 5;
      const tags = taskForm.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      // Use first assignee as primary, rest as collaborators
      const [primaryAssignee, ...otherAssignees] = selectedCollaborators;

      const payload = {
        title,
        description: taskForm.description.trim(),
        status: taskForm.status,
        priority: priorityValue,
        assigneeId: primaryAssignee,
        collaboratorsIds: otherAssignees.length > 0 ? otherAssignees : [],
        tags,
      };

      // Due date is required now
      const due = new Date(`${taskForm.dueDate}T00:00:00`);
      if (Number.isNaN(due.getTime())) {
        setTaskError("Please provide a valid due date.");
        setSavingTask(false);
        return;
      }
      payload.dueDate = due.toISOString();

      // Collaborators already set in payload above

      // prepare a local updated list to drive auto-status
      let updatedTasksLocal = tasks;

      if (isEditingTask && editingTaskId) {
        await updateTask(id, editingTaskId, payload);
        updatedTasksLocal = tasks.map((t) =>
          t.id === editingTaskId ? { ...t, ...payload, status: String(payload.status).toLowerCase() } : t
        );
      } else {
        await createTask(id, payload);
        // include the new task (id unknown yet; temp id is fine for inference)
        updatedTasksLocal = [...tasks, { id: "temp", ...payload, status: String(payload.status).toLowerCase() }];
      }

      // ⭐ ADDED: auto-sync project status after create/edit
      await syncProjectStatusWithTasks(updatedTasksLocal);

      await load(currentUser.uid);
      handleTaskDialogChange(false);
    } catch (error) {
      setTaskError(error?.message ?? (isEditingTask ? "Failed to update task." : "Failed to create task."));
      setSavingTask(false);
    }
  }

  async function handleTaskStatus(taskId, status) {
    await updateTask(id, taskId, { status });
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, status } : t));
    setTasks(updated);

    // ⭐ ADDED: auto-sync project status after inline status change
    await syncProjectStatusWithTasks(updated);
  }

  const requestDeleteTask = (task) => {
    if (!task) return;
    setDeleteCandidate(task);
    setDeleteError("");
    setDeletingTaskId("");
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeleteCandidate(null);
    setDeleteError("");
    setDeletingTaskId("");
  };

  const confirmDeleteTask = async () => {
    if (!deleteCandidate) return;
    const taskId = deleteCandidate.id;
    if (!taskId) return;
    setDeletingTaskId(taskId);
    setDeleteError("");
    try {
      await deleteTask(id, taskId);
      const remaining = tasks.filter((t) => t.id !== taskId);
      setTasks(remaining);

      // ⭐ ADDED: auto-sync project status after delete
      await syncProjectStatusWithTasks(remaining);

      if (editingTaskId === taskId) {
        setEditingTaskId(null);
        setIsTaskDialogOpen(false);
      }
      closeDeleteDialog();
    } catch (error) {
      setDeleteError(error?.message || "Failed to delete task.");
      setDeletingTaskId("");
    }
  };

  const openCreateTaskDialog = () => {
    setEditingTaskId(null);
    setTaskError("");
    setSavingTask(false);
    setTaskForm(createEmptyTaskForm(currentUser?.uid ?? ""));
    setIsTaskDialogOpen(true);
  };

  const handleEditTask = (task) => {
    if (!task) return;
    const priorityNumber = Number(task.priorityNumber ?? task.priority);
    const priorityValue = Number.isFinite(priorityNumber) ? String(priorityNumber) : "5";
    setEditingTaskId(task.id);
    setTaskError("");
    setSavingTask(false);
    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      assigneeId: task.assigneeId || task.ownerId || currentUser?.uid || "",
      dueDate: toDateInputValue(task.dueDate),
      priority: priorityValue,
      status: (task.status || "to-do").toLowerCase(),
      tags: Array.isArray(task.tags) ? task.tags.join(", ") : "",
      collaboratorsIds: ensureArray(task.collaboratorsIds),
    });
    setIsTaskDialogOpen(true);
  };

  if (userLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-muted-foreground">
        Loading user…
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-muted-foreground">
        Loading project…
      </div>
    );
  }

  if (err || !project) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-destructive">
        {err || "Project not found"}
      </div>
    );
  }

  return (
    <>
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
              This action permanently removes the task from the project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete
              {" "}
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
            <Button type="button" variant="outline" onClick={closeDeleteDialog} disabled={Boolean(deletingTaskId)}>
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

      <Dialog open={isTaskDialogOpen} onOpenChange={handleTaskDialogChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmitTask} className="space-y-6">
            <DialogHeader>
              <DialogTitle>{isEditingTask ? "Edit Task" : "Add Task"}</DialogTitle>
              <DialogDescription>
                {isEditingTask
                  ? "Update the task details and save your changes."
                  : "Provide details for the new task. You can adjust them later."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="task-title" className="text-sm font-medium text-foreground">Title</label>
                <Input
                  id="task-title"
                  value={taskForm.title}
                  onChange={(e) => updateTaskForm("title", e.target.value)}
                  placeholder="Design login screen"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="task-description" className="text-sm font-medium text-foreground">Description</label>
                <textarea
                  id="task-description"
                  className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={taskForm.description}
                  onChange={(e) => updateTaskForm("description", e.target.value)}
                  placeholder="Wireframes + final design in Figma"
                />
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="task-status" className="text-sm font-medium text-foreground">Status</label>
                  <Select value={taskForm.status} onValueChange={(value) => updateTaskForm("status", value)}>
                    <SelectTrigger id="task-status" className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s] || s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="task-priority" className="text-sm font-medium text-foreground">Priority</label>
                  <Select value={taskForm.priority} onValueChange={(value) => updateTaskForm("priority", value)}>
                    <SelectTrigger id="task-priority" className="w-full">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITY_VALUES.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="task-due" className="text-sm font-medium text-foreground">
                  Due date <span className="text-destructive">*</span>
                </label>
                <Input
                  id="task-due"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => updateTaskForm("dueDate", e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Required field</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Assignees <span className="text-destructive">*</span>
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      <span className="truncate text-left">
                        {collaboratorButtonLabel}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {selectedCollaborators.length} selected
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64">
                    <DropdownMenuLabel>Select assignees</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {collaboratorOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Add team members to this project first.</div>
                    ) : (
                      collaboratorOptions.map((option) => (
                        <DropdownMenuCheckboxItem
                          key={option.id}
                          checked={selectedCollaborators.includes(option.id)}
                          onCheckedChange={(checked) => handleCollaboratorToggle(option.id, checked)}
                        >
                          <div className="flex flex-col">
                            <span className="leading-tight">{option.label}</span>
                            {option.email && option.email !== option.label && (
                              <span className="text-xs text-muted-foreground leading-tight">{option.email}</span>
                            )}
                          </div>
                        </DropdownMenuCheckboxItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-xs text-muted-foreground">
                  Required: Select at least one team member to assign this task to.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="task-tags" className="text-sm font-medium text-foreground">Tags</label>
                <Input
                  id="task-tags"
                  value={taskForm.tags}
                  onChange={(e) => updateTaskForm("tags", e.target.value)}
                  placeholder="design, UI"
                />
                <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
              </div>

              {taskError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{taskError}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleTaskDialogChange(false)} disabled={savingTask}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitDisabled}>
                {savingTask
                  ? isEditingTask
                    ? "Saving..."
                    : "Creating..."
                  : isEditingTask
                    ? "Save Changes"
                    : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="border-b border-border bg-card p-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-3">
                <h1 className="text-3xl font-bold break-words">{project.name || "(untitled project)"}</h1>
                {editingDescription ? (
                  <div className="space-y-2">
                    <textarea
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      className="min-h-[96px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Describe the goals, scope, or key milestones for this project."
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={handleDescriptionSave} disabled={metaSaving}>
                        {metaSaving ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving…
                          </span>
                        ) : (
                          "Save"
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setMetaError("");
                          setEditingDescription(false);
                          setDescriptionDraft(project.description || "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
                    <p className={`max-w-3xl leading-relaxed ${project.description ? "" : "italic"}`}>
                      {project.description || "Add a description so the team knows the project goals."}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setMetaError("");
                        setDescriptionDraft(project.description || "");
                        setEditingDescription(true);
                      }}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                  </div>
                )}
                {metaError && (
                  <p className="text-xs text-destructive">{metaError}</p>
                )}
              </div>
              {metaSaving && !editingDescription && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving…</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-full border border-border bg-muted/70 px-3 text-xs font-medium capitalize"
                    disabled={metaSaving}
                  >
                    <span>Status: {STATUS_LABELS[pStatus] || "Select"}</span>
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup
                    value={pStatus}
                    onValueChange={(value) => {
                      if (value && value !== pStatus) {
                        handleStatusChange(value);
                      }
                    }}
                  >
                    {STATUS.map((s) => (
                      <DropdownMenuRadioItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-full border border-border bg-muted/70 px-3 text-xs font-medium capitalize"
                    disabled={metaSaving}
                  >
                    <span>Priority: {PROJECT_PRIORITY_LABELS[pPriority] || "Select"}</span>
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup
                    value={pPriority}
                    onValueChange={(value) => {
                      if (value && value !== pPriority) {
                        handlePriorityChange(value);
                      }
                    }}
                  >
                    {PROJECT_PRIORITIES.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {project.dueDate && (
                <Badge variant="secondary">Due: {format(toDate(project.dueDate), "dd MMM yyyy")}</Badge>
              )}
              <Badge variant="outline">Team: {(project.teamIds || []).length}</Badge>
              <Badge variant="outline">Tags: {(project.tags || []).join(", ") || "-"}</Badge>
              <Badge variant="outline">Overdue tasks: {overdueCount}</Badge>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowReport(true)}
                className="not-print"
              >
                <FileText className="mr-2 h-3.5 w-3.5" />
                Generate report
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 print:p-8">
          <Tabs defaultValue="tasks" className="flex flex-col gap-6">
            <TabsList className="w-fit not-print">
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="mt-0">
              <Card className="p-4 not-print">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Tasks</h2>
                    <Button onClick={openCreateTaskDialog} className="bg-primary text-primary-foreground hover:bg-primary/90">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Task
                    </Button>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No tasks yet.</div>
                  ) : (
                    <div className="divide-y divide-border">
                    {tasks.map((t) => {
                      const allAssigneeIds = [
                        t.assigneeId,
                        ...(t.collaboratorsIds || [])
                      ].filter(Boolean);
                      const allAssigneeNames = allAssigneeIds.map(id => resolveUserLabel(id));
                      const priorityValue = t.priority ? String(t.priority) : "";
                      const priorityLabel = priorityValue
                        ? TASK_PRIORITY_LABELS[priorityValue] || `Priority ${priorityValue}`
                        : "Priority —";
                      const priorityBadgeClass = getPriorityBadgeClass(priorityValue);

                      return (
                        <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{t.title}</span>
                              <StatusBadge status={t.status} />
                              <Badge className={priorityBadgeClass} variant="outline">
                                {priorityLabel}
                              </Badge>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {t.description || "—"}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              {t.dueDate && (
                                <span className="text-xs text-muted-foreground">
                                  Due: {format(toDate(t.dueDate), "dd MMM yyyy")}
                                </span>
                              )}
                              {allAssigneeNames.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {allAssigneeNames.map((name, idx) => (
                                    <span key={idx} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {(t.tags || []).length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  Tags: {(t.tags || []).join(", ")}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Select value={(t.status || "to-do").toLowerCase()} onValueChange={(value) => handleTaskStatus(t.id, value)}>
                              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                              <SelectContent>
                                {STATUS.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {STATUS_LABELS[s] || s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => handleEditTask(t)}
                              title="Edit task"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => requestDeleteTask(t)}
                              title="Delete task"
                              disabled={Boolean(deletingTaskId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="mt-0">
              <TeamTimeline
                tasks={tasks}
                teamMembers={teamMembers}
                resolveUserLabel={resolveUserLabel}
              />
            </TabsContent>

            <TabsContent value="team" className="mt-0">
              <Card className="p-4 space-y-4 not-print">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Team members</h2>
                  <p className="text-xs text-muted-foreground">Manage collaborators assigned to this project.</p>
                </div>

                <div className="space-y-2">
                  <Select
                    value={selectedMember}
                    onValueChange={handleMemberSelect}
                    disabled={availableUsers.length === 0 || addingMember}
                  >
                    <SelectTrigger className="h-9 w-full text-sm">
                      <SelectValue
                        placeholder={availableUsers.length === 0 ? "No available users" : "Select a user"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.length === 0 ? (
                        <SelectItem value="" disabled>
                          No users to add
                        </SelectItem>
                      ) : (
                        availableUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {`${user.label}${user.email && user.email !== user.label ? ` (${user.email})` : ""}`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddMember} disabled={addingMember || !selectedMember} className="w-full">
                    {addingMember ? "Adding..." : "Add"}
                  </Button>
                </div>

                {memberError && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{memberError}</span>
                  </div>
                )}

                {teamMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No team members yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teamMembers.map((member) => {
                      const displayName = member.displayName || member.fullName || member.email || member.id;
                      const secondary =
                        member.email && member.email !== displayName
                          ? member.email
                          : member.id !== displayName
                            ? member.id
                            : "";
                      const isRemoving = removingMemberId === member.id;
                      return (
                        <Card
                          key={member.id}
                          className="p-4 space-y-3"
                        >
                          <div className="space-y-1">
                            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                            {secondary && (
                              <p className="truncate text-xs text-muted-foreground">{secondary}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground uppercase">
                              {member.role && (
                                <span className="rounded-full border border-border px-2 py-0.5 tracking-wide">{member.role}</span>
                              )}
                              {member.isCurrentUser && (
                                <span className="rounded-full bg-secondary/80 px-2 py-0.5 text-secondary-foreground">You</span>
                              )}
                              {member.isOwner && (
                                <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">Owner</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => handleViewSchedule(member.id)}
                            >
                              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                              View Schedule
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="w-full text-destructive hover:text-destructive"
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={isRemoving || member.isOwner}
                            >
                              {isRemoving ? "Removing..." : "Remove"}
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      {showReport && (
        <ReportPanel
          project={project}
          tasks={tasks}
          resolveUserLabel={resolveUserLabel}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}

function ReportPanel({ project, tasks, onClose, resolveUserLabel }) {
  const title = `Project Report — ${project.name || "Untitled"}`;
  const generatedAt = new Date().toLocaleString();

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfToday = new Date(startToday.getTime() + 86399999);
  const endNext7 = new Date(startToday.getTime() + 7 * 86400000 + 86399999);

  const total = tasks.length;
  const overdueTasks = tasks.filter((task) => {
    const due = toDate(task.dueDate);
    const status = (task.status || "").toLowerCase();
    return due && status !== "completed" && due < startToday;
  });
  const overduePct = total === 0 ? 0 : Math.round((overdueTasks.length / total) * 100);

  const overdueAges = overdueTasks
    .map((task) => Math.ceil((startToday.getTime() - toDate(task.dueDate).getTime()) / 86400000))
    .sort((a, b) => a - b);
  const medianDaysOverdue = overdueAges.length === 0
    ? 0
    : (overdueAges.length % 2
        ? overdueAges[(overdueAges.length - 1) / 2]
        : Math.round((overdueAges[overdueAges.length / 2 - 1] + overdueAges[overdueAges.length / 2]) / 2));

  const dueToday = tasks.filter((task) => {
    const due = toDate(task.dueDate);
    if (!due) return false;
    const normalized = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    return normalized.getTime() === startToday.getTime();
  });
  const next7Days = tasks.filter((task) => {
    const due = toDate(task.dueDate);
    return due && due > endOfToday && due < endNext7;
  });

  const team = Array.isArray(project.teamIds) ? project.teamIds : [];
  const owners = tasks.map((task) => task.ownerId).filter(Boolean);
  const assignees = tasks.map((task) => task.assigneeId).filter(Boolean);
  const collaborators = tasks.flatMap((task) => ensureArray(task.collaboratorsIds));

  const normalizeId = (value) => (typeof value === "string" ? value.trim() : String(value ?? "").trim());
  const counts = {};
  [...team, ...owners, ...assignees, ...collaborators].forEach((raw) => {
    const id = normalizeId(raw);
    if (!id) return;
    if (!(id in counts)) counts[id] = 0;
  });

  tasks.forEach((task) => {
    const assignee = normalizeId(task.assigneeId || task.ownerId);
    if (assignee) {
      counts[assignee] = (counts[assignee] || 0) + 1;
    }
    ensureArray(task.collaboratorsIds).forEach((collab) => {
      const cid = normalizeId(collab);
      if (!cid) return;
      counts[cid] = (counts[cid] || 0) + 1;
    });
  });

  const labelForMember = (id) => {
    if (!id) return "";
    if (typeof resolveUserLabel === "function") {
      const label = resolveUserLabel(id);
      return label || id;
    }
    return id;
  };

  const workloadEntries = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([memberId, count]) => ({
      id: memberId,
      label: labelForMember(memberId),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const AT_RISK = overduePct >= 20 || overdueTasks.length >= 3;

  async function exportPDFProgrammatic() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    let y = margin;

    doc.setFontSize(16);
    doc.text(title, margin, y);
    y += 16;

    doc.setFontSize(10);
    doc.setTextColor("#6b7280");
    doc.text(`Generated: ${generatedAt}`, margin, y);
    doc.setTextColor("#111827");
    y += 20;

    doc.setFontSize(12);
    doc.text(project.name || "(untitled project)", margin, y);
    y += 14;

    doc.setFontSize(10);
    if (project.description) {
      const wrapped = doc.splitTextToSize(project.description, 515);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 12 + 6;
    }

    autoTable(doc, {
      startY: y,
      head: [["Summary", "Details"]],
      body: [
        ["Status", (project.status || "").toLowerCase()],
        ["Priority", (project.priority || "").toLowerCase()],
        ["Due date", project.dueDate ? new Date(toDate(project.dueDate)).toLocaleDateString() : "-"],
        ["Team Members", String((project.teamIds || []).length)],
        ["Tags", (project.tags || []).join(", ") || "-"],
      ],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [243, 244, 246], textColor: 17 },
      columnStyles: { 0: { cellWidth: 120 } },
      margin: { left: margin, right: margin },
    });
    y = (doc.lastAutoTable?.finalY || y) + 16;

    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Total tasks", String(total)],
        ["% Overdue", `${overduePct}%`],
        ["Median days overdue", String(medianDaysOverdue)],
        ["Due soon (7 days)", String(next7Days.length)],
        ["At risk", AT_RISK ? "YES" : "NO"],
      ],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [243, 244, 246], textColor: 17 },
      margin: { left: margin, right: margin },
    });
    y = (doc.lastAutoTable?.finalY || y) + 16;

    const workloadRows = workloadEntries.map((entry) => [entry.label, String(entry.count)]);

    autoTable(doc, {
      startY: y,
      head: [["Member", "No. of Tasks"]],
      body: workloadRows.length ? workloadRows : [["—", "0"]],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [243, 244, 246], textColor: 17 },
      margin: { left: margin, right: margin },
    });
    y = (doc.lastAutoTable?.finalY || y) + 16;

    const deadlineRows = [
      ...dueToday.map((task) => ["Due Today", task.title, task.dueDate ? new Date(toDate(task.dueDate)).toLocaleDateString() : "-"]),
      ...overdueTasks.map((task) => ["Overdue", task.title, task.dueDate ? new Date(toDate(task.dueDate)).toLocaleDateString() : "-"]),
      ...next7Days.map((task) => ["Due Next 7 Days", task.title, task.dueDate ? new Date(toDate(task.dueDate)).toLocaleDateString() : "-"]),
    ];

    autoTable(doc, {
      startY: y,
      head: [["Task Status", "Task", "Due date"]],
      body: deadlineRows.length ? deadlineRows : [["—", "None", "—"]],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [243, 244, 246], textColor: 17 },
      columnStyles: { 0: { cellWidth: 110 }, 2: { cellWidth: 110 } },
      margin: { left: margin, right: margin },
      didDrawPage: () => {
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height || pageSize.getHeight();
        doc.setFontSize(9);
        doc.setTextColor("#6b7280");
        doc.text(`Generated: ${generatedAt} • ${title}`, margin, pageHeight - 14);
        doc.text(`Page ${doc.getNumberOfPages()}`, pageSize.width - margin - 60, pageHeight - 14);
        doc.setTextColor("#111827");
      },
    });

    const safeName = (project.name || "project").replace(/[^\w\-]+/g, "_");
    doc.save(`${safeName}-report.pdf`);
  }

  function exportExcel() {
    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["Report title", title],
      ["Generated", generatedAt],
      ["Project name", project.name || ""],
      ["Project status", (project.status || "").toLowerCase()],
      ["Priority", (project.priority || "").toLowerCase()],
      ["Due date", project.dueDate ? new Date(toDate(project.dueDate)).toISOString() : ""],
      [],
      ["Total tasks", total],
      ["Overdue tasks", overdueTasks.length],
      ["Overdue %", `${overduePct}%`],
      ["Median days overdue", medianDaysOverdue],
      ["Due today", dueToday.length],
      ["Due next 7 days", next7Days.length],
      ["At risk", AT_RISK ? "YES" : "NO"],
    ]);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    const workloadSheet = XLSX.utils.aoa_to_sheet([
      ["Member", "Tasks"],
      ...workloadEntries.map((entry) => [entry.label, entry.count]),
    ]);
    XLSX.utils.book_append_sheet(workbook, workloadSheet, "Workload");

    const deadlinesSheet = XLSX.utils.aoa_to_sheet([
      ["Bucket", "Task", "DueDate"],
      ...dueToday.map((task) => ["Due Today", task.title, task.dueDate ? new Date(toDate(task.dueDate)).toISOString() : ""]),
      ...overdueTasks.map((task) => ["Overdue", task.title, task.dueDate ? new Date(toDate(task.dueDate)).toISOString() : ""]),
      ...next7Days.map((task) => ["Next 7 Days", task.title, task.dueDate ? new Date(toDate(task.dueDate)).toISOString() : ""]),
    ]);
    XLSX.utils.book_append_sheet(workbook, deadlinesSheet, "Deadlines");

    const tasksSheet = XLSX.utils.aoa_to_sheet([
      ["Title", "Status", "Priority", "Assignee", "DueDate", "Tags", "Description"],
      ...tasks.map((task) => [
        task.title || "",
        (task.status || "").toLowerCase(),
        (task.priority || "").toLowerCase(),
        labelForMember(task.assigneeId || task.ownerId || "(unassigned)"),
        task.dueDate ? new Date(toDate(task.dueDate)).toISOString() : "",
        (task.tags || []).join(", "),
        task.description || "",
      ]),
    ]);
    XLSX.utils.book_append_sheet(workbook, tasksSheet, "Tasks");

    const safeName = (project.name || "project").replace(/[^\w\-]+/g, "_");
    XLSX.writeFile(workbook, `${safeName}-report.xlsx`);
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black/30 print:bg-transparent">
      <div className="absolute right-0 top-0 h-full w-full overflow-auto bg-white p-6 shadow-xl lg:w-[880px]">
        <div className="mb-4 flex items-center justify-between not-print">
          <h2 className="text-2xl font-semibold">Project report</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportPDFProgrammatic}>Export PDF</Button>
            <Button variant="outline" onClick={exportExcel}>Export Excel</Button>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>

        <div className="space-y-6">
          <header className="border-b pb-3">
            <div className="text-xs text-muted-foreground">Generated: {generatedAt}</div>
            <h3 className="text-xl font-semibold">{title}</h3>
          </header>

          <section className="space-y-1">
            <h4 className="text-lg font-semibold">{project.name}</h4>
            <p className="text-muted-foreground">{project.description}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={t.status} />
              <Badge variant="secondary">Priority: {(project.priority || "medium").toLowerCase()}</Badge>
              {project.dueDate && <Badge variant="secondary">Due: {format(toDate(project.dueDate), "dd MMM yyyy")}</Badge>}
              <Badge variant="outline">Team: {(project.teamIds || []).length}</Badge>
              <Badge variant="outline">Tags: {(project.tags || []).join(", ") || "-"}</Badge>
            </div>
          </section>

          <section>
            <h4 className="mb-2 font-semibold">Summary</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Card className="p-4">
                <div className="text-sm text-muted-foreground">Total tasks</div>
                <div className="text-2xl font-bold">{total}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted-foreground">% Overdue</div>
                <div className={`text-2xl font-bold ${overduePct >= 20 ? "text-red-600" : ""}`}>{overduePct}%</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted-foreground">Median days overdue</div>
                <div className="text-2xl font-bold">{medianDaysOverdue}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted-foreground">Due soon (7 days)</div>
                <div className="text-2xl font-bold">{next7Days.length}</div>
              </Card>
            </div>
          </section>

          <section>
            <h4 className="mb-2 font-semibold">Workload (tasks per member)</h4>
            {workloadEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground">No assigned work yet.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {workloadEntries.map((entry) => (
                  <Card key={entry.id} className="flex items-center justify-between p-4">
                    <div className="text-sm">{entry.label}</div>
                    <div className="text-xl font-bold">{entry.count}</div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="mb-2 font-semibold">Deadlines</h4>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Card className="p-4">
                <div className="mb-1 font-medium">Due Today</div>
                {dueToday.length === 0 ? (
                  <div className="text-sm text-muted-foreground">None</div>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {dueToday.map((task) => (
                      <li key={task.id}>• {task.title}</li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-4">
                <div className="mb-1 font-medium">Overdue</div>
                {overdueTasks.length === 0 ? (
                  <div className="text-sm text-muted-foreground">None</div>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {overdueTasks.map((task) => (
                      <li key={task.id}>• {task.title}</li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-4">
                <div className="mb-1 font-medium">Next 7 Days</div>
                {next7Days.length === 0 ? (
                  <div className="text-sm text-muted-foreground">None</div>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {next7Days.map((task) => (
                      <li key={task.id}>• {task.title} — {format(toDate(task.dueDate), "dd MMM")}</li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </section>

          <section>
            <h4 className="mb-2 font-semibold">Risk</h4>
            <Card className={`p-4 ${AT_RISK ? "border-red-500" : ""}`}>
              {AT_RISK ? (
                <div>
                  <div className="font-medium text-red-600">⚠ Project is AT RISK</div>
                  <div className="text-sm text-muted-foreground">
                    Triggered because {overduePct}% overdue and/or {overdueTasks.length} tasks overdue.
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-medium text-emerald-600">Project is healthy</div>
                  <div className="text-sm text-muted-foreground">Overdue backlog is within thresholds.</div>
                </div>
              )}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  
  const getStatusStyle = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "to-do" || s === "todo") return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
    if (s === "in progress" || s === "in-progress") return `${TAG_BASE} bg-blue-100 text-blue-700 border border-blue-200`;
    if (s === "completed" || s === "done") return `${TAG_BASE} bg-emerald-100 text-emerald-700 border border-emerald-200`;
    if (s === "blocked") return `${TAG_BASE} bg-red-100 text-red-700 border border-red-200`;
    return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`; // fallback
  };

  const label = STATUS_LABELS[s] || STATUS_LABELS["to-do"];
  return <span className={getStatusStyle(s)}>{label}</span>;
}

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000);
  return null;
}