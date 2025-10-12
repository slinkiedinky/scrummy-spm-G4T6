"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  User,
  Users,
  Tag,
  MessageSquare,
  Paperclip,
  Edit,
  Trash2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import {
  listSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
} from "@/lib/api";
function toInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0].includes("@") ? parts[0].split("@")[0] : parts[0])
    .slice(0, 2)
    .toUpperCase();
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number")
    return new Date(value);
  if (typeof value === "object" && typeof value.seconds === "number")
    return new Date(value.seconds * 1000);
  return null;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  disableActions = false,
  teamMembers = [],
  currentUserId,
  onSubtaskChange,
}) {
  const [showSubtaskDialog, setShowSubtaskDialog] = useState(false);
  const [subtaskRefreshKey, setSubtaskRefreshKey] = useState(0);
  const [selectedSubtask, setSelectedSubtask] = useState(null);
  console.log("Task in modal:", {
    projectId: task.projectId,
    taskId: task.id,
    isOpen,
  });

  const assignee =
    typeof task.assigneeSummary === "object" && task.assigneeSummary
      ? task.assigneeSummary
      : (() => {
          const id = String(task.assigneeId || task.ownerId || "");
          return id
            ? { id, name: `User ${id.slice(0, 4)}`, role: "Member", avatar: "" }
            : { name: "Unassigned", role: "" };
        })();

  const tags = Array.isArray(task.tags) ? task.tags : [];

  const normalizeCollaborator = (value, index = 0) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string") {
      const id = value.trim();
      if (!id) return null;
      return {
        id,
        name: `User ${id.slice(0, 4) || index + 1}`,
        email: "",
        role: "",
        avatar: "",
      };
    }
    if (typeof value === "object") {
      const rawId =
        value.id ??
        value.uid ??
        value.userId ??
        value.email ??
        value.name ??
        index;
      const id = String(rawId ?? index).trim();
      if (!id) return null;
      const nameCandidate = [
        value.name,
        value.fullName,
        value.displayName,
        value.email,
      ].find((item) => typeof item === "string" && item.trim());
      return {
        id,
        name: nameCandidate
          ? nameCandidate.trim()
          : `User ${id.slice(0, 4) || index + 1}`,
        email: typeof value.email === "string" ? value.email : "",
        role: typeof value.role === "string" ? value.role : "",
        avatar: value.avatar || value.photoURL || "",
      };
    }
    return null;
  };

  const collaborators = (() => {
    const candidateLists = [
      Array.isArray(task.collaborators) ? task.collaborators : null,
      Array.isArray(task.collaboratorSummaries)
        ? task.collaboratorSummaries
        : null,
      Array.isArray(task.collaboratorDetails) ? task.collaboratorDetails : null,
    ];
    const explicitList = candidateLists.find(
      (list) => Array.isArray(list) && list.length
    );

    const fromNames = (() => {
      const ids = Array.isArray(task.collaboratorIds)
        ? task.collaboratorIds
        : Array.isArray(task.collaboratorsIds)
        ? task.collaboratorsIds
        : [];
      const names = Array.isArray(task.collaboratorNames)
        ? task.collaboratorNames
        : [];
      if (!ids.length) return [];
      return ids.map((id, index) => ({ id, name: names[index] }));
    })();

    const base = explicitList && explicitList.length ? explicitList : fromNames;

    const normalized = (base || [])
      .map((item, index) => normalizeCollaborator(item, index))
      .filter(Boolean);

    const deduped = [];
    const seen = new Set();
    normalized.forEach((item, index) => {
      const key = String(item.id ?? index);
      if (!key || seen.has(key)) return;
      seen.add(key);
      deduped.push(item);
    });

    return deduped;
  })();

  const priorityDisplay = (() => {
    const raw = task.priority ?? task.priorityNumber;
    const value = Number(raw);
    return Number.isFinite(value) ? String(value) : "";
  })();

  const TAG_BASE =
    "rounded-full px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1";

  const getStatusColor = (statusRaw) => {
    const s = String(statusRaw || "").toLowerCase();
    if (s === "to-do" || s === "todo")
      return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
    if (s === "in progress" || s === "in-progress")
      return `${TAG_BASE} bg-blue-100 text-blue-700 border border-blue-200`;
    if (s === "completed" || s === "done")
      return `${TAG_BASE} bg-emerald-100 text-emerald-700 border border-emerald-200`;
    if (s === "blocked")
      return `${TAG_BASE} bg-red-100 text-red-700 border border-red-200`;
    return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
  };

  const getPriorityColor = (priorityRaw) => {
    const value = Number(priorityRaw);
    if (!Number.isFinite(value)) {
      return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
    }
    if (value >= 8) {
      return `${TAG_BASE} bg-red-100 text-red-700 border border-red-200`;
    }
    if (value >= 5) {
      return `${TAG_BASE} bg-yellow-100 text-yellow-700 border border-yellow-200`;
    }
    return `${TAG_BASE} bg-emerald-100 text-emerald-700 border border-emerald-200`;
  };

  const fmt = (d) =>
    d && toDate(d)
      ? toDate(d).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const isOverdue = (() => {
    const due = toDate(task.dueDate);
    return !!due && due < new Date() && task.status !== "completed";
  })();

  const getStatusLabel = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "to-do" || s === "todo") return "To-Do";
    if (s === "in progress" || s === "in-progress") return "In Progress";
    if (s === "completed" || s === "done") return "Completed";
    if (s === "blocked") return "Blocked";
    return "Unknown";
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl font-bold text-foreground pr-4">
                  {task.title}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getStatusColor(task.status)}>
                    {getStatusLabel(task.status)}
                  </Badge>
                  <Badge className={getPriorityColor(priorityDisplay)}>
                    {priorityDisplay
                      ? `Priority ${priorityDisplay}`
                      : "Priority —"}
                  </Badge>
                  {isOverdue && (
                    <Badge
                      className={`${TAG_BASE} bg-red-100 text-red-700 border border-red-200`}
                    >
                      Overdue
                    </Badge>
                  )}
                </div>
                {task.projectName && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    Project: {task.projectName}
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-8 sm:mt-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disableActions || typeof onEdit !== "function"}
                  onClick={() => {
                    if (disableActions || typeof onEdit !== "function") return;
                    onEdit(task);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disableActions || typeof onDelete !== "function"}
                  onClick={() => {
                    if (disableActions || typeof onDelete !== "function")
                      return;
                    onDelete(task);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-2">
                Description
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {task.description || "—"}
              </p>
            </div>
            {/* Subtasks Section */}
            {task.projectId && task.id && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        Subtasks
                      </h3>
                      {(task.subtaskCount || 0) > 0 && (
                        <Badge variant="secondary">
                          {task.subtaskCompletedCount || 0}/
                          {task.subtaskCount || 0}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowSubtaskDialog(true)}
                      disabled={disableActions}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Subtask
                    </Button>
                  </div>

                  {/* Progress Bar */}
                  {(task.subtaskCount || 0) > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{task.subtaskProgress || 0}%</span>
                      </div>
                      <Progress
                        value={task.subtaskProgress || 0}
                        className="h-2"
                      />
                    </div>
                  )}

                  {/* Subtasks List */}
                  <SubtasksList
                    projectId={task.projectId}
                    taskId={task.id}
                    onSubtaskChange={async () => {
                      if (typeof onSubtaskChange === "function")
                        await onSubtaskChange();
                    }}
                  />
                </div>
                <Separator />
              </>
            )}

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Assigned to
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={assignee.avatar || "/placeholder.svg"}
                          alt={assignee.name}
                        />
                        <AvatarFallback className="text-xs">
                          {toInitials(assignee.name || "")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm text-foreground">
                          {assignee.name || "Unassigned"}
                        </p>
                        {assignee.role && (
                          <p className="text-xs text-muted-foreground">
                            {assignee.role}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Created by
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {toInitials(
                            task.creatorName ||
                              (task.createdBy
                                ? String(task.createdBy).slice(0, 4)
                                : "?")
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm text-foreground">
                          {task.creatorName ||
                            (task.creatorSummary && task.creatorSummary.name) ||
                            (task.createdBy
                              ? `User ${String(task.createdBy).slice(0, 4)}`
                              : "Unknown")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Collaborators
                    </p>
                    {collaborators.length === 0 ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        No collaborators added.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {collaborators.map((person) => (
                          <div
                            key={person.id}
                            className="flex items-center gap-2"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={person.avatar || "/placeholder.svg"}
                                alt={person.name}
                              />
                              <AvatarFallback className="text-xs">
                                {toInitials(person.name || "")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm text-foreground truncate">
                                {person.name}
                              </p>
                              {(person.email || person.role) && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {[person.email, person.role]
                                    .filter(Boolean)
                                    .join(" • ")}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Due Date
                    </p>
                    <p
                      className={`text-sm mt-1 ${
                        isOverdue ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {fmt(task.dueDate)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Created
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {fmt(task.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Last Updated
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {fmt(task.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {tags.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">Tags</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Comments</h3>
                <Badge variant="secondary">
                  {(task.comments || []).length}
                </Badge>
              </div>
              {(task.comments || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet</p>
              ) : (
                <div className="space-y-3">
                  {(task.comments || []).map((comment) => (
                    <div
                      key={comment.id}
                      className="flex gap-3 p-3 bg-muted rounded-lg"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={comment.author?.avatar || "/placeholder.svg"}
                          alt={comment.author?.name || "User"}
                        />
                        <AvatarFallback className="text-xs">
                          {toInitials(comment.author?.name || "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-foreground">
                            {comment.author?.name || "User"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fmt(comment.createdAt)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(task.attachments || []).length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">
                      Attachments
                    </h3>
                    <Badge variant="secondary">
                      {(task.attachments || []).length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {(task.attachments || []).map((attachment, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-muted rounded"
                      >
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {attachment}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <SubtaskDialog
        isOpen={showSubtaskDialog}
        onClose={() => setShowSubtaskDialog(false)}
        projectId={task.projectId}
        taskId={task.id}
        teamMembers={teamMembers}
        currentUserId={currentUserId}
        onSubtaskCreated={async () => {
          setShowSubtaskDialog(false);
          setSubtaskRefreshKey((prev) => prev + 1);
          if (typeof onSubtaskChange === "function") await onSubtaskChange();
        }}
      />
    </>
  );
}

function SubtasksList({ projectId, taskId, onSubtaskChange }) {
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSubtasks = async () => {
    try {
      // Only show loading spinner on first load
      if (subtasks.length === 0) {
        setLoading(true);
      }
      const data = await listSubtasks(projectId, taskId);
      setSubtasks(data || []);
    } catch (err) {
      console.error("Failed to load subtasks:", err);
      setSubtasks([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (projectId && taskId) {
      loadSubtasks();
    }
  }, [projectId, taskId]);

  const handleToggleStatus = async (subtask) => {
    const newStatus = subtask.status === "completed" ? "to-do" : "completed";
    try {
      setSubtasks((prev) => {
        const updated = prev.map((s) =>
          s.id === subtask.id ? { ...s, status: newStatus } : s
        );
        return updated;
      });

      await updateSubtask(projectId, taskId, subtask.id, { status: newStatus });

      if (onSubtaskChange) {
        await onSubtaskChange();
      }
      await loadSubtasks();
    } catch (err) {
      console.error("Failed to update subtask:", err);
      await loadSubtasks();
    }
  };

  const handleDeleteSubtask = async (subtask) => {
    if (!confirm("Delete this subtask?")) return;
    try {
      setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id));

      await deleteSubtask(projectId, taskId, subtask.id);

      if (onSubtaskChange) await onSubtaskChange();
      await loadSubtasks();
    } catch (err) {
      console.error("Failed to delete subtask:", err);
      await loadSubtasks();
    }
  };
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading subtasks...</p>;
  }

  if (subtasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No subtasks yet. Click "Add Subtask" to create one.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {subtasks.map((subtask) => (
        <div
          key={subtask.id}
          className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition"
        >
          <button
            onClick={() => handleToggleStatus(subtask)}
            className="flex-shrink-0"
          >
            {subtask.status === "completed" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm ${
                subtask.status === "completed"
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {subtask.title}
            </p>
            {subtask.description && (
              <p className="text-xs text-muted-foreground truncate">
                {subtask.description}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="flex-shrink-0"
            onClick={() => handleDeleteSubtask(subtask)}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function SubtaskDialog({
  isOpen,
  onClose,
  projectId,
  taskId,
  teamMembers = [],
  currentUserId,
  onSubtaskCreated,
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "to-do",
    priority: "5",
    dueDate: "",
    tags: "",
    collaboratorsIds: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setForm({
        title: "",
        description: "",
        status: "to-do",
        priority: "5",
        dueDate: "",
      });
      setError("");
      setSaving(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const title = form.title.trim();
    if (!title) {
      setError("Subtask title is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        title,
        description: form.description.trim(),
        status: form.status,
        priority: Number(form.priority),
        assigneeId: "temp", // Will be set by parent task owner
      };

      if (form.dueDate) {
        const due = new Date(`${form.dueDate}T00:00:00`);
        if (!Number.isNaN(due.getTime())) {
          payload.dueDate = due.toISOString();
        }
      }

      await createSubtask(projectId, taskId, payload);
      if (onSubtaskCreated) await onSubtaskCreated();
    } catch (err) {
      setError(err?.message || "Failed to create subtask");
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Add Subtask</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="subtask-title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </label>
              <input
                id="subtask-title"
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Subtask title"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="subtask-description"
                className="text-sm font-medium"
              >
                Description
              </label>
              <textarea
                id="subtask-description"
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Add details about this subtask"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="subtask-priority"
                  className="text-sm font-medium"
                >
                  Priority (1-10)
                </label>
                <select
                  id="subtask-priority"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value })
                  }
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((p) => (
                    <option key={p} value={p}>
                      Priority {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="subtask-due" className="text-sm font-medium">
                  Due date
                </label>
                <input
                  id="subtask-due"
                  type="date"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm({ ...form, dueDate: e.target.value })
                  }
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Subtask"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
