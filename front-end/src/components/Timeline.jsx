"use client";

import React, { useEffect, useState } from "react";
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

/** Swallow permission-denied and continue so the page never crashes */
async function safeGetDocs(q, label) {
  try {
    const snap = await getDocs(q);
    console.log(`[Timeline] ${label} hits:`, snap.size);
    return snap;
  } catch (e) {
    if (e.code === "permission-denied") {
      console.warn(`[Timeline] ${label} query denied (continuing):`, e.message);
      // minimal empty-snapshot shim
      return { size: 0, forEach: () => {} };
    }
    throw e;
  }
}

function formatDate(v) {
  if (!v) return "—";
  const d = v?.toDate ? v.toDate() : new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Timeline() {
  const [uid, setUid] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 1) Wait for Firebase Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      console.log("[Auth] user:", user?.uid || "(none)");
      setUid(user ? user.uid : "");
    });
    return () => unsub();
  }, []);

  // 2) Query Firestore once we have a UID
  useEffect(() => {
    if (uid === null) return; // still resolving auth
    if (!uid) {
      setError("Please sign in.");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        console.log("[Timeline] uid:", uid);
        const cg = collectionGroup(db, "tasks");

        // Use safe getter for all three paths
        const [rAssignee, rCollab, rOwner] = await Promise.all([
          safeGetDocs(query(cg, where("assigneeId", "==", uid)), "assigneeId"),
          safeGetDocs(
            query(cg, where("collaboratorsIds", "array-contains", uid)),
            "collaboratorsIds"
          ),
          safeGetDocs(query(cg, where("ownerId", "==", uid)), "ownerId"),
        ]);

        const rows = [];
        const push = (snap) =>
          snap.forEach((d) => {
            const pRef = d.ref.parent?.parent; // projects/{projectId}
            rows.push({ _taskId: d.id, _projectId: pRef?.id || null, ...d.data() });
          });
        push(rAssignee);
        push(rCollab);
        push(rOwner);

        const dedup = Array.from(
          new Map(rows.map((t) => [`${t._projectId}-${t._taskId}`, t])).values()
        );

        // Project names – never fail UI if denied
        const pids = Array.from(
          new Set(dedup.map((t) => t._projectId).filter(Boolean))
        );
        const nameById = {};
        await Promise.all(
          pids.map(async (pid) => {
            try {
              const ps = await getDoc(doc(db, "projects", pid));
              nameById[pid] = ps.exists() ? ps.data().name || `Project ${pid}` : pid;
            } catch (e) {
              console.warn(`[Timeline] project ${pid} read denied (ok):`, e.code);
              nameById[pid] = pid; // fallback to id so UI still renders
            }
          })
        );

        const toMs = (x) =>
          !x ? undefined : (x.toDate ? x.toDate() : new Date(x)).getTime();

        const mapped = dedup
          .map((t) => ({
            id: `${t._projectId}-${t._taskId}`,
            name: t.title || t.name || "(untitled)",
            dueDate: t.dueDate || null,
            updatedAt: t.updatedAt || null,
            assignedBy: t.createdBy || t.ownerId || "—",
            // fall back to projectId if we couldn't read the project doc
            projectName: nameById[t._projectId] || t._projectId || "—",
          }))
          .sort((a, b) => {
            const ad = toMs(a.dueDate) ?? Infinity,
              bd = toMs(b.dueDate) ?? Infinity;
            if (ad !== bd) return ad - bd;
            const au = toMs(a.updatedAt) ?? 0,
              bu = toMs(b.updatedAt) ?? 0;
            return bu - au;
          });

        setTasks(mapped);
      } catch (e) {
        setError(e?.message || "Failed to load tasks.");
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Timeline</h1>
          <p className="text-sm text-gray-500">
            Tasks assigned to you or involving you, sorted by deadline.
          </p>
        </div>
        <button
          onClick={() =>
            typeof window !== "undefined" && window.location.reload()
          }
          className="text-sm rounded-md border px-3 py-1 hover:bg-gray-50"
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

      {loading && (
        <div className="py-10 text-center text-gray-500">
          Loading your timeline…
        </div>
      )}
      {error && !loading && (
        <div className="py-3 text-red-600">Error: {error}</div>
      )}
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
