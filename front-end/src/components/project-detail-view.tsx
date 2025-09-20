"use client"

import { useState } from "react"
import { mockProjects } from "@/lib/mock-data"
import { TaskBoard } from "@/components/task-board"
import { ProjectHeader } from "@/components/project-header"
import { ProjectOverview } from "@/components/project-overview"
import { ProjectTeamView } from "@/components/project-team-view"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { Project } from "@/types/project"

interface ProjectDetailViewProps {
  projectId: string
}

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const [project] = useState<Project | undefined>(() => mockProjects.find((p) => p.id === projectId))

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-bold text-foreground mb-4">Project Not Found</h1>
        <p className="text-muted-foreground mb-6">The project you're looking for doesn't exist.</p>
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
      <ProjectHeader project={project} />

      {/* Main Content */}
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

            <TabsContent value="overview" className="h-full m-0 p-6">
              <ProjectOverview project={project} />
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
