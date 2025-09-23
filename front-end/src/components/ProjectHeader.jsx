"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Users, DollarSign, Settings, Share } from "lucide-react"

export function ProjectHeader({ project }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-primary text-primary-foreground"
      case "planning":
        return "bg-secondary text-secondary-foreground"
      case "on-hold":
        return "bg-muted text-muted-foreground"
      case "completed":
        return "bg-chart-3 text-white"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getPriorityColor = (priority) => {
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
              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
            </Badge>
            <Badge className={getPriorityColor(project.priority)} variant="outline">
              {project.priority.charAt(0).toUpperCase() + project.priority.slice(1)} Priority
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