"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { TaskBoard } from "@/components/task-board"
import { ProjectHeader } from "@/components/project-header"
import { ProjectOverview } from "@/components/project-overview"
import { ProjectTeamView } from "@/components/project-team-view"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"


export function ProjectDetailView({ projectId }) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(`http:localhost:5000/api/projects/${projectId}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`Project ${projectId} not found`)
        const project = await res.json()
        setProject(project)
      } catch (e) {
        setError(e?.message || "Failed to load project")
      } finally {
        setLoading(false)
      }
    })()
  }, [projectId])

  if (loading) {
    return <div className="flex-1 grid place-items-center p-10 text-muted-foreground">Loading project…</div>
  }

  if (error || !project) {
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
      <div className="border-b border-border p-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <ProjectHeader project={project} />

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
              <TaskBoard project={project} />
            </TabsContent>

            <TabsContent value="overview" className="h-full m-0">
              <div className="h-full overflow-auto p-6">
                <ProjectOverview project={project} />
              </div>
            </TabsContent>

            <TabsContent value="team" className="h-full m-0 p-6 overflow-auto">
              <ProjectTeamView project={project} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
