"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bell, Calendar, Check, X, ClipboardList, UserPlus, MessageSquare } from "lucide-react";
import { Trash } from "lucide-react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";

// Local status label map (keeps labels consistent with project UI)
const STATUS_LABELS = {
  "to-do": "To-Do",
  "in progress": "In Progress",
  completed: "Completed",
  blocked: "Blocked",
};

function humanStatus(key) {
  if (!key) return "—";
  const k = String(key).trim();
  return STATUS_LABELS[k] || k.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Try to extract "from 'old' to 'new'" from the notification message if meta is absent
function parseOldNewFromMessage(msg = "") {
  try {
    const m = /from\s+'([^']+)'\s+to\s+'([^']+)'/i.exec(String(msg));
    if (m) return { old: m[1], new: m[2] };
  } catch (e) {}
  return null;
}

// Display labels for known notification types (use normalized keys)
const NOTIF_TYPE_LABELS = {
  "deadline_today": "Deadline Today",
  "deadline_reminder": "Upcoming Deadline",
  "add collaborator" : "Added as Collaborator",
  "add subtask collaborator": "Added as SubTask Collaborator",
  "task status update": "Task Status Update",
  "task deleted": "Task Deleted",
  "add task": "New Task Assigned",
  "add sub task": "New SubTask Assigned",
  "deadline_overdue": "Deadline Overdue",
  "task comment": "Task Comment",
  "subtask comment": "SubTask Comment",
};

// formatTypeLabel: friendly label for types (fallback to Title Case)
function formatTypeLabel(t) {
  if (!t) return "";
  const raw = String(t).trim();
  if (raw.toLowerCase() === "all") return "All";
  // exact match
  if (NOTIF_TYPE_LABELS[raw]) return NOTIF_TYPE_LABELS[raw];
  // normalized match (underscores -> spaces)
  const norm = raw.replace(/_/g, " ").toLowerCase();
  if (NOTIF_TYPE_LABELS[norm]) return NOTIF_TYPE_LABELS[norm];
  // fallback: Title Case the normalized value
  return norm
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

// map notification type -> icon component + harmonious tailwind color
const TYPE_ICON_MAP = {
  "deadline_today": { icon: Calendar, color: "text-amber-600" },
  "deadline_reminder": { icon: Calendar, color: "text-blue-600" },
  "deadline_overdue": { icon: Calendar, color: "text-red-500" },
  "task comment": { icon: MessageSquare, color: "text-teal-600" },
  "subtask comment": { icon: MessageSquare, color: "text-teal-600" },
  "add task": { icon: ClipboardList, color: "text-teal-600" },
  "add collaborator": { icon: UserPlus, color: "text-indigo-600" },
  "add subtask": { icon: ClipboardList, color: "text-teal-600" },
  "add subtask collaborator": { icon: UserPlus, color: "text-indigo-600" },
  "task status update": { icon: Check, color: "text-purple-600" },
  "task deleted": { icon: Trash, color: "text-gray-700" },
  "default": { icon: Bell, color: "text-gray-700" },
};

function getIconForType(t) {
  const key = (t || "default").toLowerCase();
  return TYPE_ICON_MAP[key] || TYPE_ICON_MAP["default"];
}

export default function NotificationsPage() {
  const [uid, setUid] = useState(null);
  const [notifications, setNotifications] = useState([]);
  // filters
  const [filterRead, setFilterRead] = useState("all"); // "all" | "unread" | "read"
  const [filterType, setFilterType] = useState("all"); // "all" or notification type string
  const router = useRouter();

  // Wait for auth, then subscribe
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
      if (!user) setNotifications([]);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!uid) return;
    // order on server by createdAt desc so newest come first
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map((d) => {
        const data = d.data() || {};
        const ca = data.createdAt;
        let createdAtDate = null;
        try {
          if (ca) {
            if (typeof ca.toDate === "function") createdAtDate = ca.toDate();
            else if (typeof ca.toMillis === "function")
              createdAtDate = new Date(ca.toMillis());
            else createdAtDate = new Date(ca);
            if (isNaN(createdAtDate.getTime())) createdAtDate = null;
          }
        } catch (e) {
          createdAtDate = null;
        }
        return { id: d.id, ...data, createdAt: createdAtDate };
      });
      // ensure any missing dates end up last
      notifs.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      setNotifications(notifs);
    });
    return () => unsub();
  }, [uid]);

  const handleNotificationClick = async (notif) => {
    await markAsRead(notif.id);
    if (notif.projectId && notif.taskId) {
      router.push(`/projects/${notif.projectId}?task=${notif.taskId}`);
    } else if (notif.projectId) {
      router.push(`/projects/${notif.projectId}`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllRead = async () => {
    if (!notifications.length) return;
    await Promise.all(
      notifications.map((n) =>
        updateDoc(doc(db, "notifications", n.id), { isRead: true })
      )
    );
  };

  const dismissNotification = async (id) => {
    await deleteDoc(doc(db, "notifications", id));
  };

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, "notifications", id), { isRead: true });
    } catch (e) {
      console.error("Error marking as read:", e);
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return "";
    let dt;
    try {
      dt = typeof date.toDate === "function" ? date.toDate() : date instanceof Date ? date : new Date(date);
    } catch (e) {
      return "";
    }
    if (!dt || isNaN(dt.getTime())) return "";
    const diff = (Date.now() - dt.getTime()) / 1000;
    if (diff < 60) return "less than a minute ago";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  // derive available types from notifications (keep stable order)
  const availableTypes = useMemo(() => {
    const set = new Set();
    notifications.forEach((n) => {
      if (n?.type) set.add(n.type);
    });
    return ["all", ...Array.from(set)];
  }, [notifications]);

  // filtered list according to header controls
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (!n) return false;
      if (filterRead === "unread" && n.isRead) return false;
      if (filterRead === "read" && !n.isRead) return false;
      if (filterType !== "all" && (n.type || "other") !== filterType) return false;
      return true;
    });
  }, [notifications, filterRead, filterType]);

  return (
    <div className="w-full h-screen"> {/* take entire right pane height */}
      <div className="flex h-full w-full">
        {/* If your layout already places a sidebar, this div is the content column.
            We just fill whatever width we're given */}
        <div className="flex flex-col h-full w-full px-6 pt-6">
          {/* Header (fixed) */}
          <div className="shrink-0 flex items-center justify-between border-b pb-3">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <span className="relative">
                <Bell className="h-6 w-6 text-gray-700" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </span>
              Notifications
            </h1>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Show:</label>
              <select
                value={filterRead}
                onChange={(e) => setFilterRead(e.target.value)}
                className="text-sm border rounded px-2 py-1"
                aria-label="Filter read status"
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>

              <label className="text-sm text-gray-600">Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-sm border rounded px-2 py-1"
                aria-label="Filter notification type"
              >
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {formatTypeLabel(t)}
                  </option>
                ))}
              </select>

              <button
                onClick={markAllRead}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <Check className="h-4 w-4" /> Mark all read
              </button>
            </div>
          </div>

          {/* Scrollable list fills remaining space */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-6 pr-1 -mr-1">
            {filteredNotifications.length === 0 ? (
              <div className="text-sm text-gray-500">No notifications yet.</div>
            ) : (
              <div className="space-y-4">
                {filteredNotifications.map((notif) => {
                  // compute when rendering each notif:
                  // Prefer meta.oldStatus/newStatus. If missing, try to parse message "from 'x' to 'y'".
                  const msgParsed = parseOldNewFromMessage(notif?.message);
                  const oldKey =
                    notif?.meta?.oldStatus ??
                    (msgParsed ? msgParsed.old : undefined) ??
                    notif?.statusFrom ??
                    notif?.status ??
                    "";
                  const newKey =
                    notif?.meta?.newStatus ??
                    (msgParsed ? msgParsed.new : undefined) ??
                    notif?.statusTo ??
                    notif?.status ??
                    "";
                  const fromLabel = humanStatus(oldKey);
                  const toLabel = humanStatus(newKey);

                  // compute changed-by display: prefer meta.changedByName, then other fallbacks
                  const changedByDisplay =
                    notif?.meta?.changedByName ||
                    notif?.changedByName ||
                    notif?.updatedByName ||
                    notif?.assignedByName ||
                    notif?.createdBy ||
                    "-";

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full flex items-start gap-3 p-4 border rounded-lg shadow-sm cursor-pointer transition ${
                        notif.isRead ? "bg-white border-gray-200" : "bg-blue-50 border-blue-300"
                      }`}
                    >
                      {(() => {
                        const { icon: IconComp, color } = getIconForType(notif.type);
                        return (
                          <div className={`mt-1 ${color}`}>
                            <IconComp className="h-5 w-5" />
                          </div>
                        );
                      })()}

                      <div className="flex-1">
                        {/*
                          Dedicated rendering for "task deleted" so header reads "Task deleted"
                          and the card shows Task: {title} and Project: {projectName}
                        */}
                        {notif.type === "task deleted" ? (
                          <>
                            <h2 className="font-medium text-gray-900">Task deleted</h2>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Task:</span> {notif.title || notif.taskTitle || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                            </div>
                            {notif.message && <div className="text-sm text-gray-600 mt-1">{notif.message}</div>}
                            <div className="text-xs text-gray-400 mt-1">{notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}</div>
                          </>
                        ) : notif.type === "task comment" ? (
                          <>
                            <h2 className="font-medium text-gray-900">New Comment</h2>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Task:</span> {notif.title || notif.taskTitle || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Comment by:</span> {notif.author || notif.createdBy || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Comment:</span> {notif.text || notif.message || "-"}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">{notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}</div>
                          </>
                        ) : notif.type === "subtask comment" ? (
                          <>
                            <h2 className="font-medium text-gray-900">New Comment</h2>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">SubTask:</span> {notif.title || notif.taskTitle || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Comment by:</span> {notif.author || notif.createdBy || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Comment:</span> {notif.text || notif.message || "-"}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">{notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}</div>
                          </>
                        ) : notif.type === "add task" ? (
                          <>
                            <h2 className="font-medium text-gray-900">New Task Assigned</h2>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Task:</span> {notif.title || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Assigned by:</span> {notif.assignedByName || "-"}
                            </div>
                            {notif.description && (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-semibold">Description:</span> {notif.description}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">{notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}</div>
                          </>
                        ) : notif.type === "add subtask" ? (
                          <>
                            <h2 className="font-medium text-gray-900">New SubTask Assigned</h2>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Task:</span> {notif.title || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Assigned by:</span> {notif.assignedByName || "-"}
                            </div>
                            {notif.description && (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-semibold">Description:</span> {notif.description}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">{notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}</div>
                          </>
                        ) : notif.type === "add collaborator" ? (
                          <>
                            <h2 className="font-medium text-gray-900">You've been added as a collaborator</h2>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Task:</span> {notif.title || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Added by:</span> {notif.assignedByName || "-"}
                            </div>
                            {notif.description && (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-semibold">Description:</span> {notif.description}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">{notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}</div>
                          </>
                        ) : notif.type === "add subtask collaborator" ? (
                          <>
                            <h2 className="font-medium text-gray-900">You've been added as a collaborator</h2>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Task:</span> {notif.title || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Added by:</span> {notif.assignedByName || "-"}
                            </div>
                            {notif.description && (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-semibold">Description:</span> {notif.description}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">{notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}</div>
                          </>
                        ) : notif.type === "task status update" ? (
                          <>
                            <h2 className="font-medium text-gray-900">Task status updated</h2>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Task:</span> {notif.title || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                            </div>
                            {notif.message && <div className="text-sm text-gray-600 mt-1">{notif.message}</div>}
                            <div className="text-xs text-gray-400 mt-1">{notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}</div>
                          </>
                        ) : notif.type?.startsWith("deadline_") ? (
                          <>
                            <h2 className="font-medium text-gray-900">{formatTypeLabel(notif.type)}</h2>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Task:</span> {notif.title || "-"}
                            </div>
                            <div className="text-sm text-gray-700">
                              <span className="font-semibold">Project:</span> {notif.projectName || "-"}
                            </div>
                            {notif.description && <div className="text-sm text-gray-600 mt-1">{notif.description}</div>}
                            <div className="text-xs text-gray-400 mt-1">{notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}</div>
                          </>
                        ) : (
                          <>
                            <h2 className="font-medium text-gray-900">{notif.title || "Notification"}</h2>
                            {notif.message && <div className="text-sm text-gray-600 mt-1">{notif.message}</div>}
                            <div className="text-xs text-gray-400 mt-1">{notif.createdAt ? formatTimeAgo(notif.createdAt) : ""}</div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
 }
