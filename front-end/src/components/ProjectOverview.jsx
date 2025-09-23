"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, Clock, Target, TrendingUp, AlertTriangle } from "lucide-react"

export function ProjectOverview({ project }) {
  const completedTasks = project.tasks.filter((task) => task.status === "completed").length
  const totalTasks = project.tasks.length
  const inProgressTasks = project.tasks.filter((task) => task.status === "in progress").length
  const overdueTasks = project.tasks.filter(
    (task) => new Date(task.dueDate) < new Date() && task.status !== "completed",
  ).length

  const getUpcomingDeadlines = () => {
    const today = new Date()
    const upcomingTasks = project.tasks
      .filter((task) => task.status !== "completed")
      .map((task) => ({
        ...task,
        daysUntilDue: Math.ceil((new Date(task.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .slice(0, 5) // Show top 5 most urgent

    return upcomingTasks
  }

  const upcomingDeadlines = getUpcomingDeadlines()

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  const getDaysUntilDue = () => {
    const today = new Date()
    const dueDate = new Date(project.dueDate)
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysUntilDue = getDaysUntilDue()

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              {completedTasks} completed, {inProgressTasks} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.progress}%</div>
            <Progress value={project.progress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${daysUntilDue < 0 ? "text-destructive" : ""}`}>
              {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} overdue` : daysUntilDue}
            </div>
            <p className="text-xs text-muted-foreground">Due {formatDate(project.dueDate)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueTasks > 0 ? "text-destructive" : ""}`}>{overdueTasks}</div>
            <p className="text-xs text-muted-foreground">{overdueTasks > 0 ? "Needs attention" : "All on track"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-accent" />
            Upcoming Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingDeadlines.length === 0 ? (
            <p className="text-muted-foreground text-sm">No upcoming deadlines</p>
          ) : (
            <div className="space-y-3">
              {upcomingDeadlines.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{task.title}</h4>
                    <p className="text-sm text-muted-foreground">Due: {formatDate(task.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={task.daysUntilDue < 0 ? "destructive" : task.daysUntilDue <= 1 ? "default" : "secondary"}
                      className={
                        task.daysUntilDue < 0
                          ? "bg-destructive text-destructive-foreground"
                          : task.daysUntilDue <= 1
                            ? "bg-accent text-accent-foreground"
                            : ""
                      }
                    >
                      {task.daysUntilDue < 0
                        ? `${Math.abs(task.daysUntilDue)} days overdue`
                        : task.daysUntilDue === 0
                          ? "Due today"
                          : task.daysUntilDue === 1
                            ? "Due tomorrow"
                            : `${task.daysUntilDue} days left`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="text-sm text-foreground mt-1">{project.description}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge
                  className={
                    project.status === "active"
                      ? "bg-primary text-primary-foreground"
                      : project.status === "completed"
                        ? "bg-chart-3 text-white"
                        : "bg-secondary text-secondary-foreground"
                  }
                >
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </Badge>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Priority</label>
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className={
                    project.priority === "urgent"
                      ? "border-destructive text-destructive"
                      : project.priority === "high"
                        ? "border-accent text-accent"
                        : "border-muted-foreground text-muted-foreground"
                  }
                >
                  {project.priority.charAt(0).toUpperCase() + project.priority.slice(1)}
                </Badge>
              </div>
            </div>

            {project.client && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Client</label>
                <p className="text-sm text-foreground mt-1">{project.client}</p>
              </div>
            )}

            {project.budget && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Budget</label>
                <p className="text-sm text-foreground mt-1">${project.budget.toLocaleString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm text-foreground mt-1">{formatDate(project.createdAt)}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <p className="text-sm text-foreground mt-1">{formatDate(project.updatedAt)}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Due Date</label>
              <p className={`text-sm mt-1 ${daysUntilDue < 0 ? "text-destructive font-medium" : "text-foreground"}`}>
                {formatDate(project.dueDate)}
                {daysUntilDue < 0 && " (Overdue)"}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Duration</label>
              <p className="text-sm text-foreground mt-1">
                {Math.ceil(
                  (new Date(project.dueDate).getTime() - new Date(project.createdAt).getTime()) / (1000 * 60 * 60 * 24),
                )}{" "}
                days
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}