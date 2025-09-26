"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

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
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { format, startOfDay } from "date-fns";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const STATUS = ["to-do", "in progress", "completed", "blocked"];
const PRIORITY = ["low", "medium", "high"];

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
  priority: "medium",
  status: "to-do",
  tags: "",
  collaboratorsIds: [],
});

export default function ProjectDetailPage() {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [pStatus, setPStatus] = useState("to-do");
  const [pPriority, setPPriority] = useState("medium");

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(() => createEmptyTaskForm());
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [selectedMember, setSelectedMember] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState("");

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
      setProject(p);
      setTasks((t || []).map((task) => ({
        ...task,
        collaboratorsIds: ensureArray(task.collaboratorsIds),
      })));
      setUsers(Array.isArray(u) ? u : []);
      setPStatus((p.status || "to-do").toLowerCase());
      setPPriority((p.priority || "medium").toLowerCase());
      setSelectedMember("");
      setMemberError("");
    } catch (e) {
      setErr(e?.message || "Failed to load project");
      setProject(null);
      setTasks([]);
      setUsers([]);
      setMemberError("");
    } finally {
      setLoading(false);
    }
  }, [id]);

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
      setCreatingTask(false);
      resetTaskForm();
    }
  }, [resetTaskForm]);

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

  const isCreateDisabled = creatingTask || !taskForm.title.trim();

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
    ? "Select collaborators"
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

  async function saveProjectMeta() {
    await updateProject(id, { status: pStatus, priority: pPriority });
    if (currentUser?.uid) {
      await load(currentUser.uid);
    }
  }

  async function handleCreateTask(e) {
    e?.preventDefault();
    if (creatingTask) return;

    const title = taskForm.title.trim();
    if (!title) {
      setTaskError("Task title is required.");
      return;
    }

    const assignee = taskForm.assigneeId.trim();
    if (!assignee) {
      setTaskError("Task assignee is required.");
      return;
    }

    if (!currentUser?.uid) {
      setTaskError("You must be signed in to create tasks.");
      return;
    }

    setCreatingTask(true);
    setTaskError("");

    try {
      const payload = {
        title,
        description: taskForm.description.trim(),
        status: taskForm.status,
        priority: taskForm.priority,
        assigneeId: assignee,
        tags: taskForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      if (taskForm.dueDate) {
        const due = new Date(taskForm.dueDate);
        if (Number.isNaN(due.getTime())) {
          setTaskError("Please provide a valid due date.");
          setCreatingTask(false);
          return;
        }
        payload.dueDate = due.toISOString();
      }

      if (payload.tags.length === 0) {
        delete payload.tags;
      }

      const collaboratorIds = ensureArray(taskForm.collaboratorsIds)
        .filter((id) => id && id !== assignee);
      const uniqueCollaborators = [...new Set(collaboratorIds)];
      if (uniqueCollaborators.length > 0) {
        payload.collaboratorsIds = uniqueCollaborators;
      }

      await createTask(id, payload);
      await load(currentUser.uid);
      handleTaskDialogChange(false);
    } catch (error) {
      setTaskError(error?.message ?? "Failed to create task.");
      setCreatingTask(false);
    }
  }

  async function handleTaskStatus(taskId, status) {
    await updateTask(id, taskId, { status });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
  }

  async function handleDeleteTask(taskId) {
    if (!confirm("Delete this task?")) return;
    await deleteTask(id, taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

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
      <Dialog open={isTaskDialogOpen} onOpenChange={handleTaskDialogChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateTask} className="space-y-6">
            <DialogHeader>
              <DialogTitle>Add Task</DialogTitle>
              <DialogDescription>Provide details for the new task. You can adjust them later.</DialogDescription>
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="task-status" className="text-sm font-medium text-foreground">Status</label>
                  <Select value={taskForm.status} onValueChange={(value) => updateTaskForm("status", value)}>
                    <SelectTrigger id="task-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="task-priority" className="text-sm font-medium text-foreground">Priority</label>
                  <Select value={taskForm.priority} onValueChange={(value) => updateTaskForm("priority", value)}>
                    <SelectTrigger id="task-priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="task-due" className="text-sm font-medium text-foreground">Due date</label>
                  <Input
                    id="task-due"
                    type="datetime-local"
                    value={taskForm.dueDate}
                    onChange={(e) => updateTaskForm("dueDate", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="task-assignee" className="text-sm font-medium text-foreground">Assignee ID</label>
                  <Input
                    id="task-assignee"
                    value={taskForm.assigneeId}
                    onChange={(e) => updateTaskForm("assigneeId", e.target.value)}
                    placeholder="0ry9A6TRwFBT2c7O5jhr"
                  />
                  <p className="text-xs text-muted-foreground">You only see tasks assigned to you.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Collaborators</label>
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
                    <DropdownMenuLabel>Select collaborators</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {collaboratorOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Add team members to this project to invite collaborators.</div>
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
                <p className="text-xs text-muted-foreground">Select one or more teammates to collaborate on this task.</p>
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
              <Button type="button" variant="outline" onClick={() => handleTaskDialogChange(false)} disabled={creatingTask}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreateDisabled}>
                {creatingTask ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="border-b border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold">{project.name || "(untitled project)"}</h1>
              <p className="text-muted-foreground max-w-3xl">{project.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={project.status} />
                <Badge variant="secondary">Priority: {(project.priority || "medium").toLowerCase()}</Badge>
                {project.dueDate && (
                  <Badge variant="secondary">Due: {format(toDate(project.dueDate), "dd MMM yyyy")}</Badge>
                )}
                <Badge variant="outline">Team: {(project.teamIds || []).length}</Badge>
                <Badge variant="outline">Tags: {(project.tags || []).join(", ") || "-"}</Badge>
                <Badge variant="outline">Overdue tasks: {overdueCount}</Badge>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Card className="not-print w-full max-w-xs space-y-3 p-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Project status</div>
                  <Select value={pStatus} onValueChange={setPStatus}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Priority</div>
                  <Select value={pPriority} onValueChange={setPPriority}>
                    <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>{PRIORITY.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={saveProjectMeta}>Save</Button>
              </Card>

            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6 print:p-8">
          <Card className="p-4 space-y-4 not-print">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Team members</h2>
                <p className="text-sm text-muted-foreground">Invite collaborators to work on this project.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={selectedMember}
                  onValueChange={handleMemberSelect}
                  disabled={availableUsers.length === 0 || addingMember}
                >
                  <SelectTrigger className="w-full min-w-[220px] sm:w-[240px]">
                    <SelectValue
                      placeholder={
                        availableUsers.length === 0 ? "No available users" : "Select a user"
                      }
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
                          {`${user.label}${
                            user.email && user.email !== user.label ? ` (${user.email})` : ""
                          }`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddMember}
                  disabled={addingMember || !selectedMember}
                >
                  {addingMember ? "Adding..." : "Add"}
                </Button>
              </div>
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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teamMembers.map((member) => {
                  const displayName = member.displayName || member.fullName || member.email || member.id;
                  const secondary =
                    member.email && member.email !== displayName
                      ? member.email
                      : member.id !== displayName
                        ? member.id
                        : "";
                  return (
                    <div key={member.id} className="rounded-lg border border-border bg-card/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{displayName}</p>
                          {secondary && (
                            <p className="text-xs text-muted-foreground truncate">{secondary}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          {member.isCurrentUser && <Badge variant="secondary">You</Badge>}
                          {member.isOwner && <Badge variant="outline">Owner</Badge>}
                        </div>
                      </div>
                      {member.role && (
                        <p className="mt-2 text-xs text-muted-foreground">{member.role}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-4 not-print">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Tasks</h2>
              <Button onClick={() => handleTaskDialogChange(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            </div>

            {tasks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No tasks yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {tasks.map((t) => {
                  const assigneeLabel = resolveUserLabel(t.assigneeId || t.ownerId);
                  const collaboratorLabels = ensureArray(t.collaboratorsIds)
                    .map((id) => resolveUserLabel(id))
                    .filter(Boolean);

                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{t.title}</span>
                          <StatusBadge status={t.status} />
                          <Badge variant="secondary">{(t.priority || "medium").toLowerCase()}</Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {t.description || "—"}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {t.dueDate && <span>Due: {format(toDate(t.dueDate), "dd MMM yyyy")}</span>}
                          {assigneeLabel && <span>Assignee: {assigneeLabel}</span>}
                          {collaboratorLabels.length > 0 && <span>Collaborators: {collaboratorLabels.join(", ")}</span>}
                          {(t.tags || []).length > 0 && <span>Tags: {(t.tags || []).join(", ")}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select value={(t.status || "to-do").toLowerCase()} onValueChange={(value) => handleTaskStatus(t.id, value)}>
                          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteTask(t.id)}
                          title="Delete task"
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
        </div>
      </div>
    </>
  );
}

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "completed" ? "bg-emerald-600" :
    s === "in progress" ? "bg-blue-600" :
    s === "blocked" ? "bg-red-600" : "bg-slate-600";
  return <span className={`text-white text-xs px-2 py-0.5 rounded ${cls}`}>{s || "to-do"}</span>;
}

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000);
  return null;
}
