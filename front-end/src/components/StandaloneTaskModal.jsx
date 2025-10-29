"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecurringTaskForm } from "@/components/RecurringTaskForm";

const STATUS = ["to-do", "in progress", "completed", "blocked"];
const STATUS_LABELS = {
  "to-do": "To-Do",
  "in progress": "In Progress",
  completed: "Completed",
  blocked: "Blocked",
};
const TASK_PRIORITY_VALUES = Array.from({ length: 10 }, (_, i) =>
  String(i + 1)
);

export function StandaloneTaskModal({
  isOpen,
  onClose,
  onSubmit,
  currentUser,
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "to-do",
    priority: "5",
    dueDate: "",
    tags: "",
    isRecurring: false,
    recurrencePattern: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [recurringData, setRecurringData] = useState({
    isRecurring: false,
    recurrencePattern: null,
  });
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!form.dueDate) {
      setError("Due date is required");
      return;
    }

    if (!currentUser?.uid) {
      setError("You must be signed in");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ownerId: currentUser.uid,
        assigneeId: currentUser.uid,
        createdBy: currentUser.uid,
        ...(recurringData.isRecurring && {
          isRecurring: true,
          recurrencePattern: recurringData.recurrencePattern,
          recurringInstanceCount: 0,
        }),
      };

      await onSubmit(payload);

      // Reset form on success
      setForm({
        title: "",
        description: "",
        status: "to-do",
        priority: "5",
        dueDate: "",
        tags: "",
      });
      setRecurringData({ isRecurring: false, recurrencePattern: null });
      setError("");
    } catch (err) {
      setError(err?.message || "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setForm({
        title: "",
        description: "",
        status: "to-do",
        priority: "5",
        dueDate: "",
        tags: "",
      });
      setRecurringData({ isRecurring: false, recurrencePattern: null });
      setError("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Add Standalone Task</DialogTitle>
            <DialogDescription>
              Provide details for the new task. You can adjust them later.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="task-title"
                className="text-sm font-medium text-foreground"
              >
                Title
              </label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Design login screen"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="task-description"
                className="text-sm font-medium text-foreground"
              >
                Description
              </label>
              <textarea
                id="task-description"
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Wireframes + final design in Figma"
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="task-status"
                  className="text-sm font-medium text-foreground"
                >
                  Status
                </label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm({ ...form, status: value })}
                >
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
                <label
                  htmlFor="task-priority"
                  className="text-sm font-medium text-foreground"
                >
                  Priority
                </label>
                <Select
                  value={form.priority}
                  onValueChange={(value) =>
                    setForm({ ...form, priority: value })
                  }
                >
                  <SelectTrigger id="task-priority" className="w-full">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITY_VALUES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  10 = Most Urgent, 1 = Least Urgent
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="task-due"
                className="text-sm font-medium text-foreground"
              >
                Due date <span className="text-destructive">*</span>
              </label>
              <Input
                id="task-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">Required field</p>
            </div>
            <RecurringTaskForm
              value={recurringData}
              onChange={setRecurringData}
              currentDueDate={form.dueDate}
            />
            <div className="space-y-2">
              <label
                htmlFor="task-tags"
                className="text-sm font-medium text-foreground"
              >
                Tags
              </label>
              <Input
                id="task-tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="Enter comma-separated tags"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.title.trim()}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
