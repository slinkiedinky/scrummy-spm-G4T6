"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { TaskBoard } from "@/components/task-board"
import { ProjectHeader } from "@/components/project-header"
import { ProjectOverview } from "@/components/project-overview"
import { ProjectTeamView } from "@/components/project-team-view"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

import type { Project, Task, TeamMember } from "@/types/project"

interface ProjectDetailViewProps {
  projectId: string
}

type RawProject = any
type RawTask = any

// ---------- helpers ----------
const canonStatus = (s: string): Project["status"] => {
  const t = (s || "active").trim().toLowerCase().replace("_", "-")
  if (t === "on hold" || t === "onhold") return "on-hold"
  return (["active", "planning", "on-hold", "completed"].includes(t) ? t : "active") as Project["status"]
}

const canonPriority = (p: string): Project["priority"] => {
  const q = (p || "medium").trim().toLowerCase()
  return (["low", "medium", "high", "urgent"].includes(q) ? q : "medium") as Project["priority"]
}

const canonTaskStatus = (s: string): Task["status"] => {
  const t = (s || "todo").trim().toLowerCase().replace(" ", "-")
  return (["todo", "in-progress", "review", "completed", "blocked"].includes(t) ? t : "todo") as Task["status"]
}

const canonTaskPriority = (p: string): Task["priority"] => {
  const q = (p || "medium").trim().toLowerCase()
  return (["low", "medium", "high", "urgent"].includes(q) ? q : "medium") as Task["priority"]
}

const toISO = (v: any) => {
  try {
    if (!v) return ""
    if (typeof v === "string") return v
    if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000).toISOString()
    if (v instanceof Date) return v.toISOString()
    return String(v)
  } catch { return "" }
}

const deriveRiskLevel = (
  explicit: any,
  overduePercentage: number
): Project["riskLevel"] => {
  const r = String(explicit ?? "").toLowerCase()
  if (r === "low" || r === "medium" || r === "high") return r as Project["riskLevel"]
  if (overduePercentage >= 50) return "high"
  if (overduePercentage >= 20) return "medium"
  return "low"
}

const median = (nums: number[]) => {
  if (!nums.length) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

// ---------- component ----------
export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const [projRes, taskRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
          fetch(`/api/projects/${projectId}/tasks`, { cache: "no-store" }),
        ])
        if (!projRes.ok) throw new Error(`Project ${projectId} not found`)
        const rawProject: RawProject = await projRes.json()
        const rawTasks: RawTask[] = taskRes.ok ? await taskRes.json() : []

        // Department (your TeamMember type likely requires it)
        const projectDepartment =
          Array.isArray(rawProject.department) ? (rawProject.department[0] ?? "") : (rawProject.department ?? "")

        // Build team from teamIds
        const teamIds: string[] = Array.isArray(rawProject.teamIds) ? rawProject.teamIds : []
        const team: TeamMember[] = teamIds.map((id: string) => ({
          id,
          name: `User ${id.slice(0, 4)}`,
          role: "Member",
          email: "",
          avatar: "",
          department: projectDepartment || "General",
        }))

        const overduePercentage = Number(rawProject.overduePercentage ?? 0)
        const progress = Number(rawProject.progress ?? rawProject.completionPercentage ?? 0)

        // Provide required fields: riskLevel, completionPercentage, medianDaysOverdue
        const normalizedProject: Project = {
          id: rawProject.id,
          name: rawProject.name ?? "Untitled",
          description: rawProject.description ?? "",
          client: rawProject.client ?? "",
          status: canonStatus(rawProject.status),
          priority: canonPriority(rawProject.priority),
          progress, // keep if your UI reads it
          completionPercentage: Number(rawProject.completionPercentage ?? progress),
          overduePercentage,
          riskLevel: deriveRiskLevel(rawProject.riskLevel, overduePercentage),
          medianDaysOverdue: Number(rawProject.medianDaysOverdue ?? 0),
          dueDate: toISO(rawProject.dueDate),
          budget: rawProject.budget,
          department: projectDepartment,
          team,
          tasks: [], // filled after tasks normalized
          createdAt: toISO(rawProject.createdAt),
          updatedAt: toISO(rawProject.updatedAt),
        }

        const normalizedTasks: Task[] = rawTasks.map((t: any) => {
          const assigneeId = t.assigneeId || t.assignee?.id || ""
          const assigneeObj =
            typeof t.assignee === "object" && t.assignee
              ? t.assignee
              : { id: assigneeId, name: `User ${String(assigneeId).slice(0, 4)}`, role: "Member", avatar: "" }

          return {
            id: t.id,
            title: t.title ?? t.name ?? "Untitled task",
            description: t.description ?? "",
            status: canonTaskStatus(t.status),
            priority: canonTaskPriority(t.priority),
            dueDate: toISO(t.dueDate),
            createdAt: toISO(t.createdAt),
            updatedAt: toISO(t.updatedAt),
            tags: Array.isArray(t.tags) ? t.tags : [],
            assignee: assigneeObj,
            assigneeId: assigneeObj.id,
            comments: Array.isArray(t.comments) ? t.comments : [],
            attachments: Array.isArray(t.attachments) ? t.attachments : [],
          } as Task
        })

        normalizedProject.tasks = normalizedTasks
        setProject(normalizedProject)
        setTasks(normalizedTasks)
      } catch (e: any) {
        setError(e?.message || "Failed to load project")
      } finally {
        setLoading(false)
      }
    })()
  }, [projectId])

  // When tasks load, recompute completion + median overdue to keep UI accurate
  const composedProject: Project | null = useMemo(() => {
    if (!project) return null
    const total = tasks.length
    const completed = tasks.filter((t) => t.status === "completed").length
    const completionFromTasks = total ? Math.round((completed / total) * 100) : project.completionPercentage ?? project.progress ?? 0

    const today = new Date()
    const overdueDays = tasks
      .filter((t) => t.status !== "completed" && t.dueDate)
      .map((t) => Math.ceil((today.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      .filter((d) => d > 0)

    const medianOverdue = median(overdueDays)

    // If risk not explicitly set, derive from overdue %
    const risk = project.riskLevel ?? deriveRiskLevel(undefined, project.overduePercentage ?? 0)

    return {
      ...project,
      tasks,
      completionPercentage: completionFromTasks,
      medianDaysOverdue: medianOverdue,
      riskLevel: risk,
    }
  }, [project, tasks])

  if (loading) {
    return <div className="flex-1 grid place-items-center p-10 text-muted-foreground">Loading project…</div>
  }
  if (error || !composedProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-10">
        <h1 className="text-2xl font-bold text-foreground mb-4">Project Not Found</h1>
        <p className="text-muted-foreground mb-6">{error ?? "The project you're looking for doesn't exist."}</p>
        <Link href="/">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Back Navigation */}
      <div className="border-b border-border p-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Project Header */}
      <ProjectHeader project={composedProject} />

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="tasks" className="h-full flex flex-col">
          <div className="border-b border-border px-6">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="tasks" className="h-full m-0">
              <TaskBoard project={composedProject} />
            </TabsContent>

            <TabsContent value="overview" className="h-full m-0 p-6">
              <ProjectOverview project={composedProject} />
            </TabsContent>

            <TabsContent value="team" className="h-full m-0 p-6 overflow-auto">
              <ProjectTeamView project={composedProject} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
