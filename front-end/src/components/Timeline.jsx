"use client";

import React, { useEffect, useMemo, useState } from "react";

/**
 * Timeline: compact list of tasks assigned to the current user,
 * showing Task, Deadline, Updated, and Assigned by.
 *
 * Data sources it attempts:
 *   A) GET /api/tasks?assigneeId=<uid>
 *   B) Fallback per project:
 *        GET /api/projects?assignedTo=<uid>
 *        → GET /api/projects/:projectId/tasks?assigneeId=<uid>
 *
 * How it finds <uid>:
 *   1) from URL ?assignee=<uid> (same as your Tasks page pattern)
 *   2) localStorage.getItem("userId")
 *
 * If your API uses different field names, adjust mapTask().
 */

function formatDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getQueryParam(name) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function Timeline() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");

  // Resolve current userId (assignee)
  const userId = useMemo(() => {
    const fromQuery = getQueryParam("assignee");
    if (fromQuery) return fromQuery;
    const fromLS = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    return fromLS || "";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError("");

      try {
        const collected = [];

        // ------ Path A: /api/tasks?assigneeId=<uid>
        if (userId) {
          try {
            const res = await fetch(`/api/tasks?assigneeId=${encodeURIComponent(userId)}`);
            if (res.ok) {
              const data = await res.json();
              if (!cancelled && Array.isArray(data)) {
                collected.push(...data);
              }
            }
          } catch {
            // ignore; we'll try fallback
          }
        }

        // ------ Path B: projects → project tasks (fallback or enrich)
        if (collected.length === 0) {
          const projRes = await fetch(
            userId ? `/api/projects?assignedTo=${encodeURIComponent(userId)}` : `/api/projects`
          );
          if (!projRes.ok) throw new Error(`Failed to load projects (${projRes.status})`);

          const projects = await projRes.json();
          if (Array.isArray(projects)) {
            const reqs = projects.map(async (p) => {
              const pid = p.id || p.projectId || p.projectID;
              if (!pid) return [];
              const url = userId
                ? `/api/projects/${pid}/tasks?assigneeId=${encodeURIComponent(userId)}`
                : `/api/projects/${pid}/tasks`;
              try {
                const tr = await fetch(url);
                if (!tr.ok) return [];
                const t = await tr.json();
                return Array.isArray(t) ? t.map((x) => ({ ...x, _project: p })) : [];
              } catch {
                return [];
              }
            });

            const perProject = await Promise.all(reqs);
            perProject.forEach((arr) => collected.push(...arr));
          }
        }

        // Normalize record shape for rendering
        const mapTask = (t) => {
          const id =
            t.id || t.taskId || t.taskID || `${t.name || t.title}-${t.projectId || ""}-${t.assigneeId || ""}`;
          const name = t.name || t.title || "(untitled)";
          const dueDate = t.dueDate || t.deadline || t.due_by || t.due_on || null;
          const updatedAt = t.updatedAt || t.updated || t.lastUpdated || null;
          const assignedBy =
            t.assignedByName ||
            t.assignedBy ||
            t.createdByName ||
            t.createdBy ||
            (t.assigner && (t.assigner.name || t.assigner.fullName)) ||
            "—";
          const projectName =
            (t._project && (t._project.name || t._project.title)) ||
            t.projectName ||
            t.project_title ||
            "—";
          return { id, name, dueDate, updatedAt, assignedBy, projectName };
        };

        const normalized = collected.map(mapTask);

        // De-dupe by id
        const dedup = Array.from(new Map(normalized.map((x) => [x.id, x])).values());

        // Sort by due date (earliest first), tie-break by most recently updated
        dedup.sort((a, b) => {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          if (da === db) {
            const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return ub - ua;
          }
          return da - db;
        });

        if (!cancelled) setTasks(dedup);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load timeline.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Timeline</h1>
          <p className="text-sm text-gray-500">Tasks assigned to you, sorted by deadline.</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="text-sm rounded-md border px-3 py-1 hover:bg-gray-50"
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-600 border-b pb-2">
        <div className="col-span-5">Task</div>
        <div className="col-span-2">Deadline</div>
        <div className="col-span-2">Updated</div>
        <div className="col-span-2">Assigned by</div>
        <div className="col-span-1 text-right pr-2">Project</div>
      </div>

      {loading && <div className="py-10 text-center text-gray-500">Loading your timeline…</div>}
      {error && !loading && <div className="py-3 text-red-600">Error: {error}</div>}
      {!loading && !error && tasks.length === 0 && (
        <div className="py-10 text-center text-gray-500">No tasks found.</div>
      )}

      <div className="divide-y">
        {tasks.map((t) => (
          <div key={t.id} className="grid grid-cols-12 gap-2 py-3 items-center">
            <div className="col-span-5">
              <div className="font-medium text-gray-900">{t.name}</div>
              <div className="text-xs text-gray-500">Project: {t.projectName}</div>
            </div>
            <div className="col-span-2">{formatDate(t.dueDate)}</div>
            <div className="col-span-2">{formatDate(t.updatedAt)}</div>
            <div className="col-span-2">{t.assignedBy}</div>
            <div className="col-span-1 text-right pr-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
