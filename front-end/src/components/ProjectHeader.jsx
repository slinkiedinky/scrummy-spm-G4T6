"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Users, DollarSign, Settings, Share } from "lucide-react"

const priorityMeta = {
  low: {
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    label: "Low",
  },
  medium: {
    badge: "bg-yellow-100 text-yellow-700 border border-yellow-200",
    label: "Medium",
  },
  high: {
    badge: "bg-red-100 text-red-700 border border-red-200",
    label: "High",
  },
};

const resolveProjectPriority = (raw) => {
  if (typeof raw === "string" && priorityMeta[raw.trim().toLowerCase()]) {
    return raw.trim().toLowerCase();
  }
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    if (numeric >= 8) return "high";
    if (numeric <= 3) return "low";
    return "medium";
  }
  return "medium";
};

export function ProjectHeader({ project }) {
  const getStatusColor = (status) => {
    switch ((status || "").toLowerCase()) {
      case "to-do":
        return "bg-blue-400 text-white"
      case "in progress":
        return "bg-yellow-300 text-secondary-foreground"
      case "completed":
        return "bg-emerald-600 text-white"
      case "blocked":
        return "bg-red-500 text-white"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const priorityKey = resolveProjectPriority(project.priority)
  const priorityBadge = priorityMeta[priorityKey] ?? priorityMeta.medium

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  const isOverdue = new Date(project.dueDate) < new Date() && project.status !== "completed"

  return (
    <div className="border-b border-border bg-card p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        {/* Project Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-3xl font-bold text-card-foreground">{project.name}</h1>
            <Badge className={getStatusColor(project.status)}>
              {project.status
                ? project.status.charAt(0).toUpperCase() + project.status.slice(1).replace("-", " ")
                : "Status"}
            </Badge>
            <Badge className={`${priorityBadge.badge} border border-border/40`} variant="outline">
              {`${priorityBadge.label} Priority`}
            </Badge>
          </div>

          <p className="text-muted-foreground mb-4 max-w-2xl">{project.description}</p>

          {/* Project Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Due:</span>
              <span className={isOverdue ? "text-destructive font-medium" : "text-card-foreground"}>
                {formatDate(project.dueDate)}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Team:</span>
              <span className="text-card-foreground">{project.team.length} members</span>
            </div>

            {project.budget && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Budget:</span>
                <span className="text-card-foreground">${project.budget.toLocaleString()}</span>
              </div>
            )}

            {project.client && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Client:</span>
                <span className="text-card-foreground">{project.client}</span>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="max-w-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-card-foreground">Project Progress</span>
              <span className="text-sm font-medium text-card-foreground">{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-3" />
          </div>
        </div>

        {/* Actions and Team */}
        <div className="flex flex-col gap-4">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button size="sm" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>

          {/* Team Members */}
          <div>
            <p className="text-sm font-medium text-card-foreground mb-2">Team Members</p>
            <div className="flex flex-wrap gap-2">
              {project.team.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 bg-background rounded-lg p-2 border border-border"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.name} />
                    <AvatarFallback className="text-xs">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
