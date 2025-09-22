"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Users, DollarSign, MoreVertical, Eye, AlertTriangle } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Project, TeamMember } from "@/types/project"

interface ProjectCardProps { project: Project }

// Robust initials from real names
function getInitials(member: TeamMember) {
  const source = (member.name || member.email || member.id || "").trim()
  if (!source) return "?"
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
  const token = parts[0].includes("@") ? parts[0].split("@")[0] : parts[0]
  return token.slice(0, 2).toUpperCase()
}

export function ProjectCard({ project }: ProjectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":     return "bg-primary text-primary-foreground"
      case "planning":   return "bg-secondary text-secondary-foreground"
      case "on-hold":    return "bg-muted text-muted-foreground"
      case "completed":  return "bg-emerald-600 text-white"
      default:           return "bg-muted text-muted-foreground"
    }
  }
  // Priority colors: high=red, medium=yellow, low=green
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
      case "high":   return "bg-red-500 text-white"
      case "medium": return "bg-yellow-400 text-black"
      case "low":    return "bg-green-500 text-white"
      default:       return "bg-muted text-muted-foreground"
    }
  }
  const getRiskLevel = () => {
    const p = project.overduePercentage || 0
    if (p > 20) return { level: "High", color: "bg-red-500 text-white" }
    if (p > 10) return { level: "Medium", color: "bg-yellow-400 text-black" }
    return { level: "Low", color: "bg-green-500 text-white" }
  }
  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  const risk = getRiskLevel()

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-card-foreground truncate">{project.name}</h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/projects/${project.id}`} className="flex items-center">
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>Edit Project</DropdownMenuItem>
              <DropdownMenuItem>Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Badge className={getStatusColor(project.status)} variant="secondary">
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </Badge>
          <Badge className={getPriorityColor(project.priority)} variant="outline">
            {project.priority.charAt(0).toUpperCase() + project.priority.slice(1)}
          </Badge>
          <Badge className={`${risk.color} flex items-center gap-1`} variant="outline">
            <AlertTriangle className="h-3 w-3" />
            {risk.level} Risk
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progress</span>
            <span className="text-sm font-medium text-card-foreground">{project.completionPercentage ?? project.progress ?? 0}%</span>
          </div>
          <Progress value={project.completionPercentage ?? project.progress ?? 0} className="h-2" />
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
            <span>{project.team?.length ?? 0} team members</span>
          </div>
          {!!project.budget && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span>${Number(project.budget).toLocaleString()}</span>
            </div>
          )}
          {project.client && (
            <div>
              <span className="font-medium">Client:</span> {project.client}
            </div>
          )}
        </div>

        {/* Team avatars (initials from REAL names) */}
        <div className="flex items-center justify-between">
          <div className="flex -space-x-2">
            {(project.team ?? []).slice(0, 4).map((member) => (
              <Avatar key={member.id} className="h-8 w-8 border-2 border-background" title={member.name}>
                <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.name} />
                <AvatarFallback className="text-xs">{getInitials(member)}</AvatarFallback>
              </Avatar>
            ))}
            {(project.team?.length ?? 0) > 4 && (
              <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                <span className="text-xs text-muted-foreground">
                  +{(project.team?.length ?? 0) - 4}
                </span>
              </div>
            )}
          </div>

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
