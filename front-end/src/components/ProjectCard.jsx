"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Calendar, Users } from "lucide-react";

// Robust initials from real names
function getInitials(member) {
  const source = (member?.name || member?.email || member?.id || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
  }
  const token = parts[0].includes("@") ? parts[0].split("@")[0] : parts[0];
  return token.slice(0, 2).toUpperCase();
}

// Light chip set (match Timeline)
const STATUS_CHIP = {
  "to-do":       "bg-gray-100 text-gray-700 border border-gray-200",
  "in progress": "bg-blue-100 text-blue-700 border border-blue-200",
  "completed":   "bg-emerald-100 text-emerald-700 border border-emerald-200",
  "blocked":     "bg-rose-100 text-rose-700 border border-rose-200",
  fallback:      "bg-muted text-muted-foreground border border-border/50",
};

const priorityMeta = {
  low:    { badge: "bg-emerald-100 text-emerald-700 border border-emerald-200", label: "Low" },
  medium: { badge: "bg-yellow-100 text-yellow-700 border border-yellow-200",   label: "Medium" },
  high:   { badge: "bg-red-100 text-red-700 border border-red-200",            label: "High" },
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

const getStatusColor = (status) =>
  STATUS_CHIP[String(status || "").toLowerCase()] ?? STATUS_CHIP.fallback;

export function ProjectCard({ project }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const priorityKey = resolveProjectPriority(project?.priority);
  const priorityBadge = priorityMeta[priorityKey] ?? priorityMeta.medium;

  // Subscribe to the subcollection: projects/{project.id}/tasks
  useEffect(() => {
    if (!project?.id) return;

    const tasksSubcolRef = collection(db, "projects", project.id, "tasks");
    const unsubscribe = onSnapshot(tasksSubcolRef, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTasks(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [project?.id]);

  // Helpers
  const safeDate = (value) => {
    if (!value) return null;
    const d = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(d?.getTime?.()) ? null : d;
  };

  const getRiskLevel = useMemo(() => {
    const now = new Date();
    const overdue = tasks.filter((t) => {
      const due = safeDate(t?.dueDate);
      const isDone =
        String(t?.status || "").toLowerCase() === "completed" ||
        t?.completed === true;
      return due && due < now && !isDone;
    }).length;

    if (overdue > 5) return { level: "High", color: "bg-red-500 text-white border-red-500" };
    if (overdue > 2) return { level: "Medium", color: "bg-yellow-400 text-black border-yellow-400" };
    return { level: "Low", color: "bg-green-500 text-white border-green-500" };
  }, [tasks]);

  const { progressPct, completedCount, totalCount } = useMemo(() => {
    const total = tasks.length;
    if (total === 0) return { progressPct: 0, completedCount: 0, totalCount: 0 };

    const completed = tasks.filter(
      (t) =>
        String(t?.status || "").toLowerCase() === "completed" || t?.completed === true
    ).length;

    return {
      progressPct: Math.round((completed / total) * 100),
      completedCount: completed,
      totalCount: total,
    };
  }, [tasks]);

  const formatDate = (s) =>
    new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const risk = getRiskLevel;

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-card-foreground truncate">
              {project?.name ?? "Untitled Project"}
            </h3>
            {project?.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {project.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Badge className={getStatusColor(project?.status)} variant="outline">
            {project?.status
              ? project.status.charAt(0).toUpperCase() + project.status.slice(1)
              : "Unknown"}
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
        {Array.isArray(project?.tags) && project.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {project.tags.slice(0, 3).map((tag, i) => (
              <Badge
                key={`${tag}-${i}`}
                variant="outline"
                className="text-xs bg-slate-100 text-slate-700 border-slate-300"
              >
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
            <span className="text-sm font-medium text-card-foreground">
              {loading ? "Loading..." : `${progressPct}%`}
            </span>
          </div>
          <Progress value={loading ? 0 : progressPct} className="h-2" />
          {!loading && (
            <div className="text-xs text-muted-foreground mt-1">
              {completedCount} of {totalCount} tasks completed
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-2 text-sm text-muted-foreground">
          {project?.dueDate && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Due {formatDate(project.dueDate)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>{project?.teamIds?.length ?? 0} team members</span>
          </div>

          {!loading &&
            tasks.some((t) => {
              const due = safeDate(t?.dueDate);
              const done =
                String(t?.status || "").toLowerCase() === "completed" ||
                t?.completed === true;
              return due && due < new Date() && !done;
            }) && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {
                    tasks.filter((t) => {
                      const due = safeDate(t?.dueDate);
                      const done =
                        String(t?.status || "").toLowerCase() === "completed" ||
                        t?.completed === true;
                      return due && due < new Date() && !done;
                    }).length
                  }{" "}
                  overdue tasks
                </span>
              </div>
            )}
        </div>

        {/* Action */}
        <div className="flex items-center justify-end">
          <Link href={`/projects/${project?.id}`}>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
