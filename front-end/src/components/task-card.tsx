"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, MessageSquare, Paperclip } from "lucide-react"
import type { Task } from "@/types/project"

interface TaskCardProps {
  task: Task
  onClick: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-destructive text-destructive-foreground"
      case "high":
        return "bg-accent text-accent-foreground"
      case "medium":
        return "bg-chart-4 text-white"
      case "low":
        return "bg-chart-5 text-white"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "completed"

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow duration-200 bg-card border-border"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Priority Badge */}
        <div className="flex items-center justify-between">
          <Badge className={getPriorityColor(task.priority)} variant="secondary" size="sm">
            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
          </Badge>
          {isOverdue && (
            <Badge variant="destructive" size="sm">
              Overdue
            </Badge>
          )}
        </div>

        {/* Task Title */}
        <h4 className="font-medium text-card-foreground line-clamp-2">{task.title}</h4>

        {/* Task Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {task.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{task.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          {/* Assignee */}
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={task.assignee.avatar || "/placeholder.svg"} alt={task.assignee.name} />
              <AvatarFallback className="text-xs">
                {task.assignee.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate max-w-20">{task.assignee.name.split(" ")[0]}</span>
          </div>

          {/* Meta Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {task.comments.length > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                <span>{task.comments.length}</span>
              </div>
            )}
            {task.attachments.length > 0 && (
              <div className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                <span>{task.attachments.length}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span className={isOverdue ? "text-destructive" : ""}>{formatDate(task.dueDate)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
