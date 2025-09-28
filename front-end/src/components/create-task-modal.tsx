"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  createProjectTask,
  createStandaloneTask,
  getAllUsers,
} from "@/lib/api";
import { Plus, X, Users, Calendar, Clock, Repeat, User } from "lucide-react";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
  projectId?: string; // If provided, creates project task; otherwise standalone
  currentUser?: any;
  projectTeam?: any[];
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onTaskCreated,
  projectId,
  currentUser,
  projectTeam = [],
}: CreateTaskModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: 5,
    assigneeId: "",
    dueDate: "",
    status: "todo",
    tags: [] as string[],
    collaborators: [] as string[],
    notes: "",
    recurrence: {
      enabled: false,
      interval: "weekly" as "daily" | "weekly" | "monthly" | "yearly",
      value: 1,
      endDate: "",
      maxOccurrences: undefined as number | undefined,
    },
  });

  const [newTag, setNewTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Load all users for assignment and collaboration
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const users = await getAllUsers();
        setAllUsers(users);
      } catch (err) {
        console.error("Error loading users:", err);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  // Use project team if available, otherwise all users
  const availableUsers = projectTeam.length > 0 ? projectTeam : allUsers;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!formData.assigneeId) {
      setError("Please assign the task to someone");
      return;
    }

    if (!formData.dueDate) {
      setError("Due date is required");
      return;
    }

    // Validate recurrence settings if enabled
    if (formData.recurrence.enabled) {
      if (formData.recurrence.endDate && formData.recurrence.maxOccurrences) {
        setError("Please specify either end date OR max occurrences, not both");
        return;
      }
      if (!formData.recurrence.endDate && !formData.recurrence.maxOccurrences) {
        setError(
          "For recurring tasks, please specify either an end date or max occurrences"
        );
        return;
      }
    }

    setIsSubmitting(true);
    setError("");

    try {
      const taskData = {
        ...formData,
        createdBy: currentUser?.uid || "",
      };

      if (projectId) {
        await createProjectTask(projectId, taskData);
      } else {
        await createStandaloneTask(taskData);
      }

      // Reset form
      setFormData({
        title: "",
        description: "",
        priority: 5,
        assigneeId: "",
        dueDate: "",
        status: "todo",
        tags: [],
        collaborators: [],
        notes: "",
        recurrence: {
          enabled: false,
          interval: "weekly",
          value: 1,
          endDate: "",
          maxOccurrences: undefined,
        },
      });

      onTaskCreated();
      onClose();
    } catch (err) {
      console.error("Error creating task:", err);
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const toggleCollaborator = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      collaborators: prev.collaborators.includes(userId)
        ? prev.collaborators.filter((id) => id !== userId)
        : [...prev.collaborators, userId],
    }));
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 9) return "Critical";
    if (priority >= 7) return "High";
    if (priority >= 4) return "Medium";
    return "Low";
  };

  const isStandalone = !projectId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create {isStandalone ? "Standalone" : "Project"} Task
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isStandalone
              ? "Create a personal task"
              : `Adding task to current project`}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Basic Information
            </h3>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Enter task title..."
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Enter task description..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Additional notes or instructions..."
                rows={2}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Assignment & Priority */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Assignment & Priority
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignee">Assign to *</Label>
                {loadingUsers ? (
                  <div className="text-sm text-muted-foreground">
                    Loading users...
                  </div>
                ) : (
                  <Select
                    value={formData.assigneeId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, assigneeId: value }))
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority (1-10) *</Label>
              <div className="space-y-2">
                <input
                  type="range"
                  id="priority"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      priority: parseInt(e.target.value),
                    }))
                  }
                  className="w-full"
                  disabled={isSubmitting}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 (Low)</span>
                  <span className="font-medium">
                    {formData.priority} - {getPriorityLabel(formData.priority)}
                  </span>
                  <span>10 (Critical)</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                }
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Collaborators */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Collaborators
            </h3>

            <div className="space-y-2">
              <Label>Invite Collaborators (optional)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                {availableUsers.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`collab-${user.id}`}
                      checked={formData.collaborators.includes(user.id)}
                      onCheckedChange={() => toggleCollaborator(user.id)}
                      disabled={isSubmitting || user.id === formData.assigneeId}
                    />
                    <Label
                      htmlFor={`collab-${user.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {user.name}
                    </Label>
                  </div>
                ))}
              </div>
              {formData.collaborators.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formData.collaborators.length} collaborator(s) selected
                </p>
              )}
            </div>
          </div>

          {/* Task Recurrence */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Task Recurrence
            </h3>

            <div className="flex items-center space-x-2">
              <Switch
                id="recurring"
                checked={formData.recurrence.enabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    recurrence: { ...prev.recurrence, enabled: checked },
                  }))
                }
                disabled={isSubmitting}
              />
              <Label htmlFor="recurring">Make this a recurring task</Label>
            </div>

            {formData.recurrence.enabled && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Repeat every</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={formData.recurrence.value}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            recurrence: {
                              ...prev.recurrence,
                              value: parseInt(e.target.value) || 1,
                            },
                          }))
                        }
                        className="w-20"
                        disabled={isSubmitting}
                      />
                      <Select
                        value={formData.recurrence.interval}
                        onValueChange={(
                          value: "daily" | "weekly" | "monthly" | "yearly"
                        ) =>
                          setFormData((prev) => ({
                            ...prev,
                            recurrence: { ...prev.recurrence, interval: value },
                          }))
                        }
                        disabled={isSubmitting}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Day(s)</SelectItem>
                          <SelectItem value="weekly">Week(s)</SelectItem>
                          <SelectItem value="monthly">Month(s)</SelectItem>
                          <SelectItem value="yearly">Year(s)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>End recurrence (choose one)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="endDate">End by date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.recurrence.endDate}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            recurrence: {
                              ...prev.recurrence,
                              endDate: e.target.value,
                              maxOccurrences: e.target.value
                                ? undefined
                                : prev.recurrence.maxOccurrences,
                            },
                          }))
                        }
                        disabled={
                          isSubmitting || !!formData.recurrence.maxOccurrences
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxOccurrences">
                        Or after # occurrences
                      </Label>
                      <Input
                        id="maxOccurrences"
                        type="number"
                        min="1"
                        max="100"
                        value={formData.recurrence.maxOccurrences || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            recurrence: {
                              ...prev.recurrence,
                              maxOccurrences: e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                              endDate: e.target.value
                                ? ""
                                : prev.recurrence.endDate,
                            },
                          }))
                        }
                        placeholder="e.g., 10"
                        disabled={isSubmitting || !!formData.recurrence.endDate}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tags & Organization
            </h3>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag..."
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addTag())
                  }
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  onClick={addTag}
                  size="sm"
                  disabled={isSubmitting}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag) => (
                    <div
                      key={tag}
                      className="bg-muted px-2 py-1 rounded-sm text-sm flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-muted-foreground hover:text-foreground"
                        disabled={isSubmitting}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Creating..." : "Create Task"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
