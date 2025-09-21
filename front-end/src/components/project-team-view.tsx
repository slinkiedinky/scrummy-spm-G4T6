"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Users, CheckCircle, Clock, AlertCircle } from "lucide-react"
import type { Project, Task, TeamMember, TaskStatus } from "@/types/project"

interface ProjectTeamViewProps {
  project: Project
}

type MemberRow = {
  member: TeamMember
  tasks: Task[]
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  completionRate: number
}

type Urgency = "completed" | "overdue" | "today" | "soon" | "normal"

export function ProjectTeamView({ project }: ProjectTeamViewProps) {
  const getTeamMemberTasks = (): MemberRow[] => {
    const memberTaskMap = new Map<string, MemberRow>()

    project.team.forEach((member: TeamMember) => {
      // Accept either string id OR object { id, ... }
      const memberTasks: Task[] = (project.tasks || []).filter((task: any) => {
        const assigneeId = typeof task.assignee === "string" ? task.assignee : (task.assignee?.id ?? task.assigneeId)
        return assigneeId === member.id
      })

      const completedTasks = memberTasks.filter((t) => t.status === "completed")
      const inProgressTasks = memberTasks.filter((t) => t.status === "in-progress")
      const overdueTasks = memberTasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed",
      )

      memberTaskMap.set(member.id, {
        member,
        tasks: memberTasks,
        totalTasks: memberTasks.length,
        completedTasks: completedTasks.length,
        inProgressTasks: inProgressTasks.length,
        overdueTasks: overdueTasks.length,
        completionRate:
          memberTasks.length > 0 ? Math.round((completedTasks.length / memberTasks.length) * 100) : 0,
      })
    })

    return Array.from(memberTaskMap.values())
  }

  const teamMemberData = getTeamMemberTasks()

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" })

  const getTaskStatusColor = (status: TaskStatus) => {
    switch (status) {
      case "completed":
        return "bg-chart-3 text-white"
      case "in-progress":
        return "bg-accent text-accent-foreground"
      case "blocked":
        return "bg-destructive text-destructive-foreground"
      default:
        return "bg-secondary text-secondary-foreground"
    }
  }

  const getTaskUrgency = (dueDate: string, status: TaskStatus): Urgency => {
    if (status === "completed") return "completed"
    if (!dueDate) return "normal"
    const today = new Date()
    const due = new Date(dueDate)
    const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntilDue < 0) return "overdue"
    if (daysUntilDue === 0) return "today"
    if (daysUntilDue <= 7) return "soon"
    return "normal"
  }

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.team.length}</div>
            <p className="text-xs text-muted-foreground">Active members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(project.tasks || []).length}</div>
            <p className="text-xs text-muted-foreground">Assigned to team</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Completion</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                (teamMemberData.reduce((acc, m) => acc + m.completionRate, 0) / (teamMemberData.length || 1)) || 0,
              )}
              %
            </div>
            <p className="text-xs text-muted-foreground">Team average</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members with Task Details */}
      <div className="space-y-6">
        {teamMemberData.map((memberData) => (
          <Card key={memberData.member.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={memberData.member.avatar || "/placeholder.svg"} alt={memberData.member.name} />
                    <AvatarFallback>
                      {memberData.member.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {memberData.member.name}
                      <Badge variant="secondary" className="text-xs">
                        {memberData.totalTasks} tasks
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{memberData.member.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{memberData.completionRate}%</div>
                  <p className="text-xs text-muted-foreground">Completion rate</p>
                </div>
              </div>

              {/* Progress bar and stats */}
              <div className="space-y-2">
                <Progress value={memberData.completionRate} className="h-2" />
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-chart-3" />
                    {memberData.completedTasks} completed
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-accent" />
                    {memberData.inProgressTasks} in progress
                  </span>
                  {memberData.overdueTasks > 0 && (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      {memberData.overdueTasks} overdue
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {memberData.tasks.length === 0 ? (
                <p className="text-muted-foreground text-sm">No tasks assigned</p>
              ) : (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground mb-3">Assigned Tasks</h4>
                  {memberData.tasks
                    .sort((a: Task, b: Task) => {
                      const urgencyA = getTaskUrgency(a.dueDate, a.status)
                      const urgencyB = getTaskUrgency(b.dueDate, b.status)
                      if (urgencyA === "overdue" && urgencyB !== "overdue") return -1
                      if (urgencyB === "overdue" && urgencyA !== "overdue") return 1
                      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
                    })
                    .map((task: Task) => {
                      const urgency = getTaskUrgency(task.dueDate, task.status)
                      return (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            urgency === "overdue"
                              ? "border-destructive bg-destructive/5"
                              : "border-border bg-background/50"
                          }`}
                        >
                          <div className="flex-1">
                            <h5 className="font-medium text-sm">{task.title}</h5>
                            <p className="text-xs text-muted-foreground">
                              Due: {task.dueDate ? formatDate(task.dueDate) : "—"}
                              {urgency === "overdue" && task.dueDate && (
                                <span className="text-destructive font-medium ml-2">
                                  ({Math.abs(Math.ceil(
                                    (new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                                  ))} days overdue)
                                </span>
                              )}
                              {urgency === "today" && <span className="text-accent font-medium ml-2">(Due today)</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              className={getTaskStatusColor(task.status)}
                              variant={task.status === "completed" ? "default" : "secondary"}
                            >
                              {task.status.charAt(0).toUpperCase() + task.status.slice(1).replace("-", " ")}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
