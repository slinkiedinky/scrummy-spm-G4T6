import { NextResponse } from "next/server";
import { listTasks } from "@/lib/api"; // you already import/use this in page.jsx

function toISODate(d) {
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
    .toISOString()
    .slice(0, 10);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project");
  const memberId = searchParams.get("member");
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month")); // 1..12

  if (!projectId || !memberId || !year || !month) {
    return NextResponse.json(
      { error: "Missing project, member, year, or month" },
      { status: 400 }
    );
  }

  const tasks = await listTasks(projectId, { assigneeId: memberId });

  const start = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month, 1);
  const end = new Date(nextMonth - 1);

  const days = {};
  const ok = (t) => {
    const due = t?.dueDate ? new Date(t.dueDate) : null;
    if (!due) return false;
    return (
      due.getFullYear() === year &&
      due.getMonth() === month - 1
    );
  };

  for (const t of tasks || []) {
    if (!ok(t)) continue;
    const day = toISODate(t.dueDate);
    if (!days[day]) days[day] = [];
    days[day].push({
      id: t.id,
      name: t.title || t.name || "(untitled)",
      status: String(t.status || "").toLowerCase(),
      due_date: toISODate(t.dueDate),
      // Include modal fields inline so tests can assert them
      description: t.description || "",
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
      collaborators: Array.isArray(t.collaboratorsIds)
        ? t.collaboratorsIds
        : [],
      comments: Array.isArray(t.comments) ? t.comments : [],
      // Expose a color hint (optional)
      status_color: (() => {
        const s = String(t.status || "").toLowerCase();
        if (s === "to-do" || s === "to do") return "grey";
        if (s === "completed") return "green";
        if (s === "blocked") return "red";
        if (s === "in progress") return "yellow";
        return "grey";
      })(),
    });
  }

  return NextResponse.json({
    project: projectId,
    member: memberId,
    today: toISODate(new Date()),
    view: "month",
    available_views: ["month"],
    range: {
      start: toISODate(start),
      end: toISODate(end),
    },
    days,
  });
}
