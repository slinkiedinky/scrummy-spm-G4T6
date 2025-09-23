"use client"

import { Sidebar } from "@/components/Sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { BarChart3, TrendingUp, Calendar, Target, Clock } from "lucide-react"
import { useState, useEffect } from "react"

export default function AnalyticsPage() {
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        async function fetchProjects() {
        try {
            const res = await fetch("http://localhost:5000/api/projects");
            const data = await res.json();
            setProjects(data);
        } catch (err) {
            console.error("Error fetching projects:", err);
        }
        }
        fetchProjects();
    }, []);

    // --- Metrics ---
    const totalProjects = projects.length;

    // overdue = past dueDate && not completed
    const overdueProjects = projects.filter((p) => {
    const due = p.dueDate ? new Date(p.dueDate) : null;
    return due && due < new Date() && p.status !== "completed";
    }).length;

    const statusCounts = {
        todo: projects.filter((p) => p.status === "to-do").length,
        inprogress: projects.filter((p) => p.status === "in progress").length,
        completed: projects.filter((p) => p.status === "completed").length,
        blocked: projects.filter((p) => p.status === "blocked").length,
    };

    // tasks (guard for missing subcollection)
    const totalTasks = projects.reduce((acc, p) => acc + ((p.tasks ?? []).length), 0);

    const completedTasks = projects.reduce(
    (acc, p) => acc + ((p.tasks ?? []).filter((t) => t.status === "completed").length),
    0
    );

    // progress from tasks
    const averageProgress =
    totalProjects > 0
        ? Math.round(
            projects.reduce((acc, p) => {
            const tasks = p.tasks ?? [];
            const total = tasks.length;
            const done = tasks.filter((t) => t.status === "completed").length;
            return acc + (total > 0 ? (done / total) * 100 : 0);
            }, 0) / totalProjects
        )
        : 0;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-border bg-card p-6">
            <div>
            <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
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
                    {statusCounts.inprogress} in progress, {statusCounts.completed} completed
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
                    <div className="w-3 h-3 rounded-full bg-blue-400" />
                    <span className="text-sm">To Do</span>
                    </div>
                    <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                        {statusCounts.todo}
                    </span>
                    <Badge className="bg-blue-400 text-black">
                        {totalProjects > 0 ? Math.round((statusCounts.todo / totalProjects) * 100) : 0}%
                    </Badge>
                    </div>
                </div>
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <span className="text-sm">In Progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{statusCounts.inprogress}</span>
                    <Badge className="bg-yellow-400 text-black">
                        {totalProjects > 0 ? Math.round((statusCounts.inprogress / totalProjects) * 100) : 0}%
                    </Badge>
                    </div>
                </div>


                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <span className="text-sm">Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{statusCounts.completed}</span>
                    <Badge className="bg-green-400 text-black">
                        {Math.round((statusCounts.completed / totalProjects) * 100)}%
                    </Badge>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-muted" />
                    <span className="text-sm">Blocked</span>
                    </div>
                    <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                        {statusCounts.blocked}
                    </span>
                    <Badge variant="outline">
                        {Math.round((statusCounts.blocked / totalProjects) * 100)}%
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
                    <p className="text-xs text-muted-foreground">{statusCounts.inprogress} projects in progress</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-chart-3/10 rounded-lg border border-chart-3/20">
                    <TrendingUp className="h-5 w-5 text-chart-3" />
                    <div>
                    <p className="text-sm font-medium text-chart-3">Completion Rate</p>
                    <p className="text-xs text-muted-foreground">
                        {`${totalTasks > 0 
                        ? Math.round((completedTasks / totalTasks) * 100) 
                        : 0}% of tasks completed`}
                    </p>
                    </div>
                </div>
                </CardContent>
            </Card>
            </div>
        </div>
        </div>
      </main>
    </div>
  )
}