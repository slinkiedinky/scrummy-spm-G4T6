"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collectionGroup,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

/* -------------------------------- Utilities -------------------------------- */

async function safeGetDocs(q, label) {
  try {
    const snap = await getDocs(q);
    return snap;
  } catch (e) {
    if (e.code === "permission-denied") {
      console.warn(`[Timeline] ${label} query denied (continuing):`, e.message);
      return { size: 0, forEach: () => {} };
    }
    throw e;
  }
}

function toDate(v) {
  if (!v) return null;
  const d = v?.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(v) {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatDateOnly(v) {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function priorityInfo(p) {
  let n = null;
  if (typeof p === "number") n = p;
  else if (typeof p === "string") {
    const m = p.match(/\d+/);
    if (m) n = parseInt(m[0], 10);
  }
  if (!n || n < 1 || n > 10) n = 10;

  const label = `Priority ${n}`;

  // Standardized tri-band:
  // 1–3 => green, 4–7 => yellow, 8–10 => red
  if (n >= 8) {
    return { label, cls: "bg-red-100 text-red-700 border-red-200", number: n };
  }
  if (n >= 4) {
    return {
      label,
      cls: "bg-yellow-100 text-yellow-700 border-yellow-200",
      number: n,
    };
  }
  return {
    label,
    cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
    number: n,
  };
}

function statusInfo(s) {
  const key = String(s || "").toLowerCase();
  if (key === "to-do" || key === "todo") {
    return {
      label: "To Do",
      cls: "bg-gray-100 text-gray-700 border-gray-200",
      norm: "To Do",
    };
  }
  if (key === "in-progress" || key === "in progress") {
    return {
      label: "In Progress",
      cls: "bg-blue-100 text-blue-700 border-blue-200",
      norm: "In Progress",
    };
  }
  if (key === "done" || key === "completed" || key === "complete") {
    return {
      label: "Completed",
      cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
      norm: "Completed",
    };
  }
  if (key === "blocked") {
    return {
      label: "Blocked",
      cls: "bg-rose-100 text-rose-700 border-rose-200",
      norm: "Blocked",
    };
  }
  return {
    label: s ?? "—",
    cls: "bg-gray-100 text-gray-700 border-gray-200",
    norm: s ?? "—",
  };
}

/* --------------------------- Reusable UI: Dropdowns --------------------------- */

function useClickOutside(ref, onClose) {
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  setSelected,
  searchable = false,
  placeholder = "Select...",
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const filtered = useMemo(() => {
    if (!searchable || !q.trim()) return options;
    const s = q.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, q, searchable]);

  const toggle = (v) =>
    setSelected((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );

  const clearAll = () => setSelected([]);

  const summary =
    selected.length === 0 ? placeholder : `${selected.length} selected`;

  return (
    <div className="relative inline-block min-w-[220px]" ref={ref}>
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between rounded border bg-white px-2 py-1.5 text-sm hover:bg-gray-50"
      >
        <span className={selected.length ? "text-gray-900" : "text-gray-400"}>
          {summary}
        </span>
        <svg
          className="w-4 h-4 text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-[320px] rounded-md border bg-white shadow-lg">
          {searchable && (
            <div className="p-2 border-b">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="w-full rounded border px-2 py-1 text-sm outline-none focus:ring"
              />
            </div>
          )}
          <div className="max-h-64 overflow-auto p-2">
            {filtered.length === 0 && (
              <div className="text-xs text-gray-400 px-1 py-2">No results</div>
            )}
            {filtered.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => toggle(o.value)}
                />
                <span className="text-sm text-gray-800">{o.label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between border-t p-2">
            <button
              className="text-xs text-gray-600 hover:text-gray-900"
              onClick={clearAll}
              type="button"
            >
              Clear
            </button>
            <button
              className="text-xs rounded border px-2 py-1 hover:bg-gray-50"
              onClick={() => setOpen(false)}
              type="button"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Tag Component ------------------------------ */

function Tag({ label, className = "", onRemove }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs shadow-sm bg-white ${className}`}
    >
      <span className="truncate max-w-[200px]">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-gray-100"
        aria-label="Remove"
        title="Remove"
      >
        ×
      </button>
    </span>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function Timeline() {
  const [uid, setUid] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filters
  const [projectFilter, setProjectFilter] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);

  /* ------------------------------- Auth / Data ------------------------------ */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) =>
      setUid(user ? user.uid : "")
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (uid === null) return;
    if (!uid) {
      setError("Please sign in.");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        // Use the existing listAssignedTasks API instead of collectionGroup
        const { listAssignedTasks } = await import("@/lib/api");
        const tasksData = await listAssignedTasks({ assignedTo: uid });

        if (!tasksData || tasksData.length === 0) {
          setTasks([]);
          setLoading(false);
          return;
        }

        // Fetch user names for "assigned by"
        const userIds = Array.from(
          new Set(
            tasksData.map((t) => t.createdBy || t.ownerId).filter(Boolean)
          )
        );

        const userNameById = {};
        await Promise.all(
          userIds.map(async (u) => {
            try {
              const us = await getDoc(doc(db, "users", u));
              userNameById[u] = us.exists() ? us.data().fullName || u : u;
            } catch {
              userNameById[u] = u;
            }
          })
        );

        const normalized = tasksData.map((t) => {
          const pr = priorityInfo(t.priority);
          const st = statusInfo(t.status);
          const assignedById = t.createdBy || t.ownerId || "—";
          return {
            id: `${t.projectId}-${t.id}`,
            name: t.title || t.name || "(untitled)",
            dueDate: t.dueDate || null,
            updatedAt: t.updatedAt || null,
            assignedBy: userNameById[assignedById] || assignedById,
            projectName: t.projectName || t.projectId || "—",
            priorityNumber: pr.number,
            priorityLabel: pr.label,
            priorityCls: pr.cls,
            statusLabel: st.norm,
            statusCls: st.cls,
          };
        });

        // Sort chronologically by due date, then by most recently updated
        normalized.sort((a, b) => {
          const ad = toDate(a.dueDate)?.getTime() ?? Infinity;
          const bd = toDate(b.dueDate)?.getTime() ?? Infinity;
          if (ad !== bd) return ad - bd;
          const au = toDate(a.updatedAt)?.getTime() ?? 0;
          const bu = toDate(b.updatedAt)?.getTime() ?? 0;
          return bu - au;
        });

        setTasks(normalized);
      } catch (e) {
        console.error("Timeline error:", e);
        setError(e?.message || "Failed to load tasks.");
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  /* --------------------------------- Filters -------------------------------- */

  const projectOptions = useMemo(
    () =>
      Array.from(new Set(tasks.map((t) => t.projectName)))
        .filter(Boolean)
        .sort()
        .map((p) => ({ value: p, label: p })),
    [tasks]
  );

  const priorityOptions = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        return { value: n, label: `Priority ${n}` };
      }),
    []
  );

  const statusOptions = useMemo(
    () =>
      ["To Do", "In Progress", "Blocked"].map((s) => ({
        value: s,
        label: s,
      })),
    []
  );

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      // hide completed (whether overdue or not)
      if (t.statusLabel === "Completed") return false;

      const okProj =
        projectFilter.length === 0 || projectFilter.includes(t.projectName);
      const okPrio =
        priorityFilter.length === 0 ||
        priorityFilter.includes(t.priorityNumber);
      const okStat =
        statusFilter.length === 0 || statusFilter.includes(t.statusLabel);

      return okProj && okPrio && okStat;
    });
  }, [tasks, projectFilter, priorityFilter, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const t of filtered) {
      const key = formatDateOnly(t.dueDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    for (const [, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ad = toDate(a.dueDate)?.getTime() ?? Infinity;
        const bd = toDate(b.dueDate)?.getTime() ?? Infinity;
        return ad - bd;
      });
    }
    const order = Array.from(map.entries()).sort((a, b) => {
      const ad = toDate(a[1][0]?.dueDate)?.getTime() ?? Infinity;
      const bd = toDate(b[1][0]?.dueDate)?.getTime() ?? Infinity;
      return ad - bd;
    });
    return order;
  }, [filtered]);

  const resetFilters = () => {
    setProjectFilter([]);
    setPriorityFilter([]);
    setStatusFilter([]);
  };

  const removeProject = (v) =>
    setProjectFilter((prev) => prev.filter((x) => x !== v));
  const removePriority = (n) =>
    setPriorityFilter((prev) => prev.filter((x) => x !== n));
  const removeStatus = (s) =>
    setStatusFilter((prev) => prev.filter((x) => x !== s));

  const priorityTagCls = (n) => {
    const p = Number(n);
    if (p >= 8) return "bg-white text-red-600 border-red-300"; // 8–10
    if (p >= 4) return "bg-white text-yellow-600 border-yellow-300"; // 4–7
    return "bg-white text-emerald-600 border-emerald-300"; // 1–3
  };
  const statusTagCls = (s) => statusInfo(s).cls;

  /* ---------------------------------- UI ---------------------------------- */

  return (
    <div className="px-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Timeline</h1>
          <p className="text-sm text-gray-500">
            Chronological task timeline with project, priority, and status
            filters.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetFilters}
            className="text-sm rounded-md border px-3 py-1 hover:bg-gray-50"
          >
            Clear filters
          </button>
          <button
            onClick={() =>
              typeof window !== "undefined" && window.location.reload()
            }
            className="text-sm rounded-md border px-3 py-1 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-4">
        <MultiSelectDropdown
          label="Project"
          options={projectOptions}
          selected={projectFilter}
          setSelected={setProjectFilter}
          searchable
          placeholder="Search project…"
        />
        <MultiSelectDropdown
          label="Priority"
          options={priorityOptions}
          selected={priorityFilter}
          setSelected={setPriorityFilter}
          placeholder="Select priority…"
        />
        <MultiSelectDropdown
          label="Status"
          options={statusOptions}
          selected={statusFilter}
          setSelected={setStatusFilter}
          placeholder="Select status…"
        />
      </div>

      {/* Selected filter TAGS just below dropdowns */}
      {(projectFilter.length || priorityFilter.length || statusFilter.length) >
        0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {projectFilter.map((p) => (
            <Tag
              key={`pj-${p}`}
              label={`Project: ${p}`}
              onRemove={() => removeProject(p)}
            />
          ))}
          {priorityFilter.map((n) => (
            <Tag
              key={`pr-${n}`}
              label={`Priority ${n}`}
              className={priorityTagCls(n)}
              onRemove={() => removePriority(n)}
            />
          ))}
          {statusFilter.map((s) => (
            <Tag
              key={`st-${s}`}
              label={`Status: ${s}`}
              className={statusTagCls(s)}
              onRemove={() => removeStatus(s)}
            />
          ))}
        </div>
      )}

      {/* Vertical timeline */}
      <div className="relative mt-6 h-[calc(100vh-220px)] overflow-y-auto pr-2">
        {/* timeline line */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />

        {loading && (
          <div className="py-10 text-center text-gray-500">
            Loading your timeline…
          </div>
        )}
        {error && !loading && (
          <div className="py-3 text-red-600">Error: {error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="py-10 text-center text-gray-500">
            No task available
          </div>
        )}

        {!loading &&
          !error &&
          groups.map(([day, items], gi) => (
            <div key={day} className="mb-6">
              {/* Day header */}
              <div className="flex items-center gap-2 mb-3 pl-8">
                <div className="text-sm font-semibold text-gray-700">{day}</div>
              </div>

              {/* Entries */}
              <div className="space-y-4">
                {items.map((t, i) => (
                  <div key={t.id} className="relative pl-8">
                    {/* dot — centered on the line */}
                    <div className="absolute left-3 top-3 -translate-x-1/2">
                      <div
                        className={`w-3 h-3 rounded-full border-2 ${t.priorityCls}`}
                      />
                    </div>

                    {/* card */}
                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <div className="text-base font-semibold text-gray-900">
                            {t.name}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`text-[11px] border rounded px-1.5 py-0.5 ${t.priorityCls}`}
                              title="Priority"
                            >
                              {t.priorityLabel}
                            </span>
                            <span
                              className={`text-[11px] border rounded px-1.5 py-0.5 ${t.statusCls}`}
                              title="Status"
                            >
                              {t.statusLabel}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>
                            <span className="font-medium text-gray-700">
                              Project:
                            </span>{" "}
                            {t.projectName}
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">
                              Deadline:
                            </span>{" "}
                            {formatDateTime(t.dueDate)}
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">
                              Updated:
                            </span>{" "}
                            {formatDateTime(t.updatedAt)}
                          </div>
                          <div className="break-all">
                            <span className="font-medium text-gray-700">
                              Assigned by:
                            </span>{" "}
                            {t.assignedBy}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* connector to next item */}
                    {i !== items.length - 1 && (
                      <div className="absolute left-3 top-7 bottom-[-16px] w-px bg-gray-200" />
                    )}
                  </div>
                ))}
              </div>

              {/* connector between groups */}
              {gi !== groups.length - 1 && (
                <div className="relative h-6">
                  <div className="absolute left-3 right-0 top-0 bottom-0 w-px bg-gray-200" />
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
