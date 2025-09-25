"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";

import {
  getProject,
  updateProject,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, FileText } from "lucide-react";
import { format, addDays, startOfDay, endOfDay, isEqual } from "date-fns";

// for report generation
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx"; // keep if you still export Excel; remove if not used

const STATUS = ["to-do", "in progress", "completed", "blocked"];
const PRIORITY = ["low", "medium", "high"];

// --- main page ---
export default function ProjectDetailPage() {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // quick edit fields
  const [pStatus, setPStatus] = useState("to-do");
  const [pPriority, setPPriority] = useState("medium");

  // quick create task
  const [newTitle, setNewTitle] = useState("");

  // report controls
  const [showReport, setShowReport] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const [p, t] = await Promise.all([getProject(id), listTasks(id)]);
      setProject(p);
      setTasks(t);
      setPStatus((p.status || "to-do").toLowerCase());
      setPPriority((p.priority || "medium").toLowerCase());
    } catch (e) {
      setErr(e?.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  const overdueCount = useMemo(() => {
    const today = new Date();
    return tasks.filter(
      (t) => {
        const d = toDate(t.dueDate);
        const s = (t.status || "").toLowerCase();
        return d && s !== "completed" && d < startOfDay(today);
      }
    ).length;
  }, [tasks]);

  async function saveProjectMeta() {
    await updateProject(id, { status: pStatus, priority: pPriority });
    await load();
  }
  async function handleCreateTask() {
    const title = newTitle.trim();
    if (!title) return;
    await createTask(id, { title, status: "to-do", priority: "medium", tags: [] });
    setNewTitle("");
    await load();
  }
  async function handleTaskStatus(taskId, status) {
    await updateTask(id, taskId, { status });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
  }
  async function handleDeleteTask(taskId) {
    if (!confirm("Delete this task?")) return;
    await deleteTask(id, taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 p-6 grid place-items-center text-muted-foreground">Loading project…</main>
      </div>
    );
  }
  if (err || !project) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 p-6 grid place-items-center text-destructive">
          {err || "Project not found"}
        </main>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6 space-y-6 print:p-8">
          {/* Header / Meta */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold">{project.name || "(untitled project)"}</h1>
              <p className="text-muted-foreground max-w-3xl">{project.description}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <StatusBadge status={project.status} />
                <Badge variant="secondary">Priority: {(project.priority || "medium").toLowerCase()}</Badge>
                {project.dueDate && (
                  <Badge variant="secondary">Due: {format(toDate(project.dueDate), "dd MMM yyyy")}</Badge>
                )}
                <Badge variant="outline">Team: {(project.teamIds || []).length}</Badge>
                <Badge variant="outline">Tags: {(project.tags || []).join(", ") || "-"}</Badge>
                <Badge variant="outline">Overdue tasks: {overdueCount}</Badge>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex flex-col gap-3">
              <Card className="p-4 w-full max-w-xs space-y-3 not-print">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Project status</div>
                  <Select value={pStatus} onValueChange={setPStatus}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Priority</div>
                  <Select value={pPriority} onValueChange={setPPriority}>
                    <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>{PRIORITY.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={saveProjectMeta}>Save</Button>
              </Card>

              <Button className="not-print" onClick={() => setShowReport(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Generate report
              </Button>
            </div>
          </div>

          {/* Tasks */}
          <Card className="p-4 not-print">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Tasks</h2>
              <div className="flex gap-2">
                <Input
                  placeholder="New task title…"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-64"
                />
                <Button onClick={handleCreateTask}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No tasks yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {tasks.map((t) => (
                  <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{t.title}</span>
                        <StatusBadge status={t.status} />
                        <Badge variant="secondary">{(t.priority || "medium").toLowerCase()}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t.description || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                        {t.dueDate && <span>Due: {format(toDate(t.dueDate), "dd MMM yyyy")}</span>}
                        {t.ownerId && <span>Owner: {t.ownerId}</span>}
                        {(t.collaboratorsIds || []).length > 0 && <span>Collab: {(t.collaboratorsIds || []).join(", ")}</span>}
                        {(t.tags || []).length > 0 && <span>Tags: {(t.tags || []).join(", ")}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select value={(t.status || "to-do").toLowerCase()} onValueChange={(v) => handleTaskStatus(t.id, v)}>
                        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeleteTask(t.id)} title="Delete task">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Report drawer/panel */}
          {showReport && (
            <ReportPanel
              project={project}
              tasks={tasks}
              onClose={() => setShowReport(false)}
            />
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

/* ------------------ Report Panel ------------------ */

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "completed" ? "bg-emerald-600" :
    s === "in progress" ? "bg-blue-600" :
    s === "blocked" ? "bg-red-600" : "bg-slate-600";
  return <span className={`text-white text-xs px-2 py-0.5 rounded ${cls}`}>{s || "to-do"}</span>;
}

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000);
  return null;
}

function ReportPanel({ project, tasks, onClose }) {
  const title = `Project Report — ${project.name || "Untitled"}`;
  const generatedAt = new Date().toLocaleString();

  // ====== compute metrics once for BOTH UI + PDF/Excel ======
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfToday = new Date(startToday.getTime() + 86399999);
  const endNext7 = new Date(startToday.getTime() + 7 * 86400000 + 86399999);

  const total = tasks.length;
  const overdueTasks = tasks.filter((t) => {
    const d = toDate(t.dueDate);
    const s = (t.status || "").toLowerCase();
    return d && s !== "completed" && d < startToday;
  });
  const overduePct = total === 0 ? 0 : Math.round((overdueTasks.length / total) * 100);

  const ages = overdueTasks
    .map((t) => Math.ceil((startToday.getTime() - toDate(t.dueDate).getTime()) / 86400000))
    .sort((a, b) => a - b);
  const medianDaysOverdue =
    ages.length === 0 ? 0 :
    (ages.length % 2 ? ages[(ages.length - 1) / 2] : Math.round((ages[ages.length / 2 - 1] + ages[ages.length / 2]) / 2));

  const dueToday = tasks.filter((t) => {
    const d = toDate(t.dueDate);
    if (!d) return false;
    const sd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return sd.getTime() === startToday.getTime();
  });
  const next7Days = tasks.filter((t) => {
    const d = toDate(t.dueDate);
    return d && d > endOfToday && d < endNext7;
  });

// --- Workload (owners + collaborators), deduped, no zeros ---
const team = Array.isArray(project.teamIds) ? project.teamIds : [];
const owners = tasks.map(t => t.ownerId).filter(Boolean);
const collabs = tasks.flatMap(t => Array.isArray(t.collaboratorsIds) ? t.collaboratorsIds : []);
const norm = (s) => (s || "").trim(); // avoid duplicates from stray spaces

// count map
const counts = {};
[...team, ...owners, ...collabs].forEach(m => {
  const k = norm(m);
  if (!k) return;
  if (!(k in counts)) counts[k] = 0;
});
for (const t of tasks) {
  if (t.ownerId) counts[norm(t.ownerId)] = (counts[norm(t.ownerId)] || 0) + 1;
  (t.collaboratorsIds || []).forEach(m => {
    const k = norm(m);
    if (!k) return;
    counts[k] = (counts[k] || 0) + 1;
  });
}

// final list: deduped members with >0 tasks, sorted by desc count
const workloadList = Object.entries(counts)
  .filter(([, c]) => c > 0)
  .sort((a, b) => b[1] - a[1]);


  const AT_RISK = overduePct >= 20 || overdueTasks.length >= 3;

  // ====== PDF (programmatic) ======
  async function exportPDFProgrammatic() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    let y = margin;

    doc.setFontSize(16); doc.text(title, margin, y); y += 16;
    doc.setFontSize(10); doc.setTextColor("#6b7280"); doc.text(`Generated: ${generatedAt}`, margin, y);
    doc.setTextColor("#111827"); y += 20;

    doc.setFontSize(12); doc.text(project.name || "(untitled project)", margin, y); y += 14;
    doc.setFontSize(10);
    if (project.description) {
      const desc = doc.splitTextToSize(project.description, 515);
      doc.text(desc, margin, y);
      y += desc.length * 12 + 6;
    }

    autoTable(doc, {
      startY: y,
      head: [["Field", "Value"]],
      body: [
        ["Status", (project.status || "").toLowerCase()],
        ["Priority", (project.priority || "").toLowerCase()],
        ["Due date", project.dueDate ? new Date(toDate(project.dueDate)).toLocaleDateString() : "-"],
        ["Team", String((project.teamIds || []).length)],
        ["Tags", (project.tags || []).join(", ") || "-"],
      ],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [243, 244, 246], textColor: 17 },
      columnStyles: { 0: { cellWidth: 120 } },
      margin: { left: margin, right: margin },
    });
    y = (doc.lastAutoTable?.finalY || y) + 16;

    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Total tasks", String(total)],
        ["% Overdue", `${overduePct}%`],
        ["Median days overdue", String(medianDaysOverdue)],
        ["Due soon (7 days)", String(next7Days.length)],
        ["At risk", AT_RISK ? "YES" : "NO"],
      ],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [243, 244, 246], textColor: 17 },
      margin: { left: margin, right: margin },
    });
    y = (doc.lastAutoTable?.finalY || y) + 16;

    // Workload table (owners + collaborators, deduped, no zeros)
    const workloadRows = workloadList.map(([memberId, count]) => [memberId, String(count)]);

    autoTable(doc, {
      startY: y,
      head: [["Member", "Tasks"]],
      body: workloadRows.length ? workloadRows : [["—", "0"]],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [243, 244, 246], textColor: 17 },
      margin: { left: margin, right: margin },
    });
    y = (doc.lastAutoTable?.finalY || y) + 16;


    const dlRows = [
      ...dueToday.map((t) => ["Due Today", t.title, t.dueDate ? new Date(toDate(t.dueDate)).toLocaleDateString() : "-"]),
      ...overdueTasks.map((t) => ["Overdue", t.title, t.dueDate ? new Date(toDate(t.dueDate)).toLocaleDateString() : "-"]),
      ...next7Days.map((t) => ["Next 7 Days", t.title, t.dueDate ? new Date(toDate(t.dueDate)).toLocaleDateString() : "-"]),
    ];
    autoTable(doc, {
      startY: y,
      head: [["Bucket", "Task", "Due date"]],
      body: dlRows.length ? dlRows : [["—", "None", "—"]],
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [243, 244, 246], textColor: 17 },
      columnStyles: { 0: { cellWidth: 110 }, 2: { cellWidth: 110 } },
      margin: { left: margin, right: margin },
      didDrawPage: () => {
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height || pageSize.getHeight();
        doc.setFontSize(9);
        doc.setTextColor("#6b7280");
        doc.text(`Generated: ${generatedAt} • ${title}`, margin, pageHeight - 14);
        doc.text(`Page ${doc.getNumberOfPages()}`, pageSize.width - margin - 60, pageHeight - 14);
        doc.setTextColor("#111827");
      },
    });

    doc.save(`${(project.name || "project").replace(/[^\w\-]+/g, "_")}-report.pdf`);
  }

  // ====== Excel (kept, unchanged) ======
  function exportExcel() {
    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.aoa_to_sheet([
      ["Report title", title],
      ["Generated", generatedAt],
      ["Project name", project.name || ""],
      ["Project status", (project.status || "").toLowerCase()],
      ["Priority", (project.priority || "").toLowerCase()],
      ["Due date", project.dueDate ? new Date(toDate(project.dueDate)).toISOString() : ""],
      [],
      ["Total tasks", total],
      ["Overdue tasks", overdueTasks.length],
      ["Overdue %", `${overduePct}%`],
      ["Median days overdue", medianDaysOverdue],
      ["Due today", dueToday.length],
      ["Due next 7 days", next7Days.length],
      ["At risk", AT_RISK ? "YES" : "NO"],
    ]);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // Workload (owners + collaborators, deduped, no zeros)
    const wsWorkload = XLSX.utils.aoa_to_sheet([
      ["Member", "Tasks"],
      ...workloadList.map(([memberId, count]) => [memberId, count]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsWorkload, "Workload");


    const wsDeadlines = XLSX.utils.aoa_to_sheet([
      ["Bucket", "Task", "DueDate"],
      ...dueToday.map((t) => ["Due Today", t.title, t.dueDate ? new Date(toDate(t.dueDate)).toISOString() : ""]),
      ...overdueTasks.map((t) => ["Overdue", t.title, t.dueDate ? new Date(toDate(t.dueDate)).toISOString() : ""]),
      ...next7Days.map((t) => ["Next 7 Days", t.title, t.dueDate ? new Date(toDate(t.dueDate)).toISOString() : ""]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsDeadlines, "Deadlines");

    const wsTasks = XLSX.utils.aoa_to_sheet([
      ["Title", "Status", "Priority", "Owner", "DueDate", "Tags", "Description"],
      ...tasks.map((t) => [
        t.title || "",
        (t.status || "").toLowerCase(),
        (t.priority || "").toLowerCase(),
        t.ownerId || "(unassigned)",
        t.dueDate ? new Date(toDate(t.dueDate)).toISOString() : "",
        (t.tags || []).join(", "),
        t.description || "",
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsTasks, "Tasks");

    XLSX.writeFile(wb, `${(project.name || "project").replace(/[^\w\-]+/g, "_")}-report.xlsx`);
  }

  // ====== Report UI (now shows all required info) ======
  return (
    <div className="fixed inset-0 bg-black/30 z-[1000] print:bg-transparent">
      <div className="absolute right-0 top-0 h-full w-full lg:w-[880px] bg-white overflow-auto p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 not-print">
          <h2 className="text-2xl font-semibold">Project report</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportPDFProgrammatic}>Export PDF</Button>
            <Button variant="outline" onClick={exportExcel}>Export Excel</Button>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>

        <div className="space-y-6">
          <header className="border-b pb-3">
            <div className="text-xs text-muted-foreground">Generated: {generatedAt}</div>
            <h3 className="text-xl font-semibold">{title}</h3>
          </header>

          {/* Meta */}
          <section className="space-y-1">
            <h4 className="text-lg font-semibold">{project.name}</h4>
            <p className="text-muted-foreground">{project.description}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <StatusBadge status={project.status} />
              <Badge variant="secondary">Priority: {(project.priority || "medium").toLowerCase()}</Badge>
              {project.dueDate && <Badge variant="secondary">Due: {format(toDate(project.dueDate), "dd MMM yyyy")}</Badge>}
              <Badge variant="outline">Team: {(project.teamIds || []).length}</Badge>
              <Badge variant="outline">Tags: {(project.tags || []).join(", ") || "-"}</Badge>
            </div>
          </section>

          {/* Summary */}
          <section>
            <h4 className="font-semibold mb-2">Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="p-4"><div className="text-sm text-muted-foreground">Total tasks</div><div className="text-2xl font-bold">{total}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted-foreground">% Overdue</div><div className={`text-2xl font-bold ${overduePct >= 20 ? "text-red-600" : ""}`}>{overduePct}%</div></Card>
              <Card className="p-4"><div className="text-sm text-muted-foreground">Median days overdue</div><div className="text-2xl font-bold">{medianDaysOverdue}</div></Card>
              <Card className="p-4"><div className="text-sm text-muted-foreground">Due soon (7 days)</div><div className="text-2xl font-bold">{next7Days.length}</div></Card>
            </div>
          </section>

          {/* Workload */}
          <section>
            <h4 className="font-semibold mb-2">Workload (tasks per member)</h4>
            {workloadList.length === 0 ? (
              <div className="text-sm text-muted-foreground">No assigned work yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {workloadList.map(([memberId, count]) => (
                  <Card key={memberId} className="p-4 flex items-center justify-between">
                    <div className="text-sm">{memberId}</div>
                    <div className="text-xl font-bold">{count}</div>
                  </Card>
                ))}
              </div>
            )}
          </section>



          {/* Deadlines */}
          <section>
            <h4 className="font-semibold mb-2">Deadlines</h4>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Card className="p-4">
                <div className="font-medium mb-1">Due Today</div>
                {dueToday.length === 0 ? <div className="text-sm text-muted-foreground">None</div> :
                  <ul className="text-sm space-y-1">{dueToday.map((t) => <li key={t.id}>• {t.title}</li>)}</ul>}
              </Card>
              <Card className="p-4">
                <div className="font-medium mb-1">Overdue</div>
                {overdueTasks.length === 0 ? <div className="text-sm text-muted-foreground">None</div> :
                  <ul className="text-sm space-y-1">{overdueTasks.map((t) => <li key={t.id}>• {t.title}</li>)}</ul>}
              </Card>
              <Card className="p-4">
                <div className="font-medium mb-1">Next 7 Days</div>
                {next7Days.length === 0 ? <div className="text-sm text-muted-foreground">None</div> :
                  <ul className="text-sm space-y-1">{next7Days.map((t) => <li key={t.id}>• {t.title} — {format(toDate(t.dueDate), "dd MMM")}</li>)}</ul>}
              </Card>
            </div>
          </section>

          {/* Risk */}
          <section>
            <h4 className="font-semibold mb-2">Risk</h4>
            <Card className={`p-4 ${AT_RISK ? "border-red-500" : ""}`}>
              {AT_RISK ? (
                <div>
                  <div className="font-medium text-red-600">⚠ Project is AT RISK</div>
                  <div className="text-sm text-muted-foreground">
                    Triggered because {overduePct}% overdue and/or {overdueTasks.length} tasks overdue.
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-medium text-emerald-600">Project is healthy</div>
                  <div className="text-sm text-muted-foreground">Overdue backlog is within thresholds.</div>
                </div>
              )}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
