"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { mockProjects } from "@/lib/mock-data"
import { BarChart3, TrendingUp, Calendar, Target, Clock } from "lucide-react"

export function AnalyticsView() {
  const totalProjects = mockProjects.length
  const activeProjects = mockProjects.filter((p) => p.status === "active").length
  const completedProjects = mockProjects.filter((p) => p.status === "completed").length
  const overdueProjects = mockProjects.filter(
    (p) => new Date(p.dueDate) < new Date() && p.status !== "completed",
  ).length

  const totalTasks = mockProjects.reduce((acc, project) => acc + project.tasks.length, 0)
  const completedTasks = mockProjects.reduce(
    (acc, project) => acc + project.tasks.filter((task) => task.status === "completed").length,
    0,
  )

  const averageProgress = Math.round(mockProjects.reduce((acc, project) => acc + project.progress, 0) / totalProjects)

  const totalBudget = mockProjects.reduce((acc, project) => acc + (project.budget || 0), 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card p-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track project performance and team productivity</p>
        </div>
      </div>

      {/* Analytics Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProjects}</div>
              <p className="text-xs text-muted-foreground">
                {activeProjects} active, {completedProjects} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averageProgress}%</div>
              <Progress value={averageProgress} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTasks}</div>
              <p className="text-xs text-muted-foreground">{completedTasks} completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalBudget.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Across all projects</p>
            </CardContent>
          </Card>
        </div>

        {/* Project Status Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Status Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-sm">Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{activeProjects}</span>
                  <Badge variant="default">{Math.round((activeProjects / totalProjects) * 100)}%</Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-secondary" />
                  <span className="text-sm">Planning</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {mockProjects.filter((p) => p.status === "planning").length}
                  </span>
                  <Badge variant="secondary">
                    {Math.round((mockProjects.filter((p) => p.status === "planning").length / totalProjects) * 100)}%
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-chart-3" />
                  <span className="text-sm">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{completedProjects}</span>
                  <Badge className="bg-chart-3 text-white">
                    {Math.round((completedProjects / totalProjects) * 100)}%
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted" />
                  <span className="text-sm">On Hold</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {mockProjects.filter((p) => p.status === "on-hold").length}
                  </span>
                  <Badge variant="outline">
                    {Math.round((mockProjects.filter((p) => p.status === "on-hold").length / totalProjects) * 100)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alerts & Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {overdueProjects > 0 && (
                <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <Clock className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Overdue Projects</p>
                    <p className="text-xs text-muted-foreground">
                      {overdueProjects} project{overdueProjects > 1 ? "s" : ""} past due date
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Target className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-primary">Active Projects</p>
                  <p className="text-xs text-muted-foreground">{activeProjects} projects in progress</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-chart-3/10 rounded-lg border border-chart-3/20">
                <TrendingUp className="h-5 w-5 text-chart-3" />
                <div>
                  <p className="text-sm font-medium text-chart-3">Completion Rate</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((completedTasks / totalTasks) * 100)}% of tasks completed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
