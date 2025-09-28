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
  Tag,
  MessageSquare,
  Paperclip,
  Edit,
  Trash2,
} from "lucide-react";
import type { Task } from "@/types/project";

interface TaskDetailModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
}: TaskDetailModalProps) {
  // Fallback if task.assignee is just an id string
  const assignee =
    typeof (task as any).assignee === "object" && (task as any).assignee
      ? (task as any).assignee
      : {
          id: String((task as any).assignee || (task as any).assigneeId || ""),
          name: `User ${String((task as any).assignee || "").slice(0, 4)}`,
          role: "Member",
          avatar: "",
        };

  const getPriorityColor = (priority: number | string) => {
    // Convert to number if it's a string
    const priorityNum =
      typeof priority === "string" ? parseInt(priority) : priority;

    if (priorityNum >= 9)
      return "bg-red-100 text-red-700 border border-red-200"; // Critical (9-10)
    if (priorityNum >= 7)
      return "bg-orange-100 text-orange-700 border border-orange-200"; // High (7-8)
    if (priorityNum >= 4)
      return "bg-yellow-100 text-yellow-800 border border-yellow-200"; // Medium (4-6)
    return "bg-green-100 text-green-700 border border-green-200"; // Low (1-3)
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo":
        return "bg-muted text-muted-foreground";
      case "in-progress":
        return "bg-primary text-primary-foreground";
      case "review":
        return "bg-secondary text-secondary-foreground";
      case "completed":
        return "bg-chart-3 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isOverdue =
    !!task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== "completed";

  return (
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
                  {task.status.charAt(0).toUpperCase() +
                    task.status.slice(1).replace("-", " ")}
                </Badge>
                <Badge
                  className={getPriorityColor(task.priority)}
                  variant="outline"
                >
                  Priority {task.priority}
                </Badge>
                {isOverdue && <Badge variant="destructive">Overdue</Badge>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button size="sm" variant="outline">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description */}
          <div>
            <h3 className="font-semibold text-foreground mb-2">Description</h3>
            <p className="text-muted-foreground leading-relaxed">
              {task.description || "—"}
            </p>
          </div>

          <Separator />

          {/* Task Details */}
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
                        {assignee.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm text-foreground">{assignee.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignee.role}
                      </p>
                    </div>
                  </div>
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
                    {formatDate(task.dueDate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Created</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(task.createdAt)}
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
                    {formatDate(task.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {task.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Tags</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Comments */}
          <Separator />
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Comments</h3>
              <Badge variant="secondary">{(task.comments || []).length}</Badge>
            </div>
            {(task.comments || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet</p>
            ) : (
              <div className="space-y-3">
                {(task.comments || []).map((comment: any) => (
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
                        {(comment.author?.name || "U")
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground">
                          {comment.author?.name || "User"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(comment.createdAt)}
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

          {/* Attachments */}
          {(task.attachments || []).length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Attachments</h3>
                  <Badge variant="secondary">
                    {(task.attachments || []).length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {(task.attachments || []).map(
                    (attachment: string, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-muted rounded"
                      >
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {attachment}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
