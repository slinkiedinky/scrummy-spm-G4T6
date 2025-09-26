"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Calendar, Clock, User, Tag, MessageSquare, Paperclip, Edit, Trash2 } from "lucide-react"

function toInitials(name) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return (parts[0].includes("@") ? parts[0].split("@")[0] : parts[0]).slice(0, 2).toUpperCase()
}

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") return new Date(value)
  if (typeof value === "object" && typeof value.seconds === "number") return new Date(value.seconds * 1000)
  return null
}

export function TaskDetailModal({ task, isOpen, onClose }) {
  const assignee =
    typeof task.assignee === "object" && task.assignee
      ? task.assignee
      : (() => {
          const id = String(task.assignee || task.assigneeId || "")
          return id
            ? { id, name: `User ${id.slice(0, 4)}`, role: "Member", avatar: "" }
            : { name: "Unassigned", role: "" }
        })()

  const getPriorityColor = (priority) => {
    switch ((priority || "medium").toLowerCase()) {
      case "low":
        return "bg-green-500 text-white border-green-500"
      case "medium":
        return "bg-yellow-400 text-white border border-yellow-400"
      case "high":
        return "bg-red-500 text-white border-red-500"
      default:
        return "bg-muted text-muted-foreground border-muted"
    }
  }

  const getStatusColor = (status) => {
  switch (status) {
    case "to-do":
      return "bg-blue-400 text-white"
    case "in progress":
      return "bg-yellow-400 text-black"
    case "completed":
      return "bg-green-400 text-white"
    case "blocked":
      return "bg-muted text-muted-foreground"
    default:
      return "bg-muted text-muted-foreground"
  }
}


  const fmt = (d) =>
    d && toDate(d)
      ? toDate(d).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—"

  const isOverdue = (() => {
    const due = toDate(task.dueDate)
    return !!due && due < new Date() && task.status !== "completed"
  })()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-bold text-foreground pr-4">{task.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getStatusColor(task.status)}>
                  {task.status.charAt(0).toUpperCase() + task.status.slice(1).replace("-", " ")}
                </Badge>
                <Badge className={getPriorityColor(task.priority)} variant="outline">
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                </Badge>
                {isOverdue && <Badge variant="destructive">Overdue</Badge>}
              </div>
              {task.projectName && (
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  Project: {task.projectName}
                </p>
              )}
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
          <div>
            <h3 className="font-semibold text-foreground mb-2">Description</h3>
            <p className="text-muted-foreground leading-relaxed">{task.description || "—"}</p>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Assigned to</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={assignee.avatar || "/placeholder.svg"} alt={assignee.name} />
                      <AvatarFallback className="text-xs">{toInitials(assignee.name || "")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm text-foreground">{assignee.name || "Unassigned"}</p>
                      {assignee.role && <p className="text-xs text-muted-foreground">{assignee.role}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Due Date</p>
                  <p className={`text-sm mt-1 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                    {fmt(task.dueDate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Created</p>
                  <p className="text-sm text-muted-foreground mt-1">{fmt(task.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Last Updated</p>
                  <p className="text-sm text-muted-foreground mt-1">{fmt(task.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>

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
                {(task.comments || []).map((comment) => (
                  <div key={comment.id} className="flex gap-3 p-3 bg-muted rounded-lg">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.author?.avatar || "/placeholder.svg"} alt={comment.author?.name || "User"} />
                      <AvatarFallback className="text-xs">{toInitials(comment.author?.name || "")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground">{comment.author?.name || "User"}</p>
                        <p className="text-xs text-muted-foreground">{fmt(comment.createdAt)}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{comment.content}</p>
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
                  <h3 className="font-semibold text-foreground">Attachments</h3>
                  <Badge variant="secondary">{(task.attachments || []).length}</Badge>
                </div>
                <div className="space-y-2">
                  {(task.attachments || []).map((attachment, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{attachment}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
