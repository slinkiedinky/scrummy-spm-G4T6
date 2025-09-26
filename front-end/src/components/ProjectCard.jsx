"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Users, DollarSign, MoreVertical, Eye, AlertTriangle } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// Robust initials from real names
function getInitials(member) {
  const source = (member.name || member.email || member.id || "").trim()
  if (!source) return "?"
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
  const token = parts[0].includes("@") ? parts[0].split("@")[0] : parts[0]
  return token.slice(0, 2).toUpperCase()
}

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

export function ProjectCard({ project }) {
  const getStatusColor = (status) => {
    switch (status) {
        case "to-do":        return "bg-blue-400 text-white border-muted"
        case "in progress":  return "bg-yellow-300 text-secondary-foreground border-yellow-300"
        case "completed":    return "bg-emerald-600 text-white border-emerald-600"
        case "blocked":      return "bg-red-500 text-white border-red-500"
        default:             return "bg-muted text-muted-foreground border-muted"
    }
    }

  const priorityKey = resolveProjectPriority(project.priority)
  const priorityBadge = priorityMeta[priorityKey] ?? priorityMeta.medium

  const getRiskLevel = () => {
    const overdueCount = project.overdueTasksCount || 0
    if (overdueCount > 5) return { level: "High", color: "bg-red-500 text-white border-red-500" }
    if (overdueCount > 2) return { level: "Medium", color: "bg-yellow-400 text-black border-yellow-400" }
    return { level: "Low", color: "bg-green-500 text-white border-green-500" }
  }

  const calculateProgress = () => {
    if (!project.tasks || project.tasks.length === 0) return 0
    const completedTasks = project.tasks.filter(task => task.status === 'completed').length
    return Math.round((completedTasks / project.tasks.length) * 100)
  }
  const formatDate = (s) =>
    new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  const risk = getRiskLevel()
  const progress = calculateProgress()

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-card-foreground truncate">{project.name}</h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Badge className={getStatusColor(project.status)} variant="secondary">
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </Badge>
          <Badge className={priorityBadge.badge} variant="outline">
            {`${priorityBadge.label} Priority`}
          </Badge>
          <Badge className={`${risk.color} flex items-center gap-1`} variant="outline">
            <AlertTriangle className="h-3 w-3" />
            {risk.level} Risk
          </Badge>
        </div>

        {/* Tags */}
        {project.tags && project.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {project.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs bg-slate-100 text-slate-700 border-slate-300">
                {tag}
              </Badge>
            ))}
            {project.tags.length > 3 && (
              <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700 border-slate-300">
                +{project.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progress</span>
            <span className="text-sm font-medium text-card-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {project.tasks && project.tasks.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {project.tasks.filter(task => task.status === 'completed').length} of {project.tasks.length} tasks completed
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-2 text-sm text-muted-foreground">
          {project.dueDate && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Due {formatDate(project.dueDate)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>{project.teamIds?.length ?? 0} team members</span>
          </div>
          {project.overdueTasksCount > 0 && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{project.overdueTasksCount} overdue tasks</span>
            </div>
          )}
        </div>

        {/* Team member count and actions */}
        <div className="flex items-center justify-end">
          <Link href={`/projects/${project.id}`}>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
